import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import type { WarehouseTaskStatus } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { WarehouseTasksService } from './warehouse-tasks.service';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ResolveTaskDto } from './dto/resolve-task.dto';
import { RetryTaskDto } from './dto/retry-task.dto';
import { LeaseTaskDto } from './dto/lease-task.dto';
import { PatchTaskProgressDto } from './dto/patch-task-progress.dto';
import { SkipTaskDto } from './dto/skip-task.dto';
import { WorkflowExecutionGateGuard } from './workflow-execution-gate.guard';

@Controller('tasks')
export class WarehouseTasksController {
  constructor(private readonly tasks: WarehouseTasksService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: ListTasksQueryDto) {
    return this.tasks.list(user, {
      status: query.status as WarehouseTaskStatus | undefined,
      taskType: query.taskType,
      warehouseId: query.warehouseId,
      workerId: query.workerId,
      referenceId: query.referenceId,
      updatedFrom: query.updatedFrom ? new Date(query.updatedFrom) : undefined,
      updatedTo: query.updatedTo ? new Date(query.updatedTo) : undefined,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });
  }

  /** Static path segments — keep before `:id`. */
  @Get(':id/path-order')
  pathOrder(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.getPathOrder(id, user);
  }

  @Put(':id/progress')
  @UseGuards(WorkflowExecutionGateGuard)
  patchProgress(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: PatchTaskProgressDto,
  ) {
    return this.tasks.patchProgress(id, user, body);
  }

  @Post(':id/lease')
  @UseGuards(WorkflowExecutionGateGuard)
  leaseAcquire(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: LeaseTaskDto,
  ) {
    return this.tasks.leaseAcquire(id, user, body?.minutes);
  }

  @Post(':id/lease/release')
  leaseRelease(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.leaseRelease(id, user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.getById(id, user);
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { workerId: string },
  ) {
    return this.tasks.assign(id, user, body.workerId);
  }

  @Post(':id/unassign')
  unassign(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.unassign(id, user);
  }

  @Post(':id/start')
  @UseGuards(WorkflowExecutionGateGuard)
  start(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { workerId?: string },
  ) {
    return this.tasks.start(id, user, body.workerId);
  }

  @Post(':id/complete')
  @UseGuards(WorkflowExecutionGateGuard)
  complete(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.tasks.complete(id, user, body);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.tasks.cancel(id, user, body.reason);
  }

  @Post(':id/skip')
  skip(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: SkipTaskDto,
  ) {
    return this.tasks.skipTask(id, user, body);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() body: RetryTaskDto) {
    return this.tasks.retry(id, user, body);
  }

  @Post(':id/resolve')
  resolve(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() body: ResolveTaskDto) {
    return this.tasks.resolveBlocked(id, user, body);
  }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.reopen(id, user);
  }
}
