import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CreateOutboundOrderDto } from './dto/create-outbound.dto';
import { ConfirmOutboundBodyDto } from './dto/confirm-outbound-body.dto';
import { ListOutboundQueryDto } from './dto/list-outbound-query.dto';
import { OutboundService } from './outbound.service';

@Controller('outbound-orders')
export class OutboundController {
  constructor(private readonly outbound: OutboundService) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateOutboundOrderDto) {
    return this.outbound.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListOutboundQueryDto) {
    return this.outbound.list(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUuidLoosePipe) id: string) {
    return this.outbound.findById(id);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() body: ConfirmOutboundBodyDto,
  ) {
    return this.outbound.confirmAndDeduct(user, id, body);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.outbound.cancel(id, user);
  }
}
