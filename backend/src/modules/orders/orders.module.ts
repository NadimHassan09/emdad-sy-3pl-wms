import { Module, forwardRef } from '@nestjs/common';

import { InboundModule } from '../inbound/inbound.module';
import { OutboundModule } from '../outbound/outbound.module';
import { WarehouseWorkflowModule } from '../warehouse-workflow/warehouse-workflow.module';
import { AdminOrderExecutionService } from './admin-order-execution.service';

@Module({
  imports: [
    forwardRef(() => InboundModule),
    forwardRef(() => OutboundModule),
    WarehouseWorkflowModule,
  ],
  providers: [AdminOrderExecutionService],
  exports: [AdminOrderExecutionService],
})
export class OrdersModule {}
