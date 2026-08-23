import { Module, forwardRef } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { WarehouseWorkflowModule } from '../warehouse-workflow/warehouse-workflow.module';
import { BillingModule } from '../billing/billing.module';
import { ClientPortalModule } from '../client-portal/client-portal.module';
import { InboundController } from './inbound.controller';
import { InboundOrdersCsvService } from './inbound-orders-csv.service';
import { InboundService } from './inbound.service';

@Module({
  imports: [AuditModule, InventoryModule, WarehouseWorkflowModule, BillingModule, forwardRef(() => ClientPortalModule)],
  controllers: [InboundController],
  providers: [InboundService, InboundOrdersCsvService],
  exports: [InboundService],
})
export class InboundModule {}
