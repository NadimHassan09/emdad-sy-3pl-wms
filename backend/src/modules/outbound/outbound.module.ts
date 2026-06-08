import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { WarehouseWorkflowModule } from '../warehouse-workflow/warehouse-workflow.module';
import { BillingModule } from '../billing/billing.module';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';

@Module({
  imports: [InventoryModule, WarehouseWorkflowModule, AuditModule, BillingModule],
  controllers: [OutboundController],
  providers: [OutboundService],
  exports: [OutboundService],
})
export class OutboundModule {}
