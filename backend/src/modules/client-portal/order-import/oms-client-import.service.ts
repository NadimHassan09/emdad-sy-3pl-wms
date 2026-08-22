import { Injectable } from '@nestjs/common';
import { OmsPaymentMethod, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { calendarTodayYmdServerLocal } from '../../../common/utils/order-planning-date';
import { normalizeRecipientContact } from '../../../common/validators/recipient-contact';
import { CreateOmsOrderDto } from '../../oms/dto/oms-order.dto';
import { resolveOmsDeliveryLocation } from '../../oms/oms-delivery-resolution';
import { OmsOrdersService } from '../../oms/oms-orders.service';
import { ShippingGeoService } from '../../shipping/shipping-geo.service';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import {
  applyAdminCityCompatibility,
  getOmsClientImportTemplate,
  OMS_CLIENT_IMPORT_ALIASES,
  OMS_CLIENT_IMPORT_REQUIRED_COLUMNS,
  OMS_ORDER_LEVEL_FIELDS,
} from './oms-client-import.schema';
import {
  assertImportTable,
  groupRowsByOrderNumber,
} from './order-import.grouping';
import type { ClientOrderImportSummary, ImportRowError } from './order-import.types';
import { parseFlexibleDate, parseSpreadsheetTable } from './spreadsheet.parse';

const PAYMENT_METHODS = new Set<string>(Object.values(OmsPaymentMethod));

function parsePositiveInt(raw: string): number | null {
  const n = Number(String(raw).trim().replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function parseNonNegativeNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

@Injectable()
export class OmsClientImportService {
  constructor(
    private readonly clientOms: ClientOmsOrdersService,
    private readonly omsOrders: OmsOrdersService,
    private readonly geo: ShippingGeoService,
  ) {}

  getImportTemplate() {
    return getOmsClientImportTemplate();
  }

  async importFile(
    client: ClientPrincipal,
    fileBuffer: Buffer,
    originalName?: string,
  ): Promise<ClientOrderImportSummary> {
    const table = parseSpreadsheetTable(fileBuffer, originalName);
    const { dataRows } = assertImportTable(
      table,
      OMS_CLIENT_IMPORT_ALIASES,
      OMS_CLIENT_IMPORT_REQUIRED_COLUMNS,
    );
    const groups = groupRowsByOrderNumber(dataRows, 'order_number', OMS_ORDER_LEVEL_FIELDS);
    const batchId = randomUUID();
    const user = clientAuthPrincipal(client);
    const errors: ImportRowError[] = [];
    const createdOrderNumbers: string[] = [];
    const incompleteOrderNumbers: string[] = [];
    let created = 0;
    let incomplete = 0;
    let invalid = 0;
    let duplicate = 0;

    const allSkus = Array.from(
      new Set(
        dataRows
          .map((r) => r.values.sku?.trim().toUpperCase())
          .filter((s): s is string => !!s),
      ),
    );
    const products = await this.omsOrders.findProductsBySkus(client.companyId, allSkus);
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

      applyAdminCityCompatibility(group.fields);

      const existing = await this.clientOms.findByExternalReference(client, orderNumber);
      if (existing) {
        duplicate++;
        pushErr(`Duplicate order reference. Already exists as ${existing.orderNumber}.`, 'order_number');
        continue;
      }

      const lines: Array<{
        productId: string;
        requestedQuantity: number;
        unitPrice?: number;
        rowNumber: number;
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
        const qty = parsePositiveInt(line.values.quantity ?? '');
        if (qty == null) {
          invalid++;
          pushErr('Quantity must be a whole number greater than 0.', 'quantity', line.rowNumber);
          lineInvalid = true;
          break;
        }
        const unitPriceRaw = line.values.unit_price?.trim() ?? '';
        const unitPrice = unitPriceRaw ? parseNonNegativeNumber(unitPriceRaw) : undefined;
        if (unitPriceRaw && unitPrice == null) {
          invalid++;
          pushErr('Unit price must be a number greater than or equal to 0.', 'unit_price', line.rowNumber);
          lineInvalid = true;
          break;
        }
        lines.push({
          productId: product.id,
          requestedQuantity: qty,
          unitPrice: unitPrice ?? undefined,
          rowNumber: line.rowNumber,
        });
      }
      if (lineInvalid) continue;
      if (lines.length === 0) {
        invalid++;
        pushErr('Order must contain at least one product line.', 'sku');
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

      const paymentRaw = (group.fields.payment_method ?? '').trim();
      let paymentMethod: OmsPaymentMethod | undefined;
      if (paymentRaw) {
        const upper = paymentRaw.toUpperCase();
        if (!PAYMENT_METHODS.has(upper)) {
          invalid++;
          pushErr('Payment method must be COD, PREPAID, or CREDIT.', 'payment_method');
          continue;
        }
        paymentMethod = upper as OmsPaymentMethod;
      }

      const contact = normalizeRecipientContact({
        recipientName: group.fields.recipient_name || undefined,
        recipientPhone: group.fields.recipient_phone || undefined,
      });
      if (!contact.ok) {
        invalid++;
        pushErr(contact.message, contact.field);
        continue;
      }

      const delivery = await resolveOmsDeliveryLocation(this.geo, {
        governorate: group.fields.governorate,
        city: group.fields.city,
        neighborhood: group.fields.neighborhood,
        street: group.fields.street,
      });
      const needsInformation = !delivery.complete;
      if (needsInformation) {
        for (const [field, message] of Object.entries(delivery.reasons)) {
          pushErr(message, field);
        }
        if (Object.keys(delivery.reasons).length === 0) {
          pushErr('Shipping/Delivery information is incomplete.', 'address');
        }
      }

      const payload: CreateOmsOrderDto = {
        companyId: client.companyId,
        requiredShipDate: shipDate,
        recipientName: contact.value.recipientName ?? group.fields.recipient_name,
        recipientPhone: contact.value.recipientPhone ?? group.fields.recipient_phone,
        shippingPhoneCountry: contact.value.shippingPhoneCountry ?? undefined,
        city: delivery.city ?? (group.fields.governorate || undefined),
        district: delivery.district ?? (group.fields.city || undefined),
        addressLine1: delivery.addressLine1 ?? (group.fields.neighborhood || undefined),
        addressLine2: delivery.addressLine2 ?? (group.fields.street || undefined),
        notes: group.fields.notes || undefined,
        storeChannel: group.fields.store_channel || undefined,
        paymentMethod,
        currency: group.fields.currency?.trim() || 'USD',
        externalReference: orderNumber,
        clientReference: orderNumber,
        shippingReceiverLat: delivery.lat ?? undefined,
        shippingReceiverLng: delivery.lng ?? undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          requestedQuantity: l.requestedQuantity,
          unitPrice: l.unitPrice,
          lineTotal:
            l.unitPrice != null ? l.unitPrice * l.requestedQuantity : undefined,
        })),
      };

      try {
        const createdOrder = await this.omsOrders.create(user, payload, {
          provisionOutbound: false,
          bulkImport: { batchId, externalReference: orderNumber },
          needsInformation,
        });
        if (needsInformation) {
          incomplete++;
          incompleteOrderNumbers.push(createdOrder.orderNumber);
        } else {
          created++;
          createdOrderNumbers.push(createdOrder.orderNumber);
        }
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
      incomplete,
      invalid,
      duplicate,
      createdOrderNumbers,
      incompleteOrderNumbers,
      errors,
    };
  }
}
