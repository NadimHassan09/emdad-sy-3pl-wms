import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AvailabilityQueryDto } from '../../inventory/dto/availability-query.dto';
import { StockQueryDto } from '../../inventory/dto/stock-query.dto';
import { ClientStockService } from './client-stock.service';

/**
 * Client portal stock — always filtered to the signed-in client's company.
 * `GET /api/client/stock`
 */
@Controller('client/stock')
export class ClientStockController {
  constructor(private readonly stock: ClientStockService) {}

  @Public()
  @Get('availability')
  @UseGuards(JwtClientAuthGuard)
  availability(@ClientUser() client: ClientPrincipal, @Query() query: AvailabilityQueryDto) {
    return this.stock.availability(client, query.productId);
  }

  @Public()
  @Get()
  @UseGuards(JwtClientAuthGuard)
  list(@ClientUser() client: ClientPrincipal, @Query() query: StockQueryDto) {
    return this.stock.list(client, query);
  }
}
