import { Injectable, NotFoundException } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { ListInboundQueryDto } from '../../inbound/dto/list-inbound-query.dto';
import { InboundService } from '../../inbound/inbound.service';

@Injectable()
export class ClientInboundOrdersService {
  constructor(private readonly inbound: InboundService) {}

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.inbound.findById(id);
    if (order.companyId !== client.companyId) {
      throw new NotFoundException('Inbound order not found.');
    }
    return order;
  }

  async list(client: ClientPrincipal, query: ListInboundQueryDto) {
    const principal: AuthPrincipal = {
      id: client.id,
      companyId: client.companyId,
      role: client.role,
      email: client.email ?? undefined,
    };
    return this.inbound.list(principal, {
      ...query,
      companyId: client.companyId,
    });
  }
}
