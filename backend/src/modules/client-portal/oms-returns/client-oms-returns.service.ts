import { Injectable } from '@nestjs/common';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { CreateOmsReturnDto } from '../../oms-returns/dto/oms-return.dto';
import {
  ListOmsReturnsQueryDto,
  OmsReturnsService,
} from '../../oms-returns/oms-returns.service';

@Injectable()
export class ClientOmsReturnsService {
  constructor(private readonly omsReturns: OmsReturnsService) {}

  list(client: ClientPrincipal, query: ListOmsReturnsQueryDto) {
    return this.omsReturns.list(clientAuthPrincipal(client), {
      ...query,
      companyId: client.companyId,
    });
  }

  findOne(client: ClientPrincipal, id: string) {
    return this.omsReturns.findById(id, clientAuthPrincipal(client));
  }

  create(client: ClientPrincipal, dto: CreateOmsReturnDto) {
    return this.omsReturns.create(clientAuthPrincipal(client), dto);
  }
}
