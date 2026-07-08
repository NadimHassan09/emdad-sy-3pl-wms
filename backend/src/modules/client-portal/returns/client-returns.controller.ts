import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { CreateReturnOrderDto } from '../../returns/dto/create-return-order.dto';
import { ListReturnOrdersQueryDto } from '../../returns/dto/list-return-orders-query.dto';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientReturnsService } from './client-returns.service';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/returns')
export class ClientReturnsController {
  constructor(private readonly returns: ClientReturnsService) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListReturnOrdersQueryDto) {
    return this.returns.list(client, query);
  }

  @Get(':id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.returns.findOne(client, id);
  }

  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() body: CreateReturnOrderDto) {
    return this.returns.create(client, body);
  }
}
