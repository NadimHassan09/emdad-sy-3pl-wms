import { Module } from '@nestjs/common';

import { RedisModule } from '../../common/redis/redis.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { WorkflowBootstrapService } from './workflow-bootstrap.service';
import { WorkflowOrchestrationService } from './workflow-orchestration.service';
import { WarehouseTasksService } from './warehouse-tasks.service';
import { TaskInventoryEffectsService } from './task-inventory-effects.service';
import { WorkflowWorkersService } from './workflow-workers.service';
import { WorkflowController } from './workflow.controller';
import { WarehouseTasksController } from './warehouse-tasks.controller';
import { WorkflowExecutionGateGuard } from './workflow-execution-gate.guard';
import { WorkflowWorkersController } from './workflow-workers.controller';
import { AnalyticsOverviewController } from './analytics-overview.controller';
import { SlaEscalationService } from './sla-escalation.service';
import { WorkflowRecoveryService } from './workflow-recovery.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [PrismaModule, InventoryModule, RedisModule],
  controllers: [
    WorkflowController,
    WarehouseTasksController,
    WorkflowWorkersController,
    AnalyticsOverviewController,
  ],
  providers: [
    WorkflowBootstrapService,
    WorkflowEngineService,
    WorkflowOrchestrationService,
    WarehouseTasksService,
    TaskInventoryEffectsService,
    WorkflowWorkersService,
    SlaEscalationService,
    WorkflowRecoveryService,
    WorkflowExecutionGateGuard,
  ],
  exports: [WorkflowBootstrapService, WarehouseTasksService, WorkflowOrchestrationService],
})
export class WarehouseWorkflowModule {}
