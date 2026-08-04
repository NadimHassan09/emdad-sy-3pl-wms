import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { CreateOmsReturnDto } from '../../oms-returns/dto/oms-return.dto';
import { ListOmsReturnsQueryDto } from '../../oms-returns/oms-returns.service';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientOmsReturnsService } from './client-oms-returns.service';

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/oms/returns')
export class ClientOmsReturnsController {
  constructor(private readonly returns: ClientOmsReturnsService) {}

  @Get()
  list(@ClientUser() client: ClientPrincipal, @Query() query: ListOmsReturnsQueryDto) {
    return this.returns.list(client, query);
  }

  @Get(':id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.returns.findOne(client, id);
  }

  @Post()
  create(@ClientUser() client: ClientPrincipal, @Body() body: CreateOmsReturnDto) {
    return this.returns.create(client, body);
  }
}
