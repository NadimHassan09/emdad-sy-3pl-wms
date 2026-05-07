import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('analytics')
export class AnalyticsOverviewController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview(
    @CurrentUser() user: AuthPrincipal,
    @Query('warehouse_id') warehouseId?: string,
    @Query('days') daysRaw?: string,
  ) {
    if (!user.companyId) {
      throw new BadRequestException('company context required');
    }
    const days = Math.min(Number(daysRaw ?? '7') || 7, 90);
    const from = new Date();
    from.setDate(from.getDate() - days);

    const whFilter = warehouseId
      ? Prisma.sql`AND warehouse_id = ${warehouseId}::uuid`
      : Prisma.empty;

    const grouped = await this.prisma.$queryRaw<
      Array<{ task_type: string; completions: bigint }>
    >(Prisma.sql`
      SELECT task_type, COUNT(*)::bigint AS completions
      FROM v_analytics_wh_task_completed_rows
      WHERE company_id = ${user.companyId}::uuid
        AND completed_at >= ${from}
        ${whFilter}
      GROUP BY task_type
      ORDER BY task_type
    `);

    const stats = await this.prisma.$queryRaw<
      Array<{ median_minutes: number | null; cycle_samples: bigint }>
    >(Prisma.sql`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_minutes)::float8 AS median_minutes,
        COUNT(*)::bigint AS cycle_samples
      FROM v_analytics_wh_task_completed_rows
      WHERE company_id = ${user.companyId}::uuid
        AND completed_at >= ${from}
        ${whFilter}
        AND duration_minutes IS NOT NULL
        AND duration_minutes >= 0
    `);

    const row = stats[0];
    const medianCycleMinutes =
      row?.median_minutes != null && Number.isFinite(row.median_minutes) ? row.median_minutes : null;
    const cycleSamplesUsed = Number(row?.cycle_samples ?? 0);

    const windowDaysEff = Math.max(days, 0.001);
    const throughputPerDay = cycleSamplesUsed / windowDaysEff;

    return {
      windowDays: days,
      medianCycleMinutes,
      throughputPerDayEstimated: Math.round(throughputPerDay * 1000) / 1000,
      cycleSamplesUsed,
      completedByTaskType: grouped.map((r) => ({
        taskType: r.task_type,
        completions: Number(r.completions),
      })),
    };
  }
}
