import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { WarehouseWorkflowModule } from '../warehouse-workflow/warehouse-workflow.module';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';

@Module({
  imports: [InventoryModule, WarehouseWorkflowModule],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
