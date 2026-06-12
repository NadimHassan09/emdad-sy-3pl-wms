import { Injectable } from '@nestjs/common';
import { Prisma, WarehouseTaskStatus } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { PrismaService } from '../../common/prisma/prisma.service';
import { outboundIdsVisibleForWarehouse } from '../../common/utils/warehouse-order-scope';
import { InboundService } from '../inbound/inbound.service';
import { isTaskSlaBreached, slaBreachDeadlineMs } from '../warehouse-workflow/sla-breach.util';
import type { RunReportQueryDto } from './dto/run-report-query.dto';
import type { ReportRowDto } from './reports.service';

const SAMPLE_CAP = 2000;

function hoursBetween(start: Date, end: Date): number | null {
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

function paginate<T>(rows: T[], limit: number, offset: number) {
  return {
    items: rows.slice(offset, offset + limit),
    total: rows.length,
  };
}

@Injectable()
export class OperationalReportsRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inbound: InboundService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  async run(
    user: AuthPrincipal,
    reportId: string,
    query: RunReportQueryDto,
  ): Promise<{ items: ReportRowDto[]; total: number }> {
    switch (reportId) {
      case 'worker-productivity':
        return this.workerProductivity(user, query);
      case 'order-cycle-time':
        return this.orderCycleTime(user, query);
      case 'inbound-accuracy':
        return this.inboundAccuracy(user, query);
      case 'outbound-fill-rate':
        return this.outboundFillRate(user, query);
      case 'sla-compliance':
        return this.slaCompliance(user, query);
      default:
        return { items: [], total: 0 };
    }
  }

  private listParams(query: RunReportQueryDto) {
    return {
      warehouseId: query.warehouseId,
      companyId: query.companyId,
      createdFrom: query.dateFrom,
      createdTo: query.dateTo,
      limit: SAMPLE_CAP,
      offset: 0,
    };
  }

  private async workerProductivity(user: AuthPrincipal, query: RunReportQueryDto) {
    const tasks = await this.fetchTasks(user, query, {
      status: WarehouseTaskStatus.completed,
    });

    const byWorker = new Map<
      string,
      { name: string; completed: number; types: Set<string>; durationHours: number }
    >();

    for (const task of tasks) {
      const worker = task.assignments[0]?.worker;
      if (!worker) continue;
      const cur = byWorker.get(worker.id) ?? {
        name: worker.displayName,
        completed: 0,
        types: new Set<string>(),
        durationHours: 0,
      };
      cur.completed += 1;
      cur.types.add(task.taskType);
      if (task.startedAt && task.completedAt) {
        const h = hoursBetween(task.startedAt, task.completedAt);
        if (h != null) cur.durationHours += h;
      }
      byWorker.set(worker.id, cur);
    }

    const rows = [...byWorker.entries()]
      .map(([id, v]) => ({
        id,
        worker: v.name,
        completedTasks: v.completed,
        taskTypes: [...v.types].join(', '),
        avgCycleHours:
          v.completed > 0 ? String(Math.round((v.durationHours / v.completed) * 100) / 100) : '—',
        pickPackCount: v.types.has('pick') || v.types.has('pack') ? v.completed : 0,
      }))
      .sort((a, b) => Number(b.completedTasks) - Number(a.completedTasks));

    return paginate(rows, query.limit, query.offset);
  }

  private async orderCycleTime(user: AuthPrincipal, query: RunReportQueryDto) {
    const params = this.listParams(query);
    const [inboundPage, outboundOrders] = await Promise.all([
      this.inbound.list(user, params),
      this.listOutboundWithLines(user, query),
    ]);

    const rows: ReportRowDto[] = [];

    for (const o of inboundPage.items) {
      if (o.status !== 'completed' || !o.confirmedAt || !o.completedAt) continue;
      const hours = hoursBetween(o.confirmedAt, o.completedAt);
      rows.push({
        id: `in-${o.id}`,
        orderType: 'inbound',
        orderNumber: o.orderNumber,
        client: o.company.name,
        status: o.status,
        cycleHours: hours ?? '—',
        milestoneStart: o.confirmedAt.toISOString().slice(0, 10),
        milestoneEnd: o.completedAt.toISOString().slice(0, 10),
      });
    }

    for (const o of outboundOrders) {
      if (o.status !== 'shipped' || !o.confirmedAt || !o.shippedAt) continue;
      const hours = hoursBetween(o.confirmedAt, o.shippedAt);
      rows.push({
        id: `out-${o.id}`,
        orderType: 'outbound',
        orderNumber: o.orderNumber,
        client: o.company.name,
        status: o.status,
        cycleHours: hours ?? '—',
        milestoneStart: o.confirmedAt.toISOString().slice(0, 10),
        milestoneEnd: o.shippedAt.toISOString().slice(0, 10),
      });
    }

    rows.sort((a, b) => Number(b.cycleHours ?? 0) - Number(a.cycleHours ?? 0));
    return paginate(rows, query.limit, query.offset);
  }

  private async inboundAccuracy(user: AuthPrincipal, query: RunReportQueryDto) {
    const page = await this.inbound.list(user, this.listParams(query));
    const rows: ReportRowDto[] = [];

    for (const o of page.items) {
      if (o.status === 'cancelled' || o.status === 'draft') continue;
      let expectedTotal = 0;
      let matchedTotal = 0;
      let discrepancyLines = 0;

      for (const line of o.lines) {
        const expected = Number(line.expectedQuantity);
        const received = Number(line.receivedQuantity);
        if (!Number.isFinite(expected) || expected <= 0) continue;
        expectedTotal += expected;
        matchedTotal += Math.min(received, expected);
        if (received !== expected) discrepancyLines += 1;
      }

      const accuracy =
        expectedTotal > 0 ? (matchedTotal / expectedTotal) * 100 : o.status === 'completed' ? 100 : 0;

      rows.push({
        id: o.id,
        orderNumber: o.orderNumber,
        client: o.company.name,
        status: o.status,
        lineCount: o.lines.length,
        discrepancyLines,
        accuracyPercent: fmtPct(accuracy),
        receivedVsExpected: `${Math.round(matchedTotal)}/${Math.round(expectedTotal)}`,
      });
    }

    rows.sort(
      (a, b) =>
        parseFloat(String(a.accuracyPercent)) - parseFloat(String(b.accuracyPercent)),
    );
    return paginate(rows, query.limit, query.offset);
  }

  private async outboundFillRate(user: AuthPrincipal, query: RunReportQueryDto) {
    const orders = await this.listOutboundWithLines(user, query);
    const rows: ReportRowDto[] = [];

    for (const o of orders) {
      if (o.status === 'cancelled' || o.status === 'draft') continue;
      let requested = 0;
      let picked = 0;

      for (const line of o.lines) {
        requested += Number(line.requestedQuantity);
        picked += Number(line.pickedQuantity);
      }

      const fillRate = requested > 0 ? (picked / requested) * 100 : 0;
      rows.push({
        id: o.id,
        orderNumber: o.orderNumber,
        client: o.company.name,
        status: o.status,
        requestedQty: Math.round(requested),
        pickedQty: Math.round(picked),
        fillRatePercent: fmtPct(fillRate),
        shortShip: picked < requested ? 'yes' : 'no',
      });
    }

    rows.sort(
      (a, b) =>
        parseFloat(String(a.fillRatePercent)) - parseFloat(String(b.fillRatePercent)),
    );
    return paginate(rows, query.limit, query.offset);
  }

  private async slaCompliance(user: AuthPrincipal, query: RunReportQueryDto) {
    const tasks = await this.fetchTasks(user, query, {
      requireSla: true,
    });

    const byType = new Map<
      string,
      { total: number; onTime: number; breached: number; escalated: number }
    >();
    const now = Date.now();

    for (const task of tasks) {
      if (task.slaMinutes == null || task.startedAt == null) continue;
      const cur = byType.get(task.taskType) ?? { total: 0, onTime: 0, breached: 0, escalated: 0 };
      cur.total += 1;
      if (task.escalationLevel > 0) cur.escalated += 1;

      const deadline = slaBreachDeadlineMs(task.startedAt, task.slaMinutes);
      const completedLate =
        task.completedAt != null && task.completedAt.getTime() > deadline;
      const breachedNow =
        task.status !== WarehouseTaskStatus.completed &&
        isTaskSlaBreached({ startedAt: task.startedAt, slaMinutes: task.slaMinutes }, now);

      if (completedLate || breachedNow) {
        cur.breached += 1;
      } else {
        cur.onTime += 1;
      }
      byType.set(task.taskType, cur);
    }

    const rows = [...byType.entries()]
      .map(([taskType, v]) => ({
        id: taskType,
        taskType,
        totalTasks: v.total,
        onTimeTasks: v.onTime,
        breachedTasks: v.breached,
        escalatedTasks: v.escalated,
        compliancePercent: fmtPct(v.total > 0 ? (v.onTime / v.total) * 100 : 100),
      }))
      .sort(
        (a, b) =>
          parseFloat(String(a.compliancePercent)) - parseFloat(String(b.compliancePercent)),
      );

    return paginate(rows, query.limit, query.offset);
  }

  private async fetchTasks(
    user: AuthPrincipal,
    query: RunReportQueryDto,
    opts: { status?: WarehouseTaskStatus; requireSla?: boolean },
  ) {
    const and: Prisma.WarehouseTaskWhereInput[] = [];

    if (query.warehouseId) {
      and.push({ workflowInstance: { warehouseId: query.warehouseId } });
    }

    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, query.companyId);
    if (companyId) {
      and.push({ workflowInstance: { companyId } });
    } else if (user.tenantScope === 'restricted') {
      and.push({ workflowInstance: { companyId: { in: user.authorizedCompanyIds } } });
    }

    if (opts.status) and.push({ status: opts.status });
    if (query.status?.trim()) and.push({ taskType: query.status.trim() as never });
    if (opts.requireSla) {
      and.push({ slaMinutes: { not: null }, startedAt: { not: null } });
    }

    if (query.dateFrom || query.dateTo) {
      const updatedAt: Prisma.DateTimeFilter = {};
      if (query.dateFrom) updatedAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) updatedAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      and.push({ updatedAt });
    }

    return this.prisma.warehouseTask.findMany({
      where: and.length ? { AND: and } : {},
      take: SAMPLE_CAP,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        taskType: true,
        status: true,
        startedAt: true,
        completedAt: true,
        slaMinutes: true,
        escalationLevel: true,
        assignments: {
          where: { unassignedAt: null },
          take: 1,
          select: {
            worker: { select: { id: true, displayName: true } },
          },
        },
      },
    });
  }

  private async listOutboundWithLines(user: AuthPrincipal, query: RunReportQueryDto) {
    const baseAnd: Prisma.OutboundOrderWhereInput[] = [];
    const where: Prisma.OutboundOrderWhereInput = {};

    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, query.companyId);
    where.companyId = companyId;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    if (query.warehouseId) {
      baseAnd.push(
        await outboundIdsVisibleForWarehouse(this.prisma, query.warehouseId, {
          ...(companyId ? { companyId } : {}),
        }),
      );
    }

    if (baseAnd.length) where.AND = baseAnd;

    return this.prisma.outboundOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_CAP,
      include: {
        company: { select: { id: true, name: true } },
        lines: {
          select: { requestedQuantity: true, pickedQuantity: true },
        },
      },
    });
  }
}
