import { Module, forwardRef } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OmsReturnsModule } from '../oms-returns/oms-returns.module';
import { ReturnInventoryService } from './return-inventory.service';
import { ReturnQuantityValidation } from './return-quantity.validation';
import { ReturnWorkflowService } from './return-workflow.service';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [InventoryModule, AuditModule, forwardRef(() => OmsReturnsModule)],
  controllers: [ReturnsController],
  providers: [
    ReturnsService,
    ReturnQuantityValidation,
    ReturnWorkflowService,
    ReturnInventoryService,
  ],
  exports: [ReturnsService],
})
export class ReturnsModule {}
