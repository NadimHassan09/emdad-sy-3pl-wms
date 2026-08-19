import { Injectable } from '@nestjs/common';
import { OutboundOrderStatus } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { CreateOutboundOrderDto } from '../../outbound/dto/create-outbound.dto';
import { ListOutboundQueryDto } from '../../outbound/dto/list-outbound-query.dto';
import { OutboundService } from '../../outbound/outbound.service';
import {
  CLIENT_OUTBOUND_IN_PROGRESS_STATUSES,
  ClientListOutboundQueryDto,
} from './dto/client-list-outbound-query.dto';

/** Public media URL path consumed by client `clientMediaSrc()`. */
function toProductImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath?.trim()) return null;
  return `/media/${imagePath.replace(/^\/+/, '')}`;
}

type ListQueryWithStatusIn = ListOutboundQueryDto & {
  statusIn?: OutboundOrderStatus[];
};

@Injectable()
export class ClientOutboundOrdersService {
  constructor(private readonly outbound: OutboundService) {}

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.outbound.findById(id, clientAuthPrincipal(client));
    return {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        product: {
          ...line.product,
          imageUrl: toProductImageUrl(line.product.imagePath),
        },
      })),
    };
  }

  async list(client: ClientPrincipal, query: ClientListOutboundQueryDto) {
    const principal = clientAuthPrincipal(client);
    const base: ListQueryWithStatusIn = {
      limit: query.limit,
      offset: query.offset,
      orderSearch: query.orderSearch,
      companyId: client.companyId,
    };

    if (query.status === 'in_progress') {
      base.statusIn = CLIENT_OUTBOUND_IN_PROGRESS_STATUSES;
    } else if (query.status === 'shipped') {
      // Delivered is shown as Shipped in the client portal.
      base.statusIn = [OutboundOrderStatus.shipped, OutboundOrderStatus.delivered];
    } else if (query.status) {
      base.status = query.status as OutboundOrderStatus;
    }

    return this.outbound.list(principal, base);
  }

  async create(client: ClientPrincipal, dto: CreateOutboundOrderDto) {
    // Planning Ownership: Client creates; Admin plans. Force admin mode + no plan.
    return this.outbound.create(
      clientAuthPrincipal(client),
      { ...dto, executionMode: 'admin', executionPlan: undefined },
      { pendingClientApproval: true },
    );
  }

  async findByExternalReference(client: ClientPrincipal, externalReference: string) {
    return this.outbound.findByExternalReference(
      clientAuthPrincipal(client),
      client.companyId,
      externalReference,
    );
  }
}
