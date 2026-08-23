import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientInboundOrdersService } from '../inbound/client-inbound-orders.service';
import { ClientListInboundQueryDto } from '../inbound/dto/client-list-inbound-query.dto';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import {
  assertExternalApiDateNotBeforeToday,
  assertExternalOrderId,
  assertUniqueSkus,
  parseExternalApiDate,
} from './external-api-payload.util';
import { ExternalCreateInboundOrderDto } from './dto/external-create-inbound-order.dto';
import {
  isUuidLike,
  publicInboundOrder,
  publicInboundOrderListItem,
} from './public-order.serialize';

@Injectable()
export class ExternalInboundService {
  constructor(
    private readonly inbound: ClientInboundOrdersService,
    private readonly oms: ClientOmsOrdersService,
  ) {}

  async create(client: ClientPrincipal, dto: ExternalCreateInboundOrderDto) {
    const externalOrderId = assertExternalOrderId(dto.externalOrderId);
    const existing = await this.inbound.findByExternalReference(client, externalOrderId);
    if (existing) {
      const order = await this.inbound.findOne(client, existing.id);
      return { ...publicInboundOrder(order), idempotentReplay: true };
    }

    const expectedArrivalDate = parseExternalApiDate(
      dto.expectedArrivalDate,
      'expectedArrivalDate',
    );
    assertExternalApiDateNotBeforeToday(expectedArrivalDate, 'expectedArrivalDate');
    assertUniqueSkus(dto.lines.map((l) => l.sku));

    const products = await this.oms.resolveSkus(
      client.companyId,
      dto.lines.map((l) => l.sku),
    );

    try {
      // Same create path as /inbound-orders/new (+ customer reference for integration).
      const created = await this.inbound.create(client, {
        expectedArrivalDate,
        notes: dto.notes?.trim() || undefined,
        externalReference: externalOrderId,
        clientReference: externalOrderId,
        lines: dto.lines.map((l) => ({
          productId: products.get(l.sku.trim().toUpperCase())!,
          expectedQuantity: l.quantity,
        })),
      });
      const order = await this.inbound.findOne(client, created.id);
      return { ...publicInboundOrder(order), idempotentReplay: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.inbound.findByExternalReference(client, externalOrderId);
        if (again) {
          const order = await this.inbound.findOne(client, again.id);
          return { ...publicInboundOrder(order), idempotentReplay: true };
        }
      }
      throw err;
    }
  }

  async list(client: ClientPrincipal, query: ClientListInboundQueryDto) {
    const page = await this.inbound.list(client, query);
    return {
      items: page.items.map((row) => publicInboundOrderListItem(row as never)),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.inbound.findOne(client, id);
    return publicInboundOrder(order);
  }

  async findByExternalOrderId(client: ClientPrincipal, externalOrderId: string) {
    const existing = await this.inbound.findByExternalReference(client, externalOrderId.trim());
    if (!existing) return null;
    const order = await this.inbound.findOne(client, existing.id);
    return publicInboundOrder(order);
  }

  async findByOrderNumber(client: ClientPrincipal, orderNumber: string) {
    const existing = await this.inbound.findByOrderNumber(client, orderNumber.trim());
    if (!existing) return null;
    const order = await this.inbound.findOne(client, existing.id);
    return publicInboundOrder(order);
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
