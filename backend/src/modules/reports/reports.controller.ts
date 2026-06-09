import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AuthGroup } from '../../common/auth/auth-groups';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AggregateReportQueryDto, ExportReportQueryDto, RunReportQueryDto } from './dto/run-report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('policy')
  getPolicy() {
    return this.reports.getPolicy();
  }

  @Get(':reportId/kpis')
  kpis(
    @CurrentUser() user: AuthPrincipal,
    @Param('reportId') reportId: string,
    @Query() query: RunReportQueryDto,
  ) {
    return this.reports.kpis(user, reportId, query);
  }

  @Get(':reportId/aggregate')
  aggregate(
    @CurrentUser() user: AuthPrincipal,
    @Param('reportId') reportId: string,
    @Query() query: AggregateReportQueryDto,
  ) {
    return this.reports.aggregate(user, reportId, query);
  }

  @Get(':reportId/export')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  async export(
    @CurrentUser() user: AuthPrincipal,
    @Param('reportId') reportId: string,
    @Query() query: ExportReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reports.export(user, reportId, query);
    res.setHeader(
      'Content-Type',
      result.format === 'xls'
        ? 'application/vnd.ms-excel; charset=utf-8'
        : 'text/csv; charset=utf-8',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Row-Count', String(result.rowCount));
    res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
    return result.body;
  }

  @Get(':reportId/run')
  run(
    @CurrentUser() user: AuthPrincipal,
    @Param('reportId') reportId: string,
    @Query() query: RunReportQueryDto,
  ) {
    return this.reports.run(user, reportId, query);
  }
}
