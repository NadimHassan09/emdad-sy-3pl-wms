import { Injectable } from '@nestjs/common';
import { InboundOrderStatus } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { CreateInboundOrderDto } from '../../inbound/dto/create-inbound.dto';
import { ListInboundQueryDto } from '../../inbound/dto/list-inbound-query.dto';
import { InboundService } from '../../inbound/inbound.service';
import {
  CLIENT_INBOUND_IN_PROGRESS_STATUSES,
  ClientListInboundQueryDto,
} from './dto/client-list-inbound-query.dto';

/** Public media URL path consumed by client `clientMediaSrc()`. */
function toProductImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath?.trim()) return null;
  return `/media/${imagePath.replace(/^\/+/, '')}`;
}

type ListQueryWithStatusIn = ListInboundQueryDto & {
  statusIn?: InboundOrderStatus[];
};

@Injectable()
export class ClientInboundOrdersService {
  constructor(private readonly inbound: InboundService) {}

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.inbound.findById(id, clientAuthPrincipal(client));
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

  async list(client: ClientPrincipal, query: ClientListInboundQueryDto) {
    const principal = clientAuthPrincipal(client);
    const base: ListQueryWithStatusIn = {
      limit: query.limit,
      offset: query.offset,
      orderSearch: query.orderSearch,
      companyId: client.companyId,
    };

    if (query.status === 'in_progress') {
      base.statusIn = CLIENT_INBOUND_IN_PROGRESS_STATUSES;
    } else if (query.status) {
      base.status = query.status as InboundOrderStatus;
    }

    return this.inbound.list(principal, base);
  }

  async create(client: ClientPrincipal, dto: CreateInboundOrderDto) {
    // Warehouse admin completes dock / putaway / confirm on the admin plan UI.
    return this.inbound.create(
      clientAuthPrincipal(client),
      { ...dto, executionMode: 'admin', executionPlan: undefined },
      { pendingClientApproval: true },
    );
  }

  async findByExternalReference(client: ClientPrincipal, externalReference: string) {
    return this.inbound.findByExternalReference(
      clientAuthPrincipal(client),
      client.companyId,
      externalReference,
    );
  }

  async findByOrderNumber(client: ClientPrincipal, orderNumber: string) {
    return this.inbound.findByOrderNumber(
      clientAuthPrincipal(client),
      client.companyId,
      orderNumber,
    );
  }
}
