import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { StartWorkflowBodyDto } from './dto/start-workflow.dto';
import { WorkflowBootstrapService } from './workflow-bootstrap.service';
import { WorkflowRecoveryService } from './workflow-recovery.service';

@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflow: WorkflowBootstrapService,
    private readonly workflowRecovery: WorkflowRecoveryService,
  ) {}

  @Get('context-settings')
  getContextSettings(@CurrentUser() user: AuthPrincipal, @Query('warehouse_id') warehouseId?: string) {
    return this.workflow.getWorkflowContextSettings(user, warehouseId);
  }

  @Get('instances/by-reference')
  getInstanceGraphByReference(
    @CurrentUser() user: AuthPrincipal,
    @Query('reference_type') referenceType: string,
    @Query('reference_id') referenceId: string,
  ) {
    if (referenceType !== 'inbound_order' && referenceType !== 'outbound_order') {
      throw new BadRequestException('reference_type must be inbound_order or outbound_order.');
    }
    if (!referenceId?.trim()) {
      throw new BadRequestException('reference_id is required.');
    }
    return this.workflow.getWorkflowInstanceGraphByReference(user, referenceType, referenceId);
  }

  @Get('instances/:instanceId/graph')
  getInstanceGraph(@CurrentUser() user: AuthPrincipal, @Param('instanceId') instanceId: string) {
    return this.workflow.getWorkflowInstanceGraph(user, instanceId);
  }

  @Get('references/:referenceType/:referenceId')
  getTimeline(
    @CurrentUser() user: AuthPrincipal,
    @Param('referenceType') referenceType: string,
    @Param('referenceId') referenceId: string,
  ) {
    if (referenceType !== 'inbound_order' && referenceType !== 'outbound_order') {
      throw new BadRequestException('referenceType must be inbound_order or outbound_order.');
    }
    return this.workflow.getWorkflowTimeline(user, referenceType, referenceId);
  }

  @Post('inbound/:orderId/start')
  startInbound(
    @CurrentUser() user: AuthPrincipal,
    @Param('orderId') orderId: string,
    @Body() body: StartWorkflowBodyDto,
  ) {
    if (!body.stagingByLineId || typeof body.stagingByLineId !== 'object') {
      throw new BadRequestException('stagingByLineId is required (map lineId → stagingLocationId).');
    }
    return this.workflow.startInboundWorkflow(user, orderId, body.warehouseId, body.stagingByLineId);
  }

  @Post('outbound/:orderId/start')
  startOutbound(
    @CurrentUser() user: AuthPrincipal,
    @Param('orderId') orderId: string,
    @Body() body: StartWorkflowBodyDto,
  ) {
    return this.workflow.startOutboundWorkflow(user, orderId, body.warehouseId);
  }

  /** Part III — manual compensation / ledger recovery actions (validated in service via Zod). */
  @Post('instances/:instanceId/recover')
  recoverWorkflowInstance(
    @CurrentUser() user: AuthPrincipal,
    @Param('instanceId') instanceId: string,
    @Body() body: unknown,
  ) {
    return this.workflowRecovery.recoverWorkflowInstance(instanceId, user, body);
  }
}
