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
import { ExternalCreateOutboundOrderDto } from './dto/external-create-outbound-order.dto';
import { ExternalListOutboundOrdersQueryDto } from './dto/external-list-orders-query.dto';
import { ExternalOutboundService } from './external-outbound.service';
import { RequireApiScope } from './require-api-scope.decorator';

@Public()
@UseGuards(ApiKeyGuard)
@RequireApiScope(ApiCredentialScope.outbound)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('v1/outbound')
export class ExternalOutboundController {
  constructor(private readonly outbound: ExternalOutboundService) {}

  @Post('orders')
  create(@ClientUser() client: ClientPrincipal, @Body() dto: ExternalCreateOutboundOrderDto) {
    return this.outbound.create(client, dto);
  }

  /**
   * List mode: GET /outbound/orders
   * Single mode: ?orderNumber=OUT-…  or  ?externalOrderId=SHOP-OUT-…
   */
  @Get('orders')
  async listOrFind(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ExternalListOutboundOrdersQueryDto,
  ) {
    if (query.externalOrderId?.trim() || query.orderNumber?.trim()) {
      const order = await this.outbound.findOneByLookup(client, {
        externalOrderId: query.externalOrderId,
        orderNumber: query.orderNumber,
      });
      if (!order) throw new NotFoundException('Order not found.');
      return order;
    }
    return this.outbound.list(client, query);
  }

  @Get('orders/:idOrNumber')
  async findOne(
    @ClientUser() client: ClientPrincipal,
    @Param('idOrNumber') idOrNumber: string,
  ) {
    const order = await this.outbound.findOneByLookup(client, { idOrNumber });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
}
