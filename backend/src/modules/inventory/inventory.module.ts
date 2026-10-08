import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { ExpectedReturnHoldService } from './expected-return-hold.service';
import { InventoryConsistencyService } from './inventory-consistency.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { LedgerIdempotencyService } from './ledger-idempotency.service';
import { StockHelpers } from './stock.helpers';

@Module({
  imports: [AuditModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryConsistencyService,
    StockHelpers,
    LedgerIdempotencyService,
    ExpectedReturnHoldService,
  ],
  exports: [
    InventoryService,
    InventoryConsistencyService,
    StockHelpers,
    LedgerIdempotencyService,
    ExpectedReturnHoldService,
  ],
})
export class InventoryModule {}
