import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { InternalTransferDto } from './dto/internal-transfer.dto';
import { LedgerEntryQueryDto } from './dto/ledger-entry-query.dto';
import { LedgerQueryDto, StockQueryDto } from './dto/stock-query.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stock/by-product')
  stockByProduct(@CurrentUser() user: AuthPrincipal, @Query() query: StockQueryDto) {
    return this.inventory.stockByProductSummary(user, query);
  }

  @Get(['stock', 'current-stock'])
  stock(@CurrentUser() user: AuthPrincipal, @Query() query: StockQueryDto) {
    return this.inventory.stock(user, query);
  }

  @Get('ledger/entry')
  ledgerEntry(@CurrentUser() user: AuthPrincipal, @Query() query: LedgerEntryQueryDto) {
    return this.inventory.ledgerEntry(user, query);
  }

  @Get('ledger')
  ledger(@CurrentUser() user: AuthPrincipal, @Query() query: LedgerQueryDto) {
    return this.inventory.ledger(user, query);
  }

  @Get('availability')
  availability(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.inventory.availability(user, query.productId, query.companyId);
  }

  @Post('internal-transfer')
  internalTransfer(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: InternalTransferDto,
  ) {
    return this.inventory.internalTransfer(user, dto);
  }
}
