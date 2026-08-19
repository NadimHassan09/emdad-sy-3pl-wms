import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCredentialScope } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { ClientUser } from '../auth/client-user.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { ExternalCreateInboundOrderDto } from './dto/external-create-inbound-order.dto';
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

  @Get('orders')
  async findByExternal(
    @ClientUser() client: ClientPrincipal,
    @Query('externalOrderId') externalOrderId?: string,
  ) {
    if (!externalOrderId?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Provide externalOrderId to look up an order.',
        fields: { externalOrderId: 'Required' },
      });
    }
    const order = await this.inbound.findByExternalOrderId(client, externalOrderId);
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  @Get('orders/:id')
  findOne(@ClientUser() client: ClientPrincipal, @Param('id', ParseUuidLoosePipe) id: string) {
    return this.inbound.findOne(client, id);
  }
}
