import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { BulkShippingService } from './bulk-shipping.service';
import {
  BulkShippingConfirmDto,
  BulkShippingPreviewDto,
} from './dto/bulk-shipping.dto';
import { ConnectShippingProviderDto } from './dto/connect-shipping-provider.dto';
import { QuoteShippingRatesDto } from './dto/quote-shipping-rates.dto';
import { ShippingService } from './shipping.service';

@Controller('shipping')
@UseGuards(RolesGuard, InternalAdminGuard)
@Roles(AuthGroup.ADMIN)
export class ShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly bulkShipping: BulkShippingService,
  ) {}

  @Get('providers')
  listProviders() {
    return this.shipping.listProviders();
  }

  @Post('providers/:code/connect')
  connect(
    @Param('code') code: string,
    @Body() body: ConnectShippingProviderDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.shipping.connectProvider(
      code.toUpperCase(),
      body.username,
      body.password,
      user.id,
    );
  }

  @Post('providers/:code/test')
  test(@Param('code') code: string) {
    return this.shipping.testProvider(code.toUpperCase());
  }

  @Post('providers/:code/disconnect')
  disconnect(@Param('code') code: string) {
    return this.shipping.disconnectProvider(code.toUpperCase());
  }

  @Get('geo/boundary')
  async getBoundary(
    @Query('governorate') governorate?: string,
    @Query('city') city?: string,
    @Query('neighborhood') neighborhood?: string,
  ) {
    const row = await this.shipping.lookupAreaBoundary({
      governorate,
      city,
      neighborhood,
    });
    if (!row) {
      return { found: false as const, geometry: null };
    }
    return { found: true as const, ...row };
  }

  @Post('rates')
  quoteRates(@Body() body: QuoteShippingRatesDto) {
    return this.shipping.quoteDestinationRates(body);
  }

  @Post('shipments/:outboundOrderId/retry')
  retry(@Param('outboundOrderId') outboundOrderId: string) {
    return this.shipping.retryShipment(outboundOrderId);
  }

  // ── Bulk Shipping Processing (Admin only) ───────────────────────────────

  @Get('bulk/eligible')
  listEligible(
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bulkShipping.listEligible({
      companyId: companyId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('bulk/preview')
  preview(@Body() body: BulkShippingPreviewDto) {
    return this.bulkShipping.preview(body.outboundOrderIds);
  }

  @Post('bulk/jobs')
  confirm(
    @Body() body: BulkShippingConfirmDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bulkShipping.confirmAndStart(user.id, body.items);
  }

  @Get('bulk/jobs/:id')
  getJob(@Param('id') id: string) {
    return this.bulkShipping.getJob(id);
  }

  @Post('bulk/jobs/:id/items/:outboundOrderId/retry')
  retryItem(
    @Param('id') id: string,
    @Param('outboundOrderId') outboundOrderId: string,
  ) {
    return this.bulkShipping.retryItem(id, outboundOrderId);
  }

  @Get('bulk/jobs/:id/labels')
  getLabels(@Param('id') id: string) {
    return this.bulkShipping.getLabelsForJob(id);
  }
}
