import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { composeDestinationAddress } from '../../oms/oms-order.mapper';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { ClientOutboundOrdersService } from '../outbound/client-outbound-orders.service';
import { throwApiValidation } from './api-validation';
import { ExternalCreateOutboundOrderDto } from './dto/external-create-outbound-order.dto';
import { publicOutboundOrder } from './public-order.serialize';
import { resolveSyriaAddress } from './syria-address';

@Injectable()
export class ExternalOutboundService {
  constructor(
    private readonly outbound: ClientOutboundOrdersService,
    private readonly oms: ClientOmsOrdersService,
  ) {}

  async create(client: ClientPrincipal, dto: ExternalCreateOutboundOrderDto) {
    const externalOrderId = dto.externalOrderId.trim();
    const existing = await this.outbound.findByExternalReference(client, externalOrderId);
    if (existing) {
      const order = await this.outbound.findOne(client, existing.id);
      return { ...publicOutboundOrder(order), idempotentReplay: true };
    }

    let destination = dto.destinationAddress?.trim() || '';
    if (dto.address) {
      const address = resolveSyriaAddress(dto.address);
      if (!address.ok) {
        throwApiValidation('Destination address is invalid.', address.fields);
      }
      destination =
        destination ||
        composeDestinationAddress({
          city: address.value.governorate,
          district: address.value.city,
          addressLine1: address.value.neighborhood ?? undefined,
          addressLine2: address.value.street ?? undefined,
        });
    }
    if (!destination) {
      throwApiValidation('Destination address is required.', {
        destinationAddress: 'Provide destinationAddress or a structured address.',
      });
    }

    const products = await this.oms.resolveSkus(
      client.companyId,
      dto.lines.map((l) => l.sku),
    );

    try {
      const created = await this.outbound.create(client, {
        destinationAddress: destination,
        requiredShipDate: dto.requiredShipDate,
        clientReference: dto.clientReference,
        notes: dto.notes,
        externalReference: externalOrderId,
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
}
