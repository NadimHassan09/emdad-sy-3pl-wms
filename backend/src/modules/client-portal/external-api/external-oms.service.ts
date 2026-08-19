import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { bboxCentroid } from '../../shipping/geo-polygon.util';
import { ShippingGeoService } from '../../shipping/shipping-geo.service';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { throwApiValidation } from './api-validation';
import { ExternalCreateOmsOrderDto } from './dto/external-create-oms-order.dto';
import { publicOmsOrder } from './public-order.serialize';
import { resolveSyriaAddress } from './syria-address';

@Injectable()
export class ExternalOmsService {
  constructor(
    private readonly oms: ClientOmsOrdersService,
    private readonly geo: ShippingGeoService,
  ) {}

  async create(client: ClientPrincipal, dto: ExternalCreateOmsOrderDto) {
    const externalOrderId = dto.externalOrderId.trim();
    const existing = await this.oms.findByExternalReference(client, externalOrderId);
    if (existing) {
      const order = await this.oms.findOne(client, existing.id);
      return { ...publicOmsOrder(order), idempotentReplay: true };
    }

    const address = resolveSyriaAddress(dto.address);
    if (!address.ok) {
      throwApiValidation('Delivery address is invalid.', address.fields);
    }

    const coords = await this.resolveCoordinates(address.value);
    const products = await this.oms.resolveSkus(
      client.companyId,
      dto.lines.map((l) => l.sku),
    );

    try {
      const created = await this.oms.createFromApi(client, {
        requiredShipDate: dto.requiredShipDate,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        shippingPhoneCountry: dto.shippingPhoneCountry,
        city: address.value.governorate,
        district: address.value.city,
        addressLine1: address.value.neighborhood ?? undefined,
        addressLine2: address.value.street ?? undefined,
        notes: dto.notes,
        storeChannel: dto.storeChannel,
        paymentMethod: dto.paymentMethod,
        currency: dto.currency ?? 'USD',
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
