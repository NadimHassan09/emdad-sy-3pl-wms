import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ShippingService } from '../../shipping/shipping.service';

@UseGuards(JwtClientAuthGuard)
@Controller('client/shipping')
export class ClientShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('geo/boundary')
  async getBoundary(
    @Query('governorate') governorate?: string,
    @Query('city') city?: string,
    @Query('neighborhood') neighborhood?: string,
  ) {
    return this.shipping.lookupAreaBoundary({ governorate, city, neighborhood });
  }
}
