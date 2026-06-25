import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AdjustmentsController } from './adjustments.controller';
import { AdjustmentsService } from './adjustments.service';

@Module({
  imports: [AuditModule, InventoryModule],
  controllers: [AdjustmentsController],
  providers: [AdjustmentsService],
  exports: [AdjustmentsService],
})
export class AdjustmentsModule {}
