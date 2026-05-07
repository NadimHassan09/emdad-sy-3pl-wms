import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ConfirmInboundBodyDto } from './dto/confirm-inbound-body.dto';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateInboundOrderDto } from './dto/create-inbound.dto';
import { ListInboundQueryDto } from './dto/list-inbound-query.dto';
import { ReceiveLineDto } from './dto/receive-line.dto';
import { InboundService } from './inbound.service';

@Controller('inbound-orders')
export class InboundController {
  constructor(private readonly inbound: InboundService) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateInboundOrderDto) {
    return this.inbound.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListInboundQueryDto) {
    return this.inbound.list(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.inbound.findById(id);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: ConfirmInboundBodyDto,
  ) {
    return this.inbound.confirm(user, id, body);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.inbound.cancel(id, user);
  }

  @Post(':id/lines/:lineId/receive')
  receive(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: ReceiveLineDto,
  ) {
    return this.inbound.receiveLine(user, id, lineId, dto);
  }
}
