import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import type { WorkerOperationalRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { WorkflowWorkersService } from './workflow-workers.service';

@Controller('workers')
export class WorkflowWorkersController {
  constructor(private readonly workers: WorkflowWorkersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query('warehouseId') warehouseId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.workers.list(user, warehouseId, companyId);
  }

  @Get('load')
  loadByWarehouse(
    @CurrentUser() user: AuthPrincipal,
    @Query('warehouseId') warehouseId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.workers.workerLoad(user, warehouseId, companyId);
  }

  @Get('unlinked')
  @UseGuards(InternalAdminGuard)
  listUnlinked(@CurrentUser() user: AuthPrincipal) {
    return this.workers.listUnlinked(user);
  }

  @Post()
  @UseGuards(InternalAdminGuard)
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
