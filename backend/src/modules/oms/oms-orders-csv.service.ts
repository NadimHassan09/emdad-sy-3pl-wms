import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  OmsOrderStatus,
  OmsPaymentMethod,
  ShippingMethod,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { getOmsClientImportTemplate } from '../client-portal/order-import/oms-client-import.schema';
import {
  ADMIN_OMS_EXPORT_COLUMNS,
  adminHeaderLabels,
  adminOrderedColumnIds,
} from './admin-order-export.columns';
import { CreateOmsOrderDto } from './dto/oms-order.dto';
import { ListOmsOrdersQueryDto } from './dto/list-oms-orders-query.dto';
import {
  cell,
  mapCsvHeaderRow,
  omsImportTemplateCsv,
  parseCsv,
  rowsToCsv,
  type OmsImportCsvHeader,
} from './oms-orders-csv.util';
import { OmsOrdersService } from './oms-orders.service';

export const OMS_EXPORT_MAX_ROWS = 10_000;
export const OMS_IMPORT_MAX_ROWS = 2_000;
export const OMS_IMPORT_MAX_ORDERS = 500;

export type OmsImportRowError = {
  rowNumber: number;
  externalReference: string | null;
  reason: string;
};

export type OmsImportValidateResult = {
  batchId: string;
  totalRows: number;
  orderCount: number;
  validOrders: number;
  invalidOrders: number;
  duplicateInFile: number;
  duplicateInDb: number;
  errors: OmsImportRowError[];
  /** Valid order payloads keyed for execute (server-only; not for UI trust). */
  _validPayloads?: Array<{
    externalReference: string;
    companyId: string;
    dto: CreateOmsOrderDto;
    sourceRowNumbers: number[];
  }>;
};

export type OmsImportExecuteResult = {
  batchId: string;
  imported: number;
  failed: number;
  skippedDuplicates: number;
  createdOrderNumbers: string[];
  errors: OmsImportRowError[];
};

type ParsedOrderGroup = {
  externalReference: string;
  companyIdRaw: string;
  sourceRowNumbers: number[];
  headerRow: number;
  fields: Record<string, string>;
  lines: Array<{ sku: string; quantity: string; unitPrice: string; rowNumber: number }>;
};

@Injectable()
export class OmsOrdersCsvService {
  constructor(private readonly orders: OmsOrdersService) {}

  columns() {
    return ADMIN_OMS_EXPORT_COLUMNS;
  }

  /** Admin import uses the same client-portal CSV template. */
  getImportTemplate(): { filename: string; body: string } {
    return getOmsClientImportTemplate();
  }

  /** Legacy admin-only template (kept for tests / reference). */
  getLegacyImportTemplate(): { filename: string; body: string } {
    return {
      filename: 'oms-orders-import-template.csv',
      body: omsImportTemplateCsv(),
    };
  }

  async exportCsv(
    user: AuthPrincipal,
    query: ListOmsOrdersQueryDto,
    opts?: { columnIds?: string[]; arabicHeaders?: boolean; ids?: string[] },
  ): Promise<{ filename: string; body: string; rowCount: number; truncated: boolean }> {
    const columnIds = adminOrderedColumnIds(ADMIN_OMS_EXPORT_COLUMNS, opts?.columnIds);
    if (columnIds.length === 0) {
      throw new BadRequestException('Select at least one valid export column.');
    }

    const { items, total, truncated } = await this.orders.listForExport(user, query, {
      maxRows: OMS_EXPORT_MAX_ROWS,
      ids: opts?.ids,
    });

    const arabic = Boolean(opts?.arabicHeaders);
    const headers = adminHeaderLabels(ADMIN_OMS_EXPORT_COLUMNS, columnIds, arabic);

    const rows = items.map((o) => {
      const lineCount = o.lines?.length ?? 0;
      const totalQty = (o.lines ?? []).reduce(
        (sum, l) => sum + Number(l.requestedQuantity ?? 0),
        0,
      );
      const cells: Record<string, string | number> = {
        order_number: o.orderNumber,
        status: o.status,
        company_id: o.companyId,
        company_name: o.company?.name ?? '',
        external_reference: o.externalReference ?? '',
        client_reference: o.clientReference ?? '',
        recipient_name: o.recipientName ?? '',
        recipient_phone: o.recipientPhone ?? '',
        city: o.city ?? '',
        district: o.district ?? '',
        address_line1: o.addressLine1 ?? '',
        store_channel: o.storeChannel ?? '',
        payment_method: o.paymentMethod ?? '',
        cod_status: o.codStatus ?? '',
        cod_amount: o.codAmount ?? '',
        currency: o.currency ?? '',
        subtotal: o.subtotal ?? '',
        shipping_fee: o.shippingFee ?? '',
        total: o.total ?? '',
        line_count: lineCount,
        total_quantity: totalQty,
        shipping_method: o.shippingMethod ?? '',
        shipping_provider_code: o.shippingProviderCode ?? '',
        carrier: o.carrier ?? '',
        outbound_order_number: o.linkedOutboundOrder?.orderNumber ?? '',
        required_ship_date: o.requiredShipDate
          ? new Date(o.requiredShipDate).toISOString().slice(0, 10)
          : '',
        created_at: o.createdAt ? new Date(o.createdAt).toISOString() : '',
        confirmed_at: o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
        approved_at: o.approvedAt ? new Date(o.approvedAt).toISOString() : '',
        out_for_delivery_at: o.outForDeliveryAt
          ? new Date(o.outForDeliveryAt).toISOString()
          : '',
        delivered_at: o.deliveredAt ? new Date(o.deliveredAt).toISOString() : '',
      };
      return columnIds.map((id) => cells[id] ?? '');
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `oms-orders-${stamp}.csv`,
      body: rowsToCsv(headers, rows),
      rowCount: items.length,
      truncated: truncated || total > items.length,
    };
  }

  async validateImport(
    user: AuthPrincipal,
    fileBuffer: Buffer,
  ): Promise<OmsImportValidateResult> {
    const parsed = this.parseAndGroup(fileBuffer);
    return this.validateGroups(user, parsed.groups, parsed.totalRows);
  }

  async executeImport(
    user: AuthPrincipal,
    fileBuffer: Buffer,
  ): Promise<OmsImportExecuteResult> {
    const parsed = this.parseAndGroup(fileBuffer);
    const validated = await this.validateGroups(user, parsed.groups, parsed.totalRows);
    const batchId = validated.batchId;
    const createdOrderNumbers: string[] = [];
    const errors: OmsImportRowError[] = [...validated.errors];
    let imported = 0;
    let failed = 0;
    const skippedDuplicates = validated.duplicateInDb + validated.duplicateInFile;

    for (const payload of validated._validPayloads ?? []) {
      try {
        const created = await this.orders.create(user, payload.dto, {
          provisionOutbound: false,
          bulkImport: { batchId, externalReference: payload.externalReference },
        });
        imported++;
        createdOrderNumbers.push(created.orderNumber);
      } catch (err) {
        failed++;
        const reason = err instanceof Error ? err.message : 'Create failed.';
        errors.push({
          rowNumber: payload.sourceRowNumbers[0] ?? 0,
          externalReference: payload.externalReference,
          reason,
        });
      }
    }

    return {
      batchId,
      imported,
      failed: failed + validated.invalidOrders,
      skippedDuplicates,
      createdOrderNumbers,
      errors,
    };
  }

  private parseAndGroup(fileBuffer: Buffer): {
    totalRows: number;
    groups: ParsedOrderGroup[];
  } {
    if (fileBuffer.byteLength > 5 * 1024 * 1024) {
      throw new PayloadTooLargeException('CSV file must be 5 MB or smaller.');
    }
    const text = fileBuffer.toString('utf8');
    const table = parseCsv(text);
    if (table.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row.');
    }
    const { indexByHeader, unknown } = mapCsvHeaderRow(table[0]);
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown CSV column(s): ${unknown.slice(0, 8).join(', ')}. Download the template for the supported format.`,
      );
    }
    const requiredHeaders: OmsImportCsvHeader[] = [
      'external_reference',
      'required_ship_date',
      'recipient_name',
      'recipient_phone',
      'city',
      'address_line1',
      'product_sku',
      'quantity',
    ];
    for (const h of requiredHeaders) {
      if (indexByHeader[h] == null) {
        throw new BadRequestException(`Missing required CSV column: ${h}.`);
      }
    }

    const dataRows = table.slice(1);
    if (dataRows.length > OMS_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `CSV has ${dataRows.length} data rows; maximum is ${OMS_IMPORT_MAX_ROWS}.`,
      );
    }

    const groups = new Map<string, ParsedOrderGroup>();
    dataRows.forEach((cells, idx) => {
      const rowNumber = idx + 2; // 1-based with header
      const externalReference = cell(cells, indexByHeader, 'external_reference');
      const companyIdRaw = cell(cells, indexByHeader, 'company_id');
      const sku = cell(cells, indexByHeader, 'product_sku');
      const quantity = cell(cells, indexByHeader, 'quantity');
      const unitPrice = cell(cells, indexByHeader, 'unit_price');
      const key = `${companyIdRaw.trim().toLowerCase()}::${externalReference.trim().toLowerCase()}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          externalReference,
          companyIdRaw,
          sourceRowNumbers: [],
          headerRow: rowNumber,
          fields: {
            required_ship_date: cell(cells, indexByHeader, 'required_ship_date'),
            recipient_name: cell(cells, indexByHeader, 'recipient_name'),
            recipient_phone: cell(cells, indexByHeader, 'recipient_phone'),
            city: cell(cells, indexByHeader, 'city'),
            district: cell(cells, indexByHeader, 'district'),
            address_line1: cell(cells, indexByHeader, 'address_line1'),
            address_line2: cell(cells, indexByHeader, 'address_line2'),
            delivery_instructions: cell(cells, indexByHeader, 'delivery_instructions'),
            payment_method: cell(cells, indexByHeader, 'payment_method'),
            currency: cell(cells, indexByHeader, 'currency'),
            cod_amount: cell(cells, indexByHeader, 'cod_amount'),
            shipping_fee: cell(cells, indexByHeader, 'shipping_fee'),
            store_channel: cell(cells, indexByHeader, 'store_channel'),
            client_reference: cell(cells, indexByHeader, 'client_reference'),
            notes: cell(cells, indexByHeader, 'notes'),
          },
          lines: [],
        };
        groups.set(key, group);
      }
      group.sourceRowNumbers.push(rowNumber);
      group.lines.push({ sku, quantity, unitPrice, rowNumber });
    });

    if (groups.size > OMS_IMPORT_MAX_ORDERS) {
      throw new BadRequestException(
        `CSV has ${groups.size} orders; maximum is ${OMS_IMPORT_MAX_ORDERS}.`,
      );
    }

    return { totalRows: dataRows.length, groups: [...groups.values()] };
  }

  private async validateGroups(
    user: AuthPrincipal,
    groups: ParsedOrderGroup[],
    totalRows: number,
  ): Promise<OmsImportValidateResult> {
    const batchId = randomUUID();
    const errors: OmsImportRowError[] = [];
    let duplicateInFile = 0;
    let duplicateInDb = 0;
    const validPayloads: NonNullable<OmsImportValidateResult['_validPayloads']> = [];

    for (const g of groups) {
      const ref = g.externalReference.trim();
      if (!ref) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: null,
          reason: 'external_reference is required.',
        });
        continue;
      }

      let companyId: string;
      try {
        companyId = this.orders.resolveImportCompanyId(user, g.companyIdRaw || undefined);
      } catch (err) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: err instanceof Error ? err.message : 'Invalid company_id.',
        });
        continue;
      }

      const existing = await this.orders.findExistingByExternalReference(user, companyId, ref);
      if (existing) {
        duplicateInDb++;
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: `Order with external_reference "${ref}" already exists (${existing.orderNumber}).`,
        });
        continue;
      }

      const skus = [...new Set(g.lines.map((l) => l.sku.trim().toUpperCase()).filter(Boolean))];
      if (skus.length === 0) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: 'At least one product_sku is required.',
        });
        continue;
      }

      const products = await this.orders.findProductsBySkus(companyId, skus);
      const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
      const lineDtos: CreateOmsOrderDto['lines'] = [];
      let lineFailed = false;
      for (const line of g.lines) {
        const sku = line.sku.trim();
        if (!sku) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: 'product_sku is required.',
          });
          lineFailed = true;
          continue;
        }
        const product = bySku.get(sku.toUpperCase());
        if (!product) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: `Product "${sku}" not found for this company.`,
          });
          lineFailed = true;
          continue;
        }
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: `Invalid quantity "${line.quantity}" for product "${sku}".`,
          });
          lineFailed = true;
          continue;
        }
        const unitPrice =
          line.unitPrice.trim() === '' ? undefined : Number(line.unitPrice);
        if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: `Invalid unit_price "${line.unitPrice}" for product "${sku}".`,
          });
          lineFailed = true;
          continue;
        }
        lineDtos.push({
          productId: product.id,
          requestedQuantity: qty,
          unitPrice,
        });
      }
      if (lineFailed || lineDtos.length === 0) continue;

      const paymentRaw = g.fields.payment_method.trim().toUpperCase();
      const paymentMethod =
        paymentRaw === ''
          ? undefined
          : (paymentRaw as OmsPaymentMethod);

      const plain = {
        companyId,
        requiredShipDate: g.fields.required_ship_date,
        recipientName: g.fields.recipient_name,
        recipientPhone: g.fields.recipient_phone,
        city: g.fields.city,
        district: g.fields.district || undefined,
        addressLine1: g.fields.address_line1,
        addressLine2: g.fields.address_line2 || undefined,
        deliveryInstructions: g.fields.delivery_instructions || undefined,
        paymentMethod,
        currency: g.fields.currency || 'USD',
        codAmount:
          g.fields.cod_amount.trim() === '' ? undefined : Number(g.fields.cod_amount),
        shippingFee:
          g.fields.shipping_fee.trim() === '' ? undefined : Number(g.fields.shipping_fee),
        storeChannel: g.fields.store_channel || 'csv_import',
        clientReference: g.fields.client_reference || undefined,
        notes: g.fields.notes || undefined,
        externalReference: ref,
        shippingMethod: ShippingMethod.manual,
        lines: lineDtos,
      };

      const dto = plainToInstance(CreateOmsOrderDto, plain);
      const dtoErrors = validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (dtoErrors.length > 0) {
        const msg = dtoErrors
          .flatMap((e) => Object.values(e.constraints ?? {}))
          .join('; ');
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: msg || 'Order failed validation.',
        });
        continue;
      }

      try {
        await this.orders.assertImportCreateReady(user, dto);
      } catch (err) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: err instanceof Error ? err.message : 'Order failed business validation.',
        });
        continue;
      }

      validPayloads.push({
        externalReference: ref,
        companyId,
        dto,
        sourceRowNumbers: g.sourceRowNumbers,
      });
    }

    return {
      batchId,
      totalRows,
      orderCount: groups.length,
      validOrders: validPayloads.length,
      invalidOrders: groups.length - validPayloads.length,
      duplicateInFile,
      duplicateInDb,
      errors,
      _validPayloads: validPayloads,
    };
  }
}
