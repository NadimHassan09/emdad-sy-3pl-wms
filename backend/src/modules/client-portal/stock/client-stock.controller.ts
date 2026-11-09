import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../../common/auth/public.decorator';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import {
  parseExportFormat,
  sendTabularExport,
} from '../../../common/utils/tabular-export.util';
import { AvailabilityQueryDto } from '../../inventory/dto/availability-query.dto';
import { StockExportQueryDto, StockQueryDto } from '../../inventory/dto/stock-query.dto';
import { ClientStockService } from './client-stock.service';

/**
 * Client portal stock — always filtered to the signed-in client's company.
 * `GET /api/client/stock`
 */
@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client/stock')
export class ClientStockController {
  constructor(private readonly stock: ClientStockService) {}

  @Get('availability')
  availability(@ClientUser() client: ClientPrincipal, @Query() query: AvailabilityQueryDto) {
    return this.stock.availability(client, query.productId);
  }

  /** Must stay above the list route so "export" is not treated as a filter value. */
  @Get('export')
  async export(
    @ClientUser() client: ClientPrincipal,
    @Query() query: StockExportQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.stock.export(client, query, parseExportFormat(query.format));
    return sendTabularExport(res, result);
  }

  @Get()
  list(@ClientUser() client: ClientPrincipal, @Query() query: StockQueryDto) {
    return this.stock.list(client, query);
  }
}
