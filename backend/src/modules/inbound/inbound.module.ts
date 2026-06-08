import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { WarehouseWorkflowModule } from '../warehouse-workflow/warehouse-workflow.module';
import { BillingModule } from '../billing/billing.module';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';

@Module({
  imports: [AuditModule, InventoryModule, WarehouseWorkflowModule, BillingModule],
  controllers: [InboundController],
  providers: [InboundService],
  exports: [InboundService],
})
export class InboundModule {}
