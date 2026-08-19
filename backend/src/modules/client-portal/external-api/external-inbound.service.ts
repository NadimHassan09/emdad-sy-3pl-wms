import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientInboundOrdersService } from '../inbound/client-inbound-orders.service';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { ExternalCreateInboundOrderDto } from './dto/external-create-inbound-order.dto';
import { publicInboundOrder } from './public-order.serialize';

@Injectable()
export class ExternalInboundService {
  constructor(
    private readonly inbound: ClientInboundOrdersService,
    private readonly oms: ClientOmsOrdersService,
  ) {}

  async create(client: ClientPrincipal, dto: ExternalCreateInboundOrderDto) {
    const externalOrderId = dto.externalOrderId.trim();
    const existing = await this.inbound.findByExternalReference(client, externalOrderId);
    if (existing) {
      const order = await this.inbound.findOne(client, existing.id);
      return { ...publicInboundOrder(order), idempotentReplay: true };
    }

    const products = await this.oms.resolveSkus(
      client.companyId,
      dto.lines.map((l) => l.sku),
    );

    try {
      const created = await this.inbound.create(client, {
        expectedArrivalDate: dto.expectedArrivalDate,
        clientReference: dto.clientReference,
        notes: dto.notes,
        externalReference: externalOrderId,
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
}
