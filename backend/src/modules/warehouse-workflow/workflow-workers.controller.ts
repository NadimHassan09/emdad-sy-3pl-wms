import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { WorkerOperationalRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { WorkflowWorkersService } from './workflow-workers.service';

@Controller('workers')
export class WorkflowWorkersController {
  constructor(private readonly workers: WorkflowWorkersService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query('warehouseId') warehouseId?: string) {
    return this.workers.list(user, warehouseId);
  }

  @Get('load')
  loadByWarehouse(
    @CurrentUser() user: AuthPrincipal,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.workers.workerLoad(user, warehouseId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body()
    body: { displayName: string; warehouseId?: string; roles: WorkerOperationalRole[] },
  ) {
    return this.workers.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.workers.get(id, user);
  }
}
