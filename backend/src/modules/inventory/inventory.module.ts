import { Module } from '@nestjs/common';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { LedgerIdempotencyService } from './ledger-idempotency.service';
import { StockHelpers } from './stock.helpers';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, StockHelpers, LedgerIdempotencyService],
  exports: [InventoryService, StockHelpers, LedgerIdempotencyService],
})
export class InventoryModule {}
