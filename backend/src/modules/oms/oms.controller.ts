import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import {
  AllocateOmsOrderDto,
  CreateOmsOrderDto,
  UpdateOmsOrderDto,
} from './dto/oms-order.dto';
import { OmsDashboardService } from './oms-dashboard.service';
import { OmsOrdersService } from './oms-orders.service';

@Controller('oms')
export class OmsController {
  constructor(
    private readonly orders: OmsOrdersService,
    private readonly dashboard: OmsDashboardService,
  ) {}

  @Get('dashboard')
  dashboardSummary(
    @CurrentUser() user: AuthPrincipal,
    @Query('companyId') companyId?: string,
  ) {
    return this.dashboard.summary(user, companyId);
  }

  @Post('orders')
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateOmsOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get('orders/:id')
  findOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.findById(id, user);
  }

  @Patch('orders/:id')
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: UpdateOmsOrderDto,
  ) {
    return this.orders.update(id, user, dto);
  }

  @Post('orders/:id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.cancel(id, user);
  }

  @Post('orders/:id/allocate')
  allocate(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: AllocateOmsOrderDto,
  ) {
    return this.orders.allocate(id, user, dto);
  }

  @Post('orders/:id/release-allocation')
  releaseAllocation(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.releaseAllocation(id, user);
  }

  @Post('orders/:id/out-for-delivery')
  outForDelivery(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.markOutForDelivery(id, user);
  }

  @Post('orders/:id/delivered')
  delivered(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.markDelivered(id, user);
  }

  @Post('orders/:id/returned')
  returned(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.markReturned(id, user);
  }

  @Post('orders/:id/cod/collect')
  collectCod(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.collectCod(id, user);
  }

  @Post('orders/:id/cod/settle')
  settleCod(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.settleCod(id, user);
  }

  @Get('orders/:id/timeline')
  timeline(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.orders.timeline(id, user);
  }
}
