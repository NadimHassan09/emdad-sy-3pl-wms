import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { InternalAdminGuard } from '../../common/auth/internal-admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ParseUuidLoosePipe } from '../../common/pipes/parse-uuid-loose.pipe';
import { CycleCountService } from './cycle-count.service';
import { AssignCycleCountDto } from './dto/assign-cycle-count.dto';
import { AssignCycleCountLineDto } from './dto/assign-cycle-count-line.dto';
import { CreateCycleCountDto } from './dto/create-cycle-count.dto';
import { ListCycleCountsQueryDto } from './dto/list-cycle-counts-query.dto';
import { ListProductHistoryQueryDto } from './dto/list-product-history-query.dto';
import { SkipCycleCountLineDto } from './dto/skip-cycle-count-line.dto';
import { SubmitLineCountDto } from './dto/submit-line-count.dto';
import { UpsertCycleCountScheduleDto } from './dto/upsert-cycle-count-schedule.dto';
import { CycleCountVarianceService } from './cycle-count-variance.service';

@Controller('cycle-count')
export class CycleCountController {
  constructor(
    private readonly cycleCounts: CycleCountService,
    private readonly variances: CycleCountVarianceService,
  ) {}

  @Post('schedules')
  @UseGuards(InternalAdminGuard)
  upsertSchedule(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: UpsertCycleCountScheduleDto,
  ) {
    return this.cycleCounts.upsertSchedule(user, dto);
  }

  @Get('schedules')
  listSchedules(
    @CurrentUser() user: AuthPrincipal,
    @Query('companyId') companyId?: string,
  ) {
    return this.cycleCounts.listSchedules(user, companyId);
  }

  @Get('product-history')
  listProductHistory(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: ListProductHistoryQueryDto,
  ) {
    return this.cycleCounts.listProductHistory(user, query);
  }

  @Post('counts')
  createCount(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateCycleCountDto) {
    return this.cycleCounts.createManual(user, dto);
  }

  @Get('counts')
  listCounts(@CurrentUser() user: AuthPrincipal, @Query() query: ListCycleCountsQueryDto) {
    return this.cycleCounts.list(user, query);
  }

  @Get('counts/:id')
  getCount(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cycleCounts.findById(user, id);
  }

  @Post('counts/:id/start')
  start(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cycleCounts.start(user, id);
  }

  @Patch('counts/:id/assign')
  assignSession(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Body() dto: AssignCycleCountDto,
  ) {
    return this.cycleCounts.assignSession(user, id, dto);
  }

  @Patch('counts/:id/lines/:lineId/assign')
  assignLine(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: AssignCycleCountLineDto,
  ) {
    return this.cycleCounts.assignLine(user, id, lineId, dto);
  }

  @Post('counts/:id/lines/:lineId/count')
  submitLineCount(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: SubmitLineCountDto,
  ) {
    return this.cycleCounts.submitLineCount(user, id, lineId, dto);
  }

  @Post('counts/:id/lines/:lineId/skip')
  skipLine(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Param('lineId', ParseUuidLoosePipe) lineId: string,
    @Body() dto: SkipCycleCountLineDto,
  ) {
    return this.cycleCounts.skipLine(user, id, lineId, dto);
  }

  @Post('counts/:id/submit-review')
  submitForReview(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cycleCounts.submitForReview(user, id);
  }

  @Get('counts/:id/variances')
  listCountVariances(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.variances.listForCount(user, id);
  }

  @Get('counts/:id/adjustments')
  listCountAdjustments(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.variances.listAdjustmentsForCount(user, id);
  }

  @Post('counts/:id/reconcile')
  @UseGuards(InternalAdminGuard)
  buildReconciliation(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.variances.buildReconciliationDraft(user, id);
  }

  @Post('counts/:id/post-reconciliation')
  @UseGuards(InternalAdminGuard)
  postReconciliation(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.variances.postReconciliation(user, id);
  }

  @Post('counts/:id/complete')
  @UseGuards(InternalAdminGuard)
  complete(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cycleCounts.complete(user, id);
  }

  @Post('counts/:id/cancel')
  cancel(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    return this.cycleCounts.cancel(user, id);
  }
}
