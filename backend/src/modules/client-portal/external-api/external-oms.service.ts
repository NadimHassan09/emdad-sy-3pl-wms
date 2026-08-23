import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { calendarTodayYmdServerLocal } from '../../../common/utils/order-planning-date';
import { bboxCentroid } from '../../shipping/geo-polygon.util';
import { ShippingGeoService } from '../../shipping/shipping-geo.service';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { ListClientOmsOrdersQueryDto } from '../oms/dto/list-client-oms-orders-query.dto';
import {
  parseImportMdYDate,
  validateImportCountryCode,
  validateImportOrderNumber,
  validateImportRecipientName,
  validateImportRecipientPhone,
} from '../order-import/oms-client-import.validation';
import { throwApiValidation } from './api-validation';
import { ExternalCreateOmsOrderDto } from './dto/external-create-oms-order.dto';
import {
  isUuidLike,
  publicOmsOrder,
  publicOmsOrderListItem,
} from './public-order.serialize';
import { resolveSyriaAddress } from './syria-address';

function parseApiShipDate(raw: string): { ok: true; ymd: string } | { ok: false; message: string } {
  const t = raw.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(t);
  if (iso) {
    const ymd = iso[1]!;
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== m! - 1 ||
      dt.getUTCDate() !== d
    ) {
      return { ok: false, message: 'requiredShipDate is not a valid calendar date.' };
    }
    return { ok: true, ymd };
  }
  return parseImportMdYDate(t, 'requiredShipDate');
}

@Injectable()
export class ExternalOmsService {
  constructor(
    private readonly oms: ClientOmsOrdersService,
    private readonly geo: ShippingGeoService,
  ) {}

  async create(client: ClientPrincipal, dto: ExternalCreateOmsOrderDto) {
    const orderNumberResult = validateImportOrderNumber(dto.externalOrderId);
    if (!orderNumberResult.ok) {
      throwApiValidation('Order payload is invalid.', {
        externalOrderId: orderNumberResult.message,
      });
    }
    const externalOrderId = orderNumberResult.value;

    const existing = await this.oms.findByExternalReference(client, externalOrderId);
    if (existing) {
      const order = await this.oms.findOne(client, existing.id);
      return { ...publicOmsOrder(order), idempotentReplay: true };
    }

    const shipDate = parseApiShipDate(dto.requiredShipDate);
    if (!shipDate.ok) {
      throwApiValidation('Order payload is invalid.', {
        requiredShipDate: shipDate.message,
      });
    }
    if (shipDate.ymd < calendarTodayYmdServerLocal()) {
      throwApiValidation('Order payload is invalid.', {
        requiredShipDate: 'requiredShipDate cannot be before today.',
      });
    }

    const nameResult = validateImportRecipientName(dto.recipientName);
    if (!nameResult.ok) {
      throwApiValidation('Order payload is invalid.', {
        recipientName: nameResult.message,
      });
    }

    const countryResult = validateImportCountryCode(dto.countryCode);
    if (!countryResult.ok) {
      throwApiValidation('Order payload is invalid.', {
        countryCode: countryResult.message,
      });
    }

    const phoneResult = validateImportRecipientPhone(
      dto.recipientPhone,
      countryResult.iso,
    );
    if (!phoneResult.ok) {
      throwApiValidation('Order payload is invalid.', {
        recipientPhone: phoneResult.message,
      });
    }

    if (!dto.address?.neighborhood?.trim()) {
      throwApiValidation('Order payload is incomplete.', {
        'address.neighborhood': 'Neighborhood is required.',
      });
    }

    const address = resolveSyriaAddress({
      governorate: dto.address.governorate,
      city: dto.address.city,
      neighborhood: dto.address.neighborhood,
      street: dto.address.street,
    });
    if (!address.ok) {
      throwApiValidation('Delivery address is invalid.', address.fields);
    }
    if (!address.value.neighborhood?.trim()) {
      throwApiValidation('Order payload is incomplete.', {
        'address.neighborhood':
          'Neighborhood is required and must match the Client Portal address list (Arabic).',
      });
    }

    const coords = await this.resolveCoordinates({
      governorate: address.value.governorate,
      city: address.value.city,
      neighborhood: address.value.neighborhood,
    });

    const products = await this.oms.resolveSkus(
      client.companyId,
      dto.lines.map((l) => l.sku),
    );

    const seenSkus = new Set<string>();
    for (const line of dto.lines) {
      const skuKey = line.sku.trim().toUpperCase();
      if (seenSkus.has(skuKey)) {
        throwApiValidation('Order payload is invalid.', {
          sku: `Duplicate SKU "${line.sku}" in the same order. Each product can only appear once.`,
        });
      }
      seenSkus.add(skuKey);
      if (line.unitPrice == null || !Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
        throwApiValidation('Order payload is incomplete.', {
          unitPrice: 'Unit price is required and must be a whole number ≥ 0.',
        });
      }
    }

    try {
      const created = await this.oms.createFromApi(client, {
        requiredShipDate: shipDate.ymd,
        recipientName: nameResult.value,
        recipientPhone: phoneResult.e164,
        shippingPhoneCountry: phoneResult.shippingPhoneCountry,
        city: address.value.governorate,
        district: address.value.city,
        addressLine1: address.value.neighborhood,
        addressLine2: address.value.street ?? undefined,
        notes: dto.notes,
        storeChannel: dto.storeChannel,
        paymentMethod: dto.paymentMethod,
        currency: 'USD',
        externalReference: externalOrderId,
        clientReference: externalOrderId,
        shippingReceiverLat: coords.lat,
        shippingReceiverLng: coords.lng,
        lines: dto.lines.map((l) => ({
          productId: products.get(l.sku.trim().toUpperCase())!,
          requestedQuantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      // Programmatic create = confirmed (same as successful CSV import path intent for integrations).
      const confirmed = await this.oms.confirm(client, created.id);
      return { ...publicOmsOrder(confirmed), idempotentReplay: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.oms.findByExternalReference(client, externalOrderId);
        if (again) {
          const order = await this.oms.findOne(client, again.id);
          return { ...publicOmsOrder(order), idempotentReplay: true };
        }
      }
      throw err;
    }
  }

  async list(client: ClientPrincipal, query: ListClientOmsOrdersQueryDto) {
    const page = await this.oms.list(client, query);
    return {
      items: page.items.map((row) => publicOmsOrderListItem(row as never)),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.oms.findOne(client, id);
    return publicOmsOrder(order);
  }

  async findByExternalOrderId(client: ClientPrincipal, externalOrderId: string) {
    const existing = await this.oms.findByExternalReference(client, externalOrderId.trim());
    if (!existing) return null;
    const order = await this.oms.findOne(client, existing.id);
    return publicOmsOrder(order);
  }

  async findByOrderNumber(client: ClientPrincipal, orderNumber: string) {
    const existing = await this.oms.findByOrderNumber(client, orderNumber.trim());
    if (!existing) return null;
    const order = await this.oms.findOne(client, existing.id);
    return publicOmsOrder(order);
  }

  /** Single-mode lookup: UUID id, portal orderNumber, or externalOrderId. */
  async findOneByLookup(
    client: ClientPrincipal,
    lookup: { idOrNumber?: string; orderNumber?: string; externalOrderId?: string },
  ) {
    const orderNumber = lookup.orderNumber?.trim() || undefined;
    const externalOrderId = lookup.externalOrderId?.trim() || undefined;
    const idOrNumber = lookup.idOrNumber?.trim() || undefined;

    if (idOrNumber && isUuidLike(idOrNumber)) {
      try {
        return await this.findOne(client, idOrNumber);
      } catch (err) {
        if (!(err instanceof NotFoundException)) throw err;
      }
    }

    const numberKey = orderNumber || (idOrNumber && !isUuidLike(idOrNumber) ? idOrNumber : undefined);
    if (numberKey) {
      const byNumber = await this.findByOrderNumber(client, numberKey);
      if (byNumber) return byNumber;
    }

    if (externalOrderId) {
      const byExt = await this.findByExternalOrderId(client, externalOrderId);
      if (byExt) return byExt;
    }

    if (idOrNumber && !isUuidLike(idOrNumber) && !orderNumber) {
      const byExt = await this.findByExternalOrderId(client, idOrNumber);
      if (byExt) return byExt;
    }

    return null;
  }

  private async resolveCoordinates(address: {
    governorate: string;
    city: string;
    neighborhood: string | null;
  }) {
    const boundary = await this.geo.lookupBoundary({
      governorate: address.governorate,
      city: address.city,
      neighborhood: address.neighborhood,
    });
    if (!boundary) {
      throwApiValidation('The delivery address could not be resolved to map coordinates.', {
        address: 'Could not geocode this governorate/city. Check the spelling and try again.',
      });
    }
    let point = bboxCentroid(boundary.bbox);
    if (!this.geo.containsPoint(boundary, point)) {
      point = {
        lat: boundary.bbox.south + (boundary.bbox.north - boundary.bbox.south) * 0.35,
        lng: boundary.bbox.west + (boundary.bbox.east - boundary.bbox.west) * 0.5,
      };
    }
    if (!this.geo.containsPoint(boundary, point)) {
      throwApiValidation('The delivery address could not be resolved to valid map coordinates.', {
        address: 'Resolved area did not produce a point inside the delivery boundary.',
      });
    }
    return point;
  }
}
