import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import type { WarehouseTaskStatus } from '@prisma/client';

import { AuthGroup } from '../../common/auth/auth-groups';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { WarehouseTasksService } from './warehouse-tasks.service';
import {
  ListTasksQueryDto,
  TASK_LIST_DEFAULT_LIMIT,
  parseIncludeRunnability,
} from './dto/list-tasks-query.dto';
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
      limit: query.limit ?? TASK_LIST_DEFAULT_LIMIT,
      offset: query.offset ?? 0,
      includeRunnability: parseIncludeRunnability(query.includeRunnability),
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
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  assign(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { workerId: string },
  ) {
    return this.tasks.assign(id, user, body.workerId);
  }

  @Post(':id/unassign')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
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
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.tasks.cancel(id, user, body.reason);
  }

  @Post(':id/skip')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  skip(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: SkipTaskDto,
  ) {
    return this.tasks.skipTask(id, user, body);
  }

  @Post(':id/retry')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  retry(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() body: RetryTaskDto) {
    return this.tasks.retry(id, user, body);
  }

  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  resolve(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() body: ResolveTaskDto) {
    return this.tasks.resolveBlocked(id, user, body);
  }

  @Post(':id/fail')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  fail(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.tasks.fail(id, user, body.reason);
  }

  @Post(':id/reopen')
  @UseGuards(RolesGuard)
  @Roles(AuthGroup.ADMIN)
  reopen(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.tasks.reopen(id, user);
  }
}
