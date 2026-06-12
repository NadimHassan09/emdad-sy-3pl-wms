import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
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
import { SlaAuditService } from './sla-audit.service';
import { WorkflowRecoveryService } from './workflow-recovery.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [PrismaModule, InventoryModule, RedisModule, AuthModule, AuditModule, BillingModule],
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
    SlaAuditService,
    WorkflowRecoveryService,
    WorkflowExecutionGateGuard,
  ],
  exports: [WorkflowBootstrapService, WarehouseTasksService, WorkflowOrchestrationService],
})
export class WarehouseWorkflowModule {}
