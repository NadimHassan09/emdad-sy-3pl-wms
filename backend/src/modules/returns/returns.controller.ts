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
import { CreateReturnOrderDto } from './dto/create-return-order.dto';
import { ListReturnOrdersQueryDto } from './dto/list-return-orders-query.dto';
import { ReceiveReturnLineDto } from './dto/receive-return-line.dto';
import { ReturnsService } from './returns.service';

@Controller('return-orders')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateReturnOrderDto) {
    return this.returns.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListReturnOrdersQueryDto) {
    return this.returns.list(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.returns.findById(id, user);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.returns.confirm(user, id);
  }

  @Post(':id/start-receiving')
  startReceiving(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.returns.startReceiving(user, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.returns.complete(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.returns.cancel(user, id);
  }

  @Post(':id/lines/:lineId/receive')
  receiveLine(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: ReceiveReturnLineDto,
  ) {
    return this.returns.receiveLine(user, id, lineId, dto);
  }
}
