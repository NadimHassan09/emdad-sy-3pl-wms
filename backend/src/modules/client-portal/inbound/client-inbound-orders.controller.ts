import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ListInboundQueryDto } from '../../inbound/dto/list-inbound-query.dto';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientInboundOrdersService } from './client-inbound-orders.service';

@Controller('client/inbound-orders')
export class ClientInboundOrdersController {
  constructor(private readonly inbound: ClientInboundOrdersService) {}

  @Public()
  @Get()
  @UseGuards(JwtClientAuthGuard)
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListInboundQueryDto) {
    return this.inbound.list(client, query);
  }

  @Public()
  @Get(':id')
  @UseGuards(JwtClientAuthGuard)
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.inbound.findOne(client, id);
  }
}
