import { Injectable, NotFoundException } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { CreateOutboundOrderDto } from '../../outbound/dto/create-outbound.dto';
import { ListOutboundQueryDto } from '../../outbound/dto/list-outbound-query.dto';
import { OutboundService } from '../../outbound/outbound.service';
@Injectable()
export class ClientOutboundOrdersService {
  constructor(private readonly outbound: OutboundService) {}

  private principal(client: ClientPrincipal): AuthPrincipal {
    return {
      id: client.id,
      companyId: client.companyId,
      role: client.role,
      email: client.email ?? undefined,
    };
  }

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.outbound.findById(id);
    if (order.companyId !== client.companyId) {
      throw new NotFoundException('Outbound order not found.');
    }
    return order;
  }

  async list(client: ClientPrincipal, query: ListOutboundQueryDto) {
    return this.outbound.list(this.principal(client), {
      ...query,
      companyId: client.companyId,
    });
  }

  async create(client: ClientPrincipal, dto: CreateOutboundOrderDto) {
    return this.outbound.create(this.principal(client), dto, {
      pendingClientApproval: true,
    });
  }
}
