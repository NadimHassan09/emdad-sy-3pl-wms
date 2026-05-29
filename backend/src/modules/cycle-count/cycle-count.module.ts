import { Module } from '@nestjs/common';

import { CycleCountController } from './cycle-count.controller';
import { CycleCountExecutionController } from './cycle-count-execution.controller';
import { CycleCountExecutionService } from './cycle-count-execution.service';
import { CycleCountLineMutationService } from './cycle-count-line-mutation.service';
import { CycleCountSchedulerService } from './cycle-count-scheduler.service';
import { CycleCountSnapshotService } from './cycle-count-snapshot.service';
import { CycleCountService } from './cycle-count.service';

import { CycleCountVarianceController } from './cycle-count-variance.controller';
import { CycleCountVarianceDetectionService } from './cycle-count-variance-detection.service';
import { CycleCountVarianceService } from './cycle-count-variance.service';
import { AdjustmentsModule } from '../adjustments/adjustments.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [AdjustmentsModule, AuditModule],
  controllers: [
    CycleCountController,
    CycleCountExecutionController,
    CycleCountVarianceController,
  ],
  providers: [
    CycleCountService,
    CycleCountExecutionService,
    CycleCountLineMutationService,
    CycleCountSnapshotService,
    CycleCountSchedulerService,
    CycleCountVarianceDetectionService,
    CycleCountVarianceService,
  ],
  exports: [CycleCountService, CycleCountExecutionService, CycleCountVarianceService],
})
export class CycleCountModule {}
