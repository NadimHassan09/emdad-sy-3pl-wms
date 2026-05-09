import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ListOutboundQueryDto } from '../../outbound/dto/list-outbound-query.dto';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientOutboundOrdersService } from './client-outbound-orders.service';

@Controller('client/outbound-orders')
export class ClientOutboundOrdersController {
  constructor(private readonly outbound: ClientOutboundOrdersService) {}

  @Public()
  @Get()
  @UseGuards(JwtClientAuthGuard)
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListOutboundQueryDto) {
    return this.outbound.list(client, query);
  }

  @Public()
  @Get(':id')
  @UseGuards(JwtClientAuthGuard)
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.outbound.findOne(client, id);
  }
}
