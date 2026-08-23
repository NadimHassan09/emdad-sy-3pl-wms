import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { ClientOutboundOrdersService } from '../outbound/client-outbound-orders.service';
import { ClientListOutboundQueryDto } from '../outbound/dto/client-list-outbound-query.dto';
import {
  assertExternalApiDateNotBeforeToday,
  assertExternalOrderId,
  assertUniqueSkus,
  parseExternalApiDate,
} from './external-api-payload.util';
import { ExternalCreateOutboundOrderDto } from './dto/external-create-outbound-order.dto';
import {
  isUuidLike,
  publicOutboundOrder,
  publicOutboundOrderListItem,
} from './public-order.serialize';

@Injectable()
export class ExternalOutboundService {
  constructor(
    private readonly outbound: ClientOutboundOrdersService,
    private readonly oms: ClientOmsOrdersService,
  ) {}

  async create(client: ClientPrincipal, dto: ExternalCreateOutboundOrderDto) {
    const externalOrderId = assertExternalOrderId(dto.externalOrderId);
    const existing = await this.outbound.findByExternalReference(client, externalOrderId);
    if (existing) {
      const order = await this.outbound.findOne(client, existing.id);
      return { ...publicOutboundOrder(order), idempotentReplay: true };
    }

    const destination = String(dto.destination ?? dto.destinationAddress ?? '').trim();
    if (!destination) {
      throw new BadRequestException('destination is required.');
    }
    const requiredShipDate = parseExternalApiDate(dto.requiredShipDate, 'requiredShipDate');
    assertExternalApiDateNotBeforeToday(requiredShipDate, 'requiredShipDate');
    assertUniqueSkus(dto.lines.map((l) => l.sku));

    const products = await this.oms.resolveSkus(
      client.companyId,
      dto.lines.map((l) => l.sku),
    );

    try {
      // Same create path as /outbound-orders/new (+ customer reference for integration).
      const created = await this.outbound.create(client, {
        destinationAddress: destination,
        requiredShipDate,
        carrier: dto.carrier?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
        externalReference: externalOrderId,
        clientReference: externalOrderId,
        lines: dto.lines.map((l) => ({
          productId: products.get(l.sku.trim().toUpperCase())!,
          requestedQuantity: l.quantity,
        })),
      });
      const order = await this.outbound.findOne(client, created.id);
      return { ...publicOutboundOrder(order), idempotentReplay: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.outbound.findByExternalReference(client, externalOrderId);
        if (again) {
          const order = await this.outbound.findOne(client, again.id);
          return { ...publicOutboundOrder(order), idempotentReplay: true };
        }
      }
      throw err;
    }
  }

  async list(client: ClientPrincipal, query: ClientListOutboundQueryDto) {
    const page = await this.outbound.list(client, query);
    return {
      items: page.items.map((row) => publicOutboundOrderListItem(row as never)),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.outbound.findOne(client, id);
    return publicOutboundOrder(order);
  }

  async findByExternalOrderId(client: ClientPrincipal, externalOrderId: string) {
    const existing = await this.outbound.findByExternalReference(client, externalOrderId.trim());
    if (!existing) return null;
    const order = await this.outbound.findOne(client, existing.id);
    return publicOutboundOrder(order);
  }

  async findByOrderNumber(client: ClientPrincipal, orderNumber: string) {
    const existing = await this.outbound.findByOrderNumber(client, orderNumber.trim());
    if (!existing) return null;
    const order = await this.outbound.findOne(client, existing.id);
    return publicOutboundOrder(order);
  }

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
}
