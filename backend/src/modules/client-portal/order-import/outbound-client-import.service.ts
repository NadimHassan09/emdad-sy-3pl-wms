import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { calendarTodayYmdServerLocal } from '../../../common/utils/order-planning-date';
import { assertDiscreteUomPositiveIntegerQuantity } from '../../../common/utils/discrete-uom-quantity';
import { OutboundService } from '../../outbound/outbound.service';
import {
  getOutboundClientImportTemplate,
  OUTBOUND_CLIENT_IMPORT_ALIASES,
  OUTBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS,
  OUTBOUND_ORDER_LEVEL_FIELDS,
} from './outbound-client-import.schema';
import { buildOutboundImportTemplateXlsx } from './import-template-xlsx';
import {
  assertImportTable,
  groupRowsByOrderNumber,
} from './order-import.grouping';
import type { ClientOrderImportSummary, ImportRowError } from './order-import.types';
import { parseFlexibleDate, parseSpreadsheetTable } from './spreadsheet.parse';
import {
  validateImportOrderNumber,
  validateImportPositiveQuantity,
} from './oms-client-import.validation';

@Injectable()
export class OutboundClientImportService {
  constructor(private readonly outbound: OutboundService) {}

  getImportTemplate() {
    return getOutboundClientImportTemplate();
  }

  getImportTemplateXlsx() {
    return buildOutboundImportTemplateXlsx();
  }

  async importFile(
    client: ClientPrincipal,
    fileBuffer: Buffer,
    originalName?: string,
  ): Promise<ClientOrderImportSummary> {
    return this.importFileForCompany(
      clientAuthPrincipal(client),
      client.companyId,
      fileBuffer,
      originalName,
    );
  }

  async importFileForCompany(
    user: AuthPrincipal,
    companyIdRaw: string,
    fileBuffer: Buffer,
    originalName?: string,
  ): Promise<ClientOrderImportSummary> {
    const companyId = this.outbound.resolveImportCompanyId(user, companyIdRaw);
    const table = parseSpreadsheetTable(fileBuffer, originalName);
    const { dataRows } = assertImportTable(
      table,
      OUTBOUND_CLIENT_IMPORT_ALIASES,
      OUTBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS,
    );
    const groups = groupRowsByOrderNumber(
      dataRows,
      'order_number',
      OUTBOUND_ORDER_LEVEL_FIELDS,
    );
    const batchId = randomUUID();
    const errors: ImportRowError[] = [];
    const createdOrderNumbers: string[] = [];
    let created = 0;
    let invalid = 0;
    let duplicate = 0;

    const allSkus = Array.from(
      new Set(
        dataRows
          .map((r) => r.values.sku?.trim().toUpperCase())
          .filter((s): s is string => !!s),
      ),
    );
    const products = await this.outbound.findProductsBySkus(companyId, allSkus);
    const skuToProduct = new Map(products.map((p) => [p.sku.trim().toUpperCase(), p]));

    for (const group of groups) {
      const firstRow = group.rowNumbers[0] ?? 0;
      const orderNumberResult = validateImportOrderNumber(group.orderNumber);
      const pushErr = (error: string, field?: string, rowNumber = firstRow) => {
        errors.push({
          rowNumber,
          orderNumber: orderNumberResult.ok ? orderNumberResult.value : group.orderNumber?.trim() || null,
          error,
          field: field ?? null,
        });
      };

      if (!orderNumberResult.ok) {
        invalid++;
        pushErr(orderNumberResult.message, 'order_number');
        continue;
      }
      const orderNumber = orderNumberResult.value;

      if (group.conflict) {
        invalid++;
        pushErr(group.conflict.error, group.conflict.field);
        continue;
      }

      const existing = await this.outbound.findByExternalReference(user, companyId, orderNumber);
      if (existing) {
        duplicate++;
        pushErr(`Duplicate order reference. Already exists as ${existing.orderNumber}.`, 'order_number');
        continue;
      }

      const shipDate = parseFlexibleDate(group.fields.required_ship_date ?? '');
      if (!shipDate) {
        invalid++;
        pushErr('Required ship date is required (YYYY-MM-DD).', 'required_ship_date');
        continue;
      }
      if (shipDate < calendarTodayYmdServerLocal()) {
        invalid++;
        pushErr('Required ship date cannot be before today.', 'required_ship_date');
        continue;
      }

      const destination = (group.fields.destination_address ?? '').trim();
      if (!destination) {
        invalid++;
        pushErr('Destination address is required.', 'destination_address');
        continue;
      }

      const lines: Array<{ productId: string; requestedQuantity: number }> = [];
      const seenProductIds = new Set<string>();
      let lineInvalid = false;
      for (const line of group.lines) {
        const sku = line.values.sku?.trim() ?? '';
        if (!sku) {
          invalid++;
          pushErr('Product SKU is required.', 'sku', line.rowNumber);
          lineInvalid = true;
          break;
        }
        const product = skuToProduct.get(sku.toUpperCase());
        if (!product) {
          invalid++;
          pushErr(`Unknown SKU "${sku}". Product was not created.`, 'sku', line.rowNumber);
          lineInvalid = true;
          break;
        }
        if (seenProductIds.has(product.id)) {
          invalid++;
          pushErr(
            `Duplicate SKU "${sku}" in the same order. Each product can only appear once.`,
            'sku',
            line.rowNumber,
          );
          lineInvalid = true;
          break;
        }
        seenProductIds.add(product.id);

        const qtyResult = validateImportPositiveQuantity(
          line.values.requested_quantity ?? '',
          'Requested quantity',
        );
        if (!qtyResult.ok) {
          invalid++;
          pushErr(qtyResult.message, 'requested_quantity', line.rowNumber);
          lineInvalid = true;
          break;
        }
        try {
          assertDiscreteUomPositiveIntegerQuantity(
            product.uom,
            qtyResult.value,
            'Requested quantity',
          );
        } catch (err: unknown) {
          invalid++;
          const msg = err instanceof Error ? err.message : 'Invalid quantity for product UOM.';
          pushErr(msg, 'requested_quantity', line.rowNumber);
          lineInvalid = true;
          break;
        }
        lines.push({ productId: product.id, requestedQuantity: qtyResult.value });
      }
      if (lineInvalid) continue;
      if (lines.length === 0) {
        invalid++;
        pushErr('Order must contain at least one product line.', 'sku');
        continue;
      }

      try {
        const createdOrder = await this.outbound.create(
          user,
          {
            companyId,
            destinationAddress: destination,
            requiredShipDate: shipDate,
            notes: group.fields.notes || undefined,
            externalReference: orderNumber,
            clientReference: orderNumber,
            lines,
            executionMode: 'admin',
            executionPlan: undefined,
          },
          { pendingClientApproval: true },
        );
        created++;
        createdOrderNumbers.push(createdOrder.orderNumber);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          duplicate++;
          pushErr('Duplicate order reference.', 'order_number');
          continue;
        }
        invalid++;
        pushErr(err instanceof Error ? err.message : 'Create failed.');
      }
    }

    return {
      batchId,
      totalRows: dataRows.length,
      ordersDetected: groups.length,
      created,
      incomplete: 0,
      invalid,
      duplicate,
      createdOrderNumbers,
      incompleteOrderNumbers: [],
      errors,
    };
  }
}
