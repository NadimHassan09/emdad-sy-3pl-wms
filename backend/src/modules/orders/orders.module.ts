import { Module, forwardRef } from '@nestjs/common';

import { InboundModule } from '../inbound/inbound.module';
import { OutboundModule } from '../outbound/outbound.module';
import { WarehouseWorkflowModule } from '../warehouse-workflow/warehouse-workflow.module';

/**
 * Shared order helpers live under `execution-plan.util.ts`.
 * Admin execute-admin facade is deprecated (single-stage wrapper only).
 * Prefer outbound/inbound Approve + stage completion endpoints.
 */
@Module({
  imports: [
    forwardRef(() => InboundModule),
    forwardRef(() => OutboundModule),
    WarehouseWorkflowModule,
  ],
  providers: [],
  exports: [],
})
export class OrdersModule {}
