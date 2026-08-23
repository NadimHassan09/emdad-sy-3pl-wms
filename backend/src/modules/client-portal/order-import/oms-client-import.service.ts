import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { calendarTodayYmdServerLocal } from '../../../common/utils/order-planning-date';
import { CreateOmsOrderDto } from '../../oms/dto/oms-order.dto';
import { resolveOmsDeliveryLocation } from '../../oms/oms-delivery-resolution';
import { OmsOrdersService } from '../../oms/oms-orders.service';
import { ShippingGeoService } from '../../shipping/shipping-geo.service';
import {
  applyAdminCityCompatibility,
  getOmsClientImportTemplate,
  OMS_CLIENT_IMPORT_ALIASES,
  OMS_CLIENT_IMPORT_REQUIRED_COLUMNS,
  OMS_ORDER_LEVEL_FIELDS,
} from './oms-client-import.schema';
import {
  parseImportShipDateMdY,
  validateImportAsciiNonNegativeInt,
  validateImportAsciiPositiveInt,
  validateImportCountryCode,
  validateImportOrderNumber,
  validateImportPaymentMethod,
  validateImportRecipientName,
  validateImportRecipientPhone,
} from './oms-client-import.validation';
import {
  assertImportTable,
  groupRowsByOrderNumber,
} from './order-import.grouping';
import type { ClientOrderImportSummary, ImportRowError } from './order-import.types';
import { parseSpreadsheetTable } from './spreadsheet.parse';

@Injectable()
export class OmsClientImportService {
  constructor(
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
    const companyId = this.omsOrders.resolveImportCompanyId(user, companyIdRaw);
    const table = parseSpreadsheetTable(fileBuffer, originalName);
    const { dataRows } = assertImportTable(
      table,
      OMS_CLIENT_IMPORT_ALIASES,
      OMS_CLIENT_IMPORT_REQUIRED_COLUMNS,
    );
    const groups = groupRowsByOrderNumber(dataRows, 'order_number', OMS_ORDER_LEVEL_FIELDS);
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
    const products = await this.omsOrders.findProductsBySkus(companyId, allSkus);
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

      applyAdminCityCompatibility(group.fields);

      const existing = await this.omsOrders.findExistingByExternalReference(user, companyId, orderNumber);
      if (existing) {
        duplicate++;
        pushErr(
          `Duplicate order reference. Already exists as ${existing.orderNumber}.`,
          'order_number',
        );
        continue;
      }

      const shipDateResult = parseImportShipDateMdY(group.fields.required_ship_date ?? '');
      if (!shipDateResult.ok) {
        invalid++;
        pushErr(shipDateResult.message, 'required_ship_date');
        continue;
      }
      if (shipDateResult.ymd < calendarTodayYmdServerLocal()) {
        invalid++;
        pushErr('Required ship date cannot be before today.', 'required_ship_date');
        continue;
      }

      const nameResult = validateImportRecipientName(group.fields.recipient_name ?? '');
      if (!nameResult.ok) {
        invalid++;
        pushErr(nameResult.message, 'recipient_name');
        continue;
      }

      const countryResult = validateImportCountryCode(group.fields.country_code ?? '');
      if (!countryResult.ok) {
        invalid++;
        pushErr(countryResult.message, 'country_code');
        continue;
      }

      const phoneResult = validateImportRecipientPhone(
        group.fields.recipient_phone ?? '',
        countryResult.iso,
      );
      if (!phoneResult.ok) {
        invalid++;
        pushErr(phoneResult.message, 'recipient_phone');
        continue;
      }

      const paymentResult = validateImportPaymentMethod(group.fields.payment_method ?? '');
      if (!paymentResult.ok) {
        invalid++;
        pushErr(paymentResult.message, 'payment_method');
        continue;
      }

      if (!(group.fields.governorate ?? '').trim()) {
        invalid++;
        pushErr('Governorate is required.', 'governorate');
        continue;
      }
      if (!(group.fields.city ?? '').trim()) {
        invalid++;
        pushErr('City is required.', 'city');
        continue;
      }
      if (!(group.fields.neighborhood ?? '').trim()) {
        invalid++;
        pushErr('Neighborhood is required.', 'neighborhood');
        continue;
      }

      const delivery = await resolveOmsDeliveryLocation(this.geo, {
        governorate: group.fields.governorate,
        city: group.fields.city,
        neighborhood: group.fields.neighborhood,
        street: group.fields.street,
      });
      if (!delivery.complete || !delivery.city || !delivery.district || !delivery.addressLine1) {
        invalid++;
        const reasonEntries = Object.entries(delivery.reasons);
        if (reasonEntries.length === 0) {
          pushErr(
            'Governorate, city, and neighborhood must match the system address list exactly (Arabic).',
            'address',
          );
        } else {
          for (const [field, message] of reasonEntries) {
            pushErr(message, field);
          }
        }
        continue;
      }

      const lines: Array<{
        productId: string;
        requestedQuantity: number;
        unitPrice: number;
        rowNumber: number;
      }> = [];
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
        if (!product || product.sku.trim().toUpperCase() !== sku.toUpperCase()) {
          invalid++;
          pushErr(
            `Unknown SKU "${sku}". SKU must match a product registered for your company exactly.`,
            'sku',
            line.rowNumber,
          );
          lineInvalid = true;
          break;
        }
        // Require exact SKU casing as stored? User said "كما هو مسجل" — case-insensitive match is OK for lookup;
        // product is found from DB. Keep case-insensitive SKU match like before.

        const qtyResult = validateImportAsciiPositiveInt(line.values.quantity ?? '', 'Quantity');
        if (!qtyResult.ok) {
          invalid++;
          pushErr(qtyResult.message, 'quantity', line.rowNumber);
          lineInvalid = true;
          break;
        }
        const priceResult = validateImportAsciiNonNegativeInt(
          line.values.unit_price ?? '',
          'Unit price',
        );
        if (!priceResult.ok) {
          invalid++;
          pushErr(priceResult.message, 'unit_price', line.rowNumber);
          lineInvalid = true;
          break;
        }
        lines.push({
          productId: product.id,
          requestedQuantity: qtyResult.value,
          unitPrice: priceResult.value,
          rowNumber: line.rowNumber,
        });
      }
      if (lineInvalid) continue;
      if (lines.length === 0) {
        invalid++;
        pushErr('Order must contain at least one product line.', 'sku');
        continue;
      }

      const payload: CreateOmsOrderDto = {
        companyId,
        requiredShipDate: shipDateResult.ymd,
        recipientName: nameResult.value,
        recipientPhone: phoneResult.e164,
        shippingPhoneCountry: phoneResult.shippingPhoneCountry,
        city: delivery.city,
        district: delivery.district,
        addressLine1: delivery.addressLine1,
        addressLine2: delivery.addressLine2 ?? (group.fields.street || undefined),
        notes: group.fields.notes || undefined,
        storeChannel: group.fields.store_channel || undefined,
        paymentMethod: paymentResult.value,
        currency: 'USD',
        externalReference: orderNumber,
        clientReference: orderNumber,
        shippingReceiverLat: delivery.lat ?? undefined,
        shippingReceiverLng: delivery.lng ?? undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          requestedQuantity: l.requestedQuantity,
          unitPrice: l.unitPrice,
          lineTotal: l.unitPrice * l.requestedQuantity,
        })),
      };

      try {
        // Same create path as manual /ecommerce-orders/new → waiting_for_confirmation.
        // Do NOT use bulkImport (that would create confirmed_waiting_for_admin_approval).
        // Do NOT create incomplete / needsInformation orders.
        const createdOrder = await this.omsOrders.create(user, payload, {
          provisionOutbound: false,
          needsInformation: false,
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
