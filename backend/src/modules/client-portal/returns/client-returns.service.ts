import { Injectable } from '@nestjs/common';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { CreateReturnOrderDto } from '../../returns/dto/create-return-order.dto';
import { ListReturnOrdersQueryDto } from '../../returns/dto/list-return-orders-query.dto';
import { ReturnsService } from '../../returns/returns.service';

@Injectable()
export class ClientReturnsService {
  constructor(private readonly returns: ReturnsService) {}

  list(client: ClientPrincipal, query: ListReturnOrdersQueryDto) {
    return this.returns.list(clientAuthPrincipal(client), {
      ...query,
      companyId: client.companyId,
    });
  }

  findOne(client: ClientPrincipal, id: string) {
    return this.returns.findById(id, clientAuthPrincipal(client));
  }

  create(client: ClientPrincipal, dto: CreateReturnOrderDto) {
    return this.returns.create(clientAuthPrincipal(client), {
      ...dto,
      companyId: client.companyId,
    });
  }
}
