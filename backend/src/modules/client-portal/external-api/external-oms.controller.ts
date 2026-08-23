import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCredentialScope } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ClientUser } from '../auth/client-user.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { ExternalCreateOmsOrderDto } from './dto/external-create-oms-order.dto';
import { ExternalListOmsOrdersQueryDto } from './dto/external-list-orders-query.dto';
import { ExternalOmsService } from './external-oms.service';
import { RequireApiScope } from './require-api-scope.decorator';

@Public()
@UseGuards(ApiKeyGuard)
@RequireApiScope(ApiCredentialScope.oms)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('v1/oms')
export class ExternalOmsController {
  constructor(private readonly oms: ExternalOmsService) {}

  @Post('orders')
  create(@ClientUser() client: ClientPrincipal, @Body() dto: ExternalCreateOmsOrderDto) {
    return this.oms.create(client, dto);
  }

  /**
   * List mode: GET /oms/orders
   * Single mode: GET /oms/orders?orderNumber=OMS-…  or  ?externalOrderId=SHOP-…
   */
  @Get('orders')
  async listOrFind(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ExternalListOmsOrdersQueryDto,
  ) {
    if (query.externalOrderId?.trim() || query.orderNumber?.trim()) {
      const order = await this.oms.findOneByLookup(client, {
        externalOrderId: query.externalOrderId,
        orderNumber: query.orderNumber,
      });
      if (!order) throw new NotFoundException('Order not found.');
      return order;
    }
    return this.oms.list(client, query);
  }

  /** Single mode by portal order number or internal UUID. */
  @Get('orders/:idOrNumber')
  async findOne(
    @ClientUser() client: ClientPrincipal,
    @Param('idOrNumber') idOrNumber: string,
  ) {
    const order = await this.oms.findOneByLookup(client, { idOrNumber });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
}
