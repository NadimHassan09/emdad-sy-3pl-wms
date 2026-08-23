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
import { ExternalCreateInboundOrderDto } from './dto/external-create-inbound-order.dto';
import { ExternalListInboundOrdersQueryDto } from './dto/external-list-orders-query.dto';
import { ExternalInboundService } from './external-inbound.service';
import { RequireApiScope } from './require-api-scope.decorator';

@Public()
@UseGuards(ApiKeyGuard)
@RequireApiScope(ApiCredentialScope.inbound)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('v1/inbound')
export class ExternalInboundController {
  constructor(private readonly inbound: ExternalInboundService) {}

  @Post('orders')
  create(@ClientUser() client: ClientPrincipal, @Body() dto: ExternalCreateInboundOrderDto) {
    return this.inbound.create(client, dto);
  }

  /**
   * List mode: GET /inbound/orders
   * Single mode: ?orderNumber=INB-…  or  ?externalOrderId=SHOP-INB-…
   */
  @Get('orders')
  async listOrFind(
    @ClientUser() client: ClientPrincipal,
    @Query() query: ExternalListInboundOrdersQueryDto,
  ) {
    if (query.externalOrderId?.trim() || query.orderNumber?.trim()) {
      const order = await this.inbound.findOneByLookup(client, {
        externalOrderId: query.externalOrderId,
        orderNumber: query.orderNumber,
      });
      if (!order) throw new NotFoundException('Order not found.');
      return order;
    }
    return this.inbound.list(client, query);
  }

  @Get('orders/:idOrNumber')
  async findOne(
    @ClientUser() client: ClientPrincipal,
    @Param('idOrNumber') idOrNumber: string,
  ) {
    const order = await this.inbound.findOneByLookup(client, { idOrNumber });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
}
