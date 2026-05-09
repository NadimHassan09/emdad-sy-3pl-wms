import { Injectable, NotFoundException } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { ListOutboundQueryDto } from '../../outbound/dto/list-outbound-query.dto';
import { OutboundService } from '../../outbound/outbound.service';

@Injectable()
export class ClientOutboundOrdersService {
  constructor(private readonly outbound: OutboundService) {}

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.outbound.findById(id);
    if (order.companyId !== client.companyId) {
      throw new NotFoundException('Outbound order not found.');
    }
    return order;
  }

  async list(client: ClientPrincipal, query: ListOutboundQueryDto) {
    const principal: AuthPrincipal = {
      id: client.id,
      companyId: client.companyId,
      role: client.role,
      email: client.email ?? undefined,
    };
    return this.outbound.list(principal, {
      ...query,
      companyId: client.companyId,
    });
  }
}
