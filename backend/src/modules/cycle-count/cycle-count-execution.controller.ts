import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CycleCountExecutionService } from './cycle-count-execution.service';
import { ListExecutionTasksQueryDto } from './dto/list-execution-tasks-query.dto';
import { SkipCycleCountLineDto } from './dto/skip-cycle-count-line.dto';
import { SubmitLineCountDto } from './dto/submit-line-count.dto';

@Controller('cycle-count/execution')
@UseGuards(RolesGuard)
@Roles(AuthGroup.OPERATOR, AuthGroup.ADMIN)
export class CycleCountExecutionController {
  constructor(private readonly execution: CycleCountExecutionService) {}

  @Get('tasks')
  listTasks(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListExecutionTasksQueryDto,
  ) {
    return this.execution.listMyTasks(user, query.warehouseId);
  }

  @Get('tasks/:id')
  getTask(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.execution.getTask(user, id);
  }

  @Post('tasks/:id/claim')
  claimTask(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.execution.claimTask(user, id);
  }

  @Post('tasks/:id/lines/:lineId/count')
  submitLineCount(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: SubmitLineCountDto,
  ) {
    return this.execution.submitLineCount(user, id, lineId, dto);
  }

  @Post('tasks/:id/lines/:lineId/skip')
  skipLine(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: SkipCycleCountLineDto,
  ) {
    return this.execution.skipLine(user, id, lineId, dto);
  }

  @Post('tasks/:id/finish')
  finishTask(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.execution.finishTask(user, id);
  }
}
