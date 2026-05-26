import { Injectable } from '@nestjs/common';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { CreateOutboundOrderDto } from '../../outbound/dto/create-outbound.dto';
import { ListOutboundQueryDto } from '../../outbound/dto/list-outbound-query.dto';
import { OutboundService } from '../../outbound/outbound.service';
@Injectable()
export class ClientOutboundOrdersService {
  constructor(private readonly outbound: OutboundService) {}

  async findOne(client: ClientPrincipal, id: string) {
    return this.outbound.findById(id, clientAuthPrincipal(client));
  }

  async list(client: ClientPrincipal, query: ListOutboundQueryDto) {
    return this.outbound.list(clientAuthPrincipal(client), {
      ...query,
      companyId: client.companyId,
    });
  }

  async create(client: ClientPrincipal, dto: CreateOutboundOrderDto) {
    return this.outbound.create(clientAuthPrincipal(client), dto, {
      pendingClientApproval: true,
    });
  }
}
