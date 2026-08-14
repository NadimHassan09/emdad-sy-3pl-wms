import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ShippingMethod } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CreateOutboundOrderDto } from './dto/create-outbound.dto';
import { ListOutboundQueryDto } from './dto/list-outbound-query.dto';
import {
  cell,
  mapCsvHeaderRow,
  outboundImportTemplateCsv,
  parseCsv,
  parseRequiresPacking,
  rowsToCsv,
  type OutboundImportCsvHeader,
} from './outbound-orders-csv.util';
import { OutboundService } from './outbound.service';

export const OUTBOUND_EXPORT_MAX_ROWS = 10_000;
export const OUTBOUND_IMPORT_MAX_ROWS = 2_000;
export const OUTBOUND_IMPORT_MAX_ORDERS = 500;

export type OutboundImportRowError = {
  rowNumber: number;
  externalReference: string | null;
  reason: string;
};

export type OutboundImportValidateResult = {
  batchId: string;
  totalRows: number;
  orderCount: number;
  validOrders: number;
  invalidOrders: number;
  duplicateInFile: number;
  duplicateInDb: number;
  errors: OutboundImportRowError[];
  _validPayloads?: Array<{
    externalReference: string;
    companyId: string;
    dto: CreateOutboundOrderDto;
    sourceRowNumbers: number[];
  }>;
};

export type OutboundImportExecuteResult = {
  batchId: string;
  imported: number;
  failed: number;
  skippedDuplicates: number;
  createdOrderNumbers: string[];
  errors: OutboundImportRowError[];
};

type ParsedOrderGroup = {
  externalReference: string;
  companyIdRaw: string;
  sourceRowNumbers: number[];
  headerRow: number;
  fields: Record<string, string>;
  lines: Array<{ sku: string; requestedQuantity: string; rowNumber: number }>;
};

@Injectable()
export class OutboundOrdersCsvService {
  constructor(private readonly outbound: OutboundService) {}

  getImportTemplate(): { filename: string; body: string } {
    return {
      filename: 'outbound-orders-import-template.csv',
      body: outboundImportTemplateCsv(),
    };
  }

  async exportCsv(
    user: AuthPrincipal,
    query: ListOutboundQueryDto,
  ): Promise<{ filename: string; body: string; rowCount: number; truncated: boolean }> {
    const { items, total, truncated } = await this.outbound.listForExport(user, query, {
      maxRows: OUTBOUND_EXPORT_MAX_ROWS,
    });

    const headers = [
      'order_number',
      'status',
      'company_id',
      'company_name',
      'external_reference',
      'client_reference',
      'destination_address',
      'required_ship_date',
      'carrier',
      'tracking_number',
      'requires_packing',
      'notes',
      'line_count',
      'total_requested_quantity',
      'shipping_method',
      'execution_mode',
      'created_at',
      'confirmed_at',
      'shipped_at',
    ];

    const rows = items.map((o) => {
      const lineCount = o.lines?.length ?? 0;
      const totalQty = (o.lines ?? []).reduce(
        (sum, l) => sum + Number(l.requestedQuantity ?? 0),
        0,
      );
      return [
        o.orderNumber,
        o.status,
        o.companyId,
        o.company?.name ?? '',
        o.externalReference ?? '',
        o.clientReference ?? '',
        o.destinationAddress ?? '',
        o.requiredShipDate ? new Date(o.requiredShipDate).toISOString().slice(0, 10) : '',
        o.carrier ?? '',
        o.trackingNumber ?? '',
        o.requiresPacking ? 'true' : 'false',
        o.notes ?? '',
        lineCount,
        totalQty,
        o.shippingMethod ?? '',
        o.executionMode ?? '',
        o.createdAt ? new Date(o.createdAt).toISOString() : '',
        o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
        o.shippedAt ? new Date(o.shippedAt).toISOString() : '',
      ];
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `outbound-orders-${stamp}.csv`,
      body: rowsToCsv(headers, rows),
      rowCount: items.length,
      truncated: truncated || total > items.length,
    };
  }

  async validateImport(
    user: AuthPrincipal,
    fileBuffer: Buffer,
  ): Promise<OutboundImportValidateResult> {
    const parsed = this.parseAndGroup(fileBuffer);
    return this.validateGroups(user, parsed.groups, parsed.totalRows);
  }

  async executeImport(
    user: AuthPrincipal,
    fileBuffer: Buffer,
  ): Promise<OutboundImportExecuteResult> {
    const parsed = this.parseAndGroup(fileBuffer);
    const validated = await this.validateGroups(user, parsed.groups, parsed.totalRows);
    const batchId = validated.batchId;
    const createdOrderNumbers: string[] = [];
    const errors: OutboundImportRowError[] = [...validated.errors];
    let imported = 0;
    let failed = 0;
    const skippedDuplicates = validated.duplicateInDb + validated.duplicateInFile;

    for (const payload of validated._validPayloads ?? []) {
      try {
        const created = await this.outbound.create(user, payload.dto, {
          skipAllocation: true,
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
    const requiredHeaders: OutboundImportCsvHeader[] = [
      'external_reference',
      'destination_address',
      'required_ship_date',
      'product_sku',
      'requested_quantity',
    ];
    for (const h of requiredHeaders) {
      if (indexByHeader[h] == null) {
        throw new BadRequestException(`Missing required CSV column: ${h}.`);
      }
    }

    const dataRows = table.slice(1);
    if (dataRows.length > OUTBOUND_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `CSV has ${dataRows.length} data rows; maximum is ${OUTBOUND_IMPORT_MAX_ROWS}.`,
      );
    }

    const groups = new Map<string, ParsedOrderGroup>();
    dataRows.forEach((cells, idx) => {
      const rowNumber = idx + 2;
      const externalReference = cell(cells, indexByHeader, 'external_reference');
      const companyIdRaw = cell(cells, indexByHeader, 'company_id');
      const sku = cell(cells, indexByHeader, 'product_sku');
      const requestedQuantity = cell(cells, indexByHeader, 'requested_quantity');
      const key = `${companyIdRaw.trim().toLowerCase()}::${externalReference.trim().toLowerCase()}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          externalReference,
          companyIdRaw,
          sourceRowNumbers: [],
          headerRow: rowNumber,
          fields: {
            destination_address: cell(cells, indexByHeader, 'destination_address'),
            required_ship_date: cell(cells, indexByHeader, 'required_ship_date'),
            carrier: cell(cells, indexByHeader, 'carrier'),
            client_reference: cell(cells, indexByHeader, 'client_reference'),
            notes: cell(cells, indexByHeader, 'notes'),
            requires_packing: cell(cells, indexByHeader, 'requires_packing'),
          },
          lines: [],
        };
        groups.set(key, group);
      }
      group.sourceRowNumbers.push(rowNumber);
      group.lines.push({ sku, requestedQuantity, rowNumber });
    });

    if (groups.size > OUTBOUND_IMPORT_MAX_ORDERS) {
      throw new BadRequestException(
        `CSV has ${groups.size} orders; maximum is ${OUTBOUND_IMPORT_MAX_ORDERS}.`,
      );
    }

    return { totalRows: dataRows.length, groups: [...groups.values()] };
  }

  private async validateGroups(
    user: AuthPrincipal,
    groups: ParsedOrderGroup[],
    totalRows: number,
  ): Promise<OutboundImportValidateResult> {
    const batchId = randomUUID();
    const errors: OutboundImportRowError[] = [];
    const duplicateInFile = 0;
    let duplicateInDb = 0;
    const validPayloads: NonNullable<OutboundImportValidateResult['_validPayloads']> = [];

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
        companyId = this.outbound.resolveImportCompanyId(user, g.companyIdRaw || undefined);
      } catch (err) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: err instanceof Error ? err.message : 'Invalid company_id.',
        });
        continue;
      }

      const existing = await this.outbound.findByExternalReference(user, companyId, ref);
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

      const products = await this.outbound.findProductsBySkus(companyId, skus);
      const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
      const lineDtos: CreateOutboundOrderDto['lines'] = [];
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
        const qty = Number(line.requestedQuantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: `Invalid requested_quantity "${line.requestedQuantity}" for product "${sku}".`,
          });
          lineFailed = true;
          continue;
        }
        lineDtos.push({
          productId: product.id,
          requestedQuantity: qty,
        });
      }
      if (lineFailed || lineDtos.length === 0) continue;

      let requiresPacking: boolean | undefined;
      try {
        requiresPacking = parseRequiresPacking(g.fields.requires_packing);
      } catch (err) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: err instanceof Error ? err.message : 'Invalid requires_packing.',
        });
        continue;
      }

      const plain = {
        companyId,
        destinationAddress: g.fields.destination_address,
        requiredShipDate: g.fields.required_ship_date,
        carrier: g.fields.carrier || undefined,
        clientReference: g.fields.client_reference || undefined,
        notes: g.fields.notes || undefined,
        requiresPacking,
        externalReference: ref,
        executionMode: 'workers' as const,
        shippingMethod: ShippingMethod.manual,
        lines: lineDtos,
      };

      const dto = plainToInstance(CreateOutboundOrderDto, plain);
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
        await this.outbound.assertImportCreateReady(user, dto);
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
