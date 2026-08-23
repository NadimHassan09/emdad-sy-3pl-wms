import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { calendarTodayYmdServerLocal } from '../../../common/utils/order-planning-date';
import { InboundService } from '../../inbound/inbound.service';
import {
  getInboundClientImportTemplate,
  INBOUND_CLIENT_IMPORT_ALIASES,
  INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS,
  INBOUND_ORDER_LEVEL_FIELDS,
} from './inbound-client-import.schema';
import {
  parseImportMdYDate,
  validateImportAsciiPositiveInt,
  validateImportOrderNumber,
} from './oms-client-import.validation';
import {
  assertImportTable,
  groupRowsByOrderNumber,
} from './order-import.grouping';
import type { ClientOrderImportSummary, ImportRowError } from './order-import.types';
import { parseSpreadsheetTable } from './spreadsheet.parse';

@Injectable()
export class InboundClientImportService {
  constructor(private readonly inbound: InboundService) {}

  getImportTemplate() {
    return getInboundClientImportTemplate();
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
    const companyId = this.inbound.resolveImportCompanyId(user, companyIdRaw);
    const table = parseSpreadsheetTable(fileBuffer, originalName);
    const { dataRows } = assertImportTable(
      table,
      INBOUND_CLIENT_IMPORT_ALIASES,
      INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS,
    );
    const groups = groupRowsByOrderNumber(
      dataRows,
      'order_number',
      INBOUND_ORDER_LEVEL_FIELDS,
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
    const products = await this.inbound.findProductsBySkus(companyId, allSkus);
    const skuToProduct = new Map(products.map((p) => [p.sku.trim().toUpperCase(), p]));

    for (const group of groups) {
      const firstRow = group.rowNumbers[0] ?? 0;
      const pushErr = (error: string, field?: string, rowNumber = firstRow) => {
        errors.push({
          rowNumber,
          orderNumber: group.orderNumber.trim() || null,
          error,
          field: field ?? null,
        });
      };

      const orderNumberResult = validateImportOrderNumber(group.orderNumber);
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

      const existing = await this.inbound.findByExternalReference(user, companyId, orderNumber);
      if (existing) {
        duplicate++;
        pushErr(
          `Duplicate order reference. Already exists as ${existing.orderNumber}.`,
          'order_number',
        );
        continue;
      }

      const arrivalResult = parseImportMdYDate(
        group.fields.expected_arrival_date ?? '',
        'Expected arrival date',
      );
      if (!arrivalResult.ok) {
        invalid++;
        pushErr(arrivalResult.message, 'expected_arrival_date');
        continue;
      }
      if (arrivalResult.ymd < calendarTodayYmdServerLocal()) {
        invalid++;
        pushErr('Expected arrival date cannot be before today.', 'expected_arrival_date');
        continue;
      }

      const lines: Array<{ productId: string; expectedQuantity: number }> = [];
      const seenProductIds = new Set<string>();
      let lineInvalid = false;
      for (const line of group.lines) {
        // product_name is documentation-only — intentionally ignored.
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
          pushErr(
            `Unknown SKU "${sku}". SKU must match a product registered for your company exactly.`,
            'sku',
            line.rowNumber,
          );
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

        const qtyResult = validateImportAsciiPositiveInt(line.values.quantity ?? '', 'Quantity');
        if (!qtyResult.ok) {
          invalid++;
          pushErr(qtyResult.message, 'quantity', line.rowNumber);
          lineInvalid = true;
          break;
        }

        lines.push({
          productId: product.id,
          expectedQuantity: qtyResult.value,
        });
      }
      if (lineInvalid) continue;
      if (lines.length === 0) {
        invalid++;
        pushErr('Order must contain at least one product line.', 'sku');
        continue;
      }

      try {
        // Same create path as /inbound-orders/new (pending client approval / waiting flow).
        const createdOrder = await this.inbound.create(
          user,
          {
            companyId,
            expectedArrivalDate: arrivalResult.ymd,
            notes: group.fields.notes?.trim() || undefined,
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
