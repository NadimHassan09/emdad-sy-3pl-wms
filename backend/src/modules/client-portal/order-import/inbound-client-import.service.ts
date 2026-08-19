import { Injectable } from '@nestjs/common';
import { InboundSourceType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { calendarTodayYmdServerLocal } from '../../../common/utils/order-planning-date';
import { ClientInboundOrdersService } from '../inbound/client-inbound-orders.service';
import { InboundService } from '../../inbound/inbound.service';
import {
  getInboundClientImportTemplate,
  INBOUND_CLIENT_IMPORT_ALIASES,
  INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS,
  INBOUND_ORDER_LEVEL_FIELDS,
} from './inbound-client-import.schema';
import {
  assertImportTable,
  groupRowsByOrderNumber,
} from './order-import.grouping';
import type { ClientOrderImportSummary, ImportRowError } from './order-import.types';
import { parseFlexibleDate, parseSpreadsheetTable } from './spreadsheet.parse';

const SOURCE_TYPES = new Set<string>(Object.values(InboundSourceType));

function parsePositiveQty(raw: string): number | null {
  const n = Number(String(raw).trim().replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

@Injectable()
export class InboundClientImportService {
  constructor(
    private readonly clientInbound: ClientInboundOrdersService,
    private readonly inbound: InboundService,
  ) {}

  getImportTemplate() {
    return getInboundClientImportTemplate();
  }

  async importFile(
    client: ClientPrincipal,
    fileBuffer: Buffer,
    originalName?: string,
  ): Promise<ClientOrderImportSummary> {
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
    const products = await this.inbound.findProductsBySkus(client.companyId, allSkus);
    const skuToProduct = new Map(products.map((p) => [p.sku.trim().toUpperCase(), p]));

    for (const group of groups) {
      const firstRow = group.rowNumbers[0] ?? 0;
      const orderNumber = group.orderNumber.trim();
      const pushErr = (error: string, field?: string, rowNumber = firstRow) => {
        errors.push({
          rowNumber,
          orderNumber: orderNumber || null,
          error,
          field: field ?? null,
        });
      };

      if (!orderNumber || group.conflict?.field === 'order_number') {
        invalid++;
        pushErr('Order number is required.', 'order_number');
        continue;
      }
      if (group.conflict) {
        invalid++;
        pushErr(group.conflict.error, group.conflict.field);
        continue;
      }

      const existing = await this.clientInbound.findByExternalReference(client, orderNumber);
      if (existing) {
        duplicate++;
        pushErr(`Duplicate order reference. Already exists as ${existing.orderNumber}.`, 'order_number');
        continue;
      }

      const arrival = parseFlexibleDate(group.fields.expected_arrival_date ?? '');
      if (!arrival) {
        invalid++;
        pushErr('Expected arrival date is required (YYYY-MM-DD).', 'expected_arrival_date');
        continue;
      }
      if (arrival < calendarTodayYmdServerLocal()) {
        invalid++;
        pushErr('Expected arrival date cannot be before today.', 'expected_arrival_date');
        continue;
      }

      const sourceRaw = (group.fields.source_type ?? '').trim();
      let sourceType: InboundSourceType | undefined;
      if (sourceRaw) {
        const lower = sourceRaw.toLowerCase();
        if (!SOURCE_TYPES.has(lower)) {
          invalid++;
          pushErr('Source type must be purchase, return, or transfer.', 'source_type');
          continue;
        }
        sourceType = lower as InboundSourceType;
      }

      const lines: Array<{
        productId: string;
        expectedQuantity: number;
        expectedLotNumber?: string;
        expectedExpiryDate?: string;
      }> = [];
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
        const qty = parsePositiveQty(line.values.expected_quantity ?? '');
        if (qty == null) {
          invalid++;
          pushErr('Expected quantity must be greater than 0.', 'expected_quantity', line.rowNumber);
          lineInvalid = true;
          break;
        }
        const expiryRaw = line.values.expected_expiry_date?.trim() ?? '';
        const expiry = expiryRaw ? parseFlexibleDate(expiryRaw) : undefined;
        if (expiryRaw && !expiry) {
          invalid++;
          pushErr('Expected expiry date must be YYYY-MM-DD.', 'expected_expiry_date', line.rowNumber);
          lineInvalid = true;
          break;
        }
        lines.push({
          productId: product.id,
          expectedQuantity: qty,
          expectedLotNumber: line.values.expected_lot_number?.trim() || undefined,
          expectedExpiryDate: expiry || undefined,
        });
      }
      if (lineInvalid) continue;
      if (lines.length === 0) {
        invalid++;
        pushErr('Order must contain at least one product line.', 'sku');
        continue;
      }

      try {
        const createdOrder = await this.clientInbound.create(client, {
          expectedArrivalDate: arrival,
          notes: group.fields.notes || undefined,
          sourceType,
          externalReference: orderNumber,
          clientReference: orderNumber,
          lines,
        });
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
