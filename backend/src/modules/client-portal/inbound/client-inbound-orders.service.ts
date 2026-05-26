import { Injectable } from '@nestjs/common';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { CreateInboundOrderDto } from '../../inbound/dto/create-inbound.dto';
import { ListInboundQueryDto } from '../../inbound/dto/list-inbound-query.dto';
import { InboundService } from '../../inbound/inbound.service';
@Injectable()
export class ClientInboundOrdersService {
  constructor(private readonly inbound: InboundService) {}

  async findOne(client: ClientPrincipal, id: string) {
    return this.inbound.findById(id, clientAuthPrincipal(client));
  }

  async list(client: ClientPrincipal, query: ListInboundQueryDto) {
    return this.inbound.list(clientAuthPrincipal(client), {
      ...query,
      companyId: client.companyId,
    });
  }

  async create(client: ClientPrincipal, dto: CreateInboundOrderDto) {
    return this.inbound.create(clientAuthPrincipal(client), dto, {
      pendingClientApproval: true,
    });
  }
}
