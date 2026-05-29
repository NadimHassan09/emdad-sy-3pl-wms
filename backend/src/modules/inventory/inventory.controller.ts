import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { ConsistencyQueryDto } from './dto/consistency-query.dto';
import { InternalTransferDto } from './dto/internal-transfer.dto';
import { LedgerEntryQueryDto } from './dto/ledger-entry-query.dto';
import { LedgerQueryDto, StockQueryDto } from './dto/stock-query.dto';
import { InventoryConsistencyService } from './inventory-consistency.service';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly consistency: InventoryConsistencyService,
  ) {}

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

  @Get('consistency/validate')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  validateConsistency(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ConsistencyQueryDto,
  ) {
    return this.consistency.validateForUser(user, {
      companyId: query.companyId,
      warehouseId: query.warehouseId,
    });
  }

  @Post('internal-transfer')
  @UseGuards(InternalAdminGuard)
  internalTransfer(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: InternalTransferDto,
  ) {
    return this.inventory.internalTransfer(user, dto);
  }
}
