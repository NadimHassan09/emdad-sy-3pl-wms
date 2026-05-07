import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { WarehouseWorkflowModule } from '../warehouse-workflow/warehouse-workflow.module';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';

@Module({
  imports: [InventoryModule, WarehouseWorkflowModule],
  controllers: [OutboundController],
  providers: [OutboundService],
})
export class OutboundModule {}
