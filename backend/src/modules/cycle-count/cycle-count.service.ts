import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CycleCountSource,
  CycleCountStatus,
  Prisma,
} from '@prisma/client';

import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { RealtimeService } from '../realtime/realtime.service';
import {
  cycleCountDetailPayload,
  cycleCountListItemPayload,
} from '../realtime/realtime-ops.payload';
import {
  addDays,
  CYCLE_COUNT_ACTIVE_STATUSES,
  isValidCycleCountInterval,
} from './cycle-count.constants';
import { CycleCountSnapshotService } from './cycle-count-snapshot.service';
import { CycleCountLineMutationService } from './cycle-count-line-mutation.service';
import { CycleCountVarianceDetectionService } from './cycle-count-variance-detection.service';
import { CycleCountVarianceService } from './cycle-count-variance.service';
import { AssignCycleCountDto } from './dto/assign-cycle-count.dto';
import { AssignCycleCountLineDto } from './dto/assign-cycle-count-line.dto';
import { CreateCycleCountDto } from './dto/create-cycle-count.dto';
import {
  ListCycleCountsQueryDto,
  parseDiscrepancyOnly,
} from './dto/list-cycle-counts-query.dto';
import {
  ListProductHistoryQueryDto,
  parseOverdueOnly,
} from './dto/list-product-history-query.dto';
import { SkipCycleCountLineDto } from './dto/skip-cycle-count-line.dto';
import { SubmitLineCountDto } from './dto/submit-line-count.dto';
import { UpsertCycleCountScheduleDto } from './dto/upsert-cycle-count-schedule.dto';

const SCHEDULE_INCLUDE = {
  company: { select: { id: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  creator: { select: { id: true, fullName: true } },
} satisfies Prisma.CycleCountScheduleInclude;

const COUNT_DETAIL_INCLUDE = {
  company: { select: { id: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  schedule: { select: { id: true, intervalDays: true } },
  assignedWorker: { select: { id: true, displayName: true } },
  creator: { select: { id: true, fullName: true } },
  lines: {
    include: {
      product: { select: { id: true, sku: true, name: true, barcode: true, uom: true } },
      location: { select: { id: true, name: true, fullPath: true, barcode: true } },
      lot: { select: { id: true, lotNumber: true } },
      assignedWorker: { select: { id: true, displayName: true } },
      counter: { select: { id: true, fullName: true } },
    },
    orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { lotId: 'asc' }] as const,
  },
} satisfies Prisma.CycleCountInclude;

@Injectable()
export class CycleCountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly snapshot: CycleCountSnapshotService,
    private readonly lineMutation: CycleCountLineMutationService,
    private readonly varianceDetection: CycleCountVarianceDetectionService,
    private readonly variances: CycleCountVarianceService,
    private readonly audit: AuditLogService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------------------------------------------------------------------------
  // Schedules
  // ---------------------------------------------------------------------------

  async upsertSchedule(user: AuthPrincipal, dto: UpsertCycleCountScheduleDto) {
    if (!isValidCycleCountInterval(dto.intervalDays)) {
      throw new BadRequestException('intervalDays must be 7, 30, or 90.');
    }
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.assertWarehouse(dto.warehouseId);

    const now = new Date();
    const nextRunAt = addDays(now, dto.intervalDays);

    return this.prisma.cycleCountSchedule.upsert({
      where: {
        companyId_warehouseId: { companyId, warehouseId: dto.warehouseId },
      },
      create: {
        companyId,
        warehouseId: dto.warehouseId,
        intervalDays: dto.intervalDays,
        enabled: dto.enabled ?? true,
        includeZeroOnHand: dto.includeZeroOnHand ?? false,
        nextRunAt,
        createdBy: user.id,
      },
      update: {
        intervalDays: dto.intervalDays,
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.includeZeroOnHand !== undefined
          ? { includeZeroOnHand: dto.includeZeroOnHand }
          : {}),
        updatedAt: now,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  listSchedules(user: AuthPrincipal, companyIdParam?: string) {
    const companyId = readCompanyIdFilterRequired(
      this.companyAccess,
      user,
      companyIdParam,
    );
    return withTenantRls(this.prisma, user, async (tx) =>
      tx.cycleCountSchedule.findMany({
        where: companyId ? { companyId } : {},
        include: SCHEDULE_INCLUDE,
        orderBy: [{ warehouseId: 'asc' }],
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Count sessions
  // ---------------------------------------------------------------------------

  async createManual(user: AuthPrincipal, dto: CreateCycleCountDto) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.assertWarehouse(dto.warehouseId);
    if (dto.assignedWorkerId) {
      await this.assertWorkerForWarehouse(dto.assignedWorkerId, companyId, dto.warehouseId);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveCount(tx, companyId, dto.warehouseId);

      const snapshotAt = new Date();
      const count = await tx.cycleCount.create({
        data: {
          companyId,
          warehouseId: dto.warehouseId,
          source: CycleCountSource.manual,
          status: CycleCountStatus.scheduled,
          snapshotAt,
          assignedWorkerId: dto.assignedWorkerId,
          createdBy: user.id,
          notes: dto.notes?.trim() || null,
        },
      });

      const rows = await this.snapshot.buildSnapshotRows(tx, {
        companyId,
        warehouseId: dto.warehouseId,
        productIds: dto.productIds,
        includeZeroOnHand: false,
      });
      if (rows.length === 0) {
        throw new BadRequestException(
          'No stock rows match the cycle count scope (check products and warehouse).',
        );
      }
      await this.snapshot.insertLines(tx, count.id, rows, dto.assignedWorkerId);

      const detail = await tx.cycleCount.findUniqueOrThrow({
        where: { id: count.id },
        include: COUNT_DETAIL_INCLUDE,
      });
      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'CYCLE_COUNT_CREATED',
          resourceType: 'cycle_count',
          resourceId: detail.id,
          companyId: detail.companyId,
          newState: {
            status: detail.status,
            warehouseId: detail.warehouseId,
            lineCount: detail.lines.length,
            source: detail.source,
          },
        }),
      );
      return detail;
    }).then((detail) => {
      this.emitCycleCountEvent(detail, 'created');
      return detail;
    });
  }

  list(user: AuthPrincipal, query: ListCycleCountsQueryDto) {
    const where: Prisma.CycleCountWhereInput = {};
    const companyId = readCompanyIdFilterRequired(
      this.companyAccess,
      user,
      query.companyId,
    );
    if (companyId) {
      where.companyId = companyId;
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (parseDiscrepancyOnly(query.discrepancyOnly)) {
      where.status = CycleCountStatus.pending_review;
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.assignedWorkerId) where.assignedWorkerId = query.assignedWorkerId;
    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.cycleCount.findMany({
          where,
          include: {
            company: { select: { id: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            assignedWorker: { select: { id: true, displayName: true } },
            schedule: { select: { id: true, intervalDays: true } },
            _count: { select: { lines: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
        }),
        tx.cycleCount.count({ where }),
      ]);
      return { items, total, limit: query.limit, offset: query.offset };
    });
  }

  async findById(user: AuthPrincipal, id: string) {
    const row = await this.prisma.cycleCount.findUnique({
      where: { id },
      include: COUNT_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Cycle count not found.');
    this.companyAccess.validateResourceOwnership(user, row);
    return row;
  }

  async start(user: AuthPrincipal, id: string) {
    const count = await this.requireCount(id);
    this.companyAccess.validateResourceOwnership(user, count);
    if (count.status !== CycleCountStatus.scheduled) {
      throw new InvalidStateException('Only scheduled cycle counts can be started.');
    }
    const now = new Date();
    return this.prisma.cycleCount.update({
      where: { id },
      data: {
        status: CycleCountStatus.in_progress,
        startedAt: now,
        updatedAt: now,
      },
      include: COUNT_DETAIL_INCLUDE,
    }).then((updated) => {
      this.emitCycleCountEvent(updated, 'updated');
      return updated;
    });
  }

  async assignSession(user: AuthPrincipal, id: string, dto: AssignCycleCountDto) {
    const count = await this.requireCount(id);
    this.companyAccess.validateResourceOwnership(user, count);
    if (
      count.status === CycleCountStatus.completed ||
      count.status === CycleCountStatus.cancelled
    ) {
      throw new InvalidStateException('Cannot assign a closed cycle count.');
    }
    if (dto.assignedWorkerId) {
      await this.assertWorkerForWarehouse(
        dto.assignedWorkerId,
        count.companyId,
        count.warehouseId,
      );
    }
    return this.prisma.cycleCount.update({
      where: { id },
      data: {
        assignedWorkerId: dto.assignedWorkerId ?? null,
        updatedAt: new Date(),
      },
      include: COUNT_DETAIL_INCLUDE,
    }).then((updated) => {
      this.emitCycleCountEvent(updated, 'updated');
      return updated;
    });
  }

  async assignLine(
    user: AuthPrincipal,
    countId: string,
    lineId: string,
    dto: AssignCycleCountLineDto,
  ) {
    const count = await this.requireCount(countId);
    this.companyAccess.validateResourceOwnership(user, count);
    if (
      count.status !== CycleCountStatus.scheduled &&
      count.status !== CycleCountStatus.in_progress
    ) {
      throw new InvalidStateException('Lines can only be assigned while the count is open.');
    }
    const line = await this.prisma.cycleCountLine.findFirst({
      where: { id: lineId, cycleCountId: countId },
    });
    if (!line) throw new NotFoundException('Cycle count line not found.');
    if (dto.assignedWorkerId) {
      await this.assertWorkerForWarehouse(
        dto.assignedWorkerId,
        count.companyId,
        count.warehouseId,
      );
    }
    await this.prisma.cycleCountLine.update({
      where: { id: lineId },
      data: { assignedWorkerId: dto.assignedWorkerId ?? null },
    });
    return this.findById(user, countId);
  }

  async submitLineCount(
    user: AuthPrincipal,
    countId: string,
    lineId: string,
    dto: SubmitLineCountDto,
  ) {
    const count = await this.requireCount(countId);
    this.companyAccess.validateResourceOwnership(user, count);
    if (count.status !== CycleCountStatus.in_progress) {
      throw new InvalidStateException('Counts can only be entered while in progress.');
    }
    const line = await this.prisma.cycleCountLine.findFirst({
      where: { id: lineId, cycleCountId: countId },
    });
    if (!line) throw new NotFoundException('Cycle count line not found.');
    if (line.status !== 'pending') {
      throw new InvalidStateException('Line is already counted or skipped.');
    }

    const actual = new Prisma.Decimal(dto.actualQuantity);
    const discrepancy = actual.minus(line.expectedQuantity);
    const now = new Date();

    await this.prisma.cycleCountLine.update({
      where: { id: lineId },
      data: {
        actualQuantity: actual,
        discrepancyQuantity: discrepancy,
        status: 'counted',
        countedBy: user.id,
        countedAt: now,
        countNotes: dto.countNotes?.trim() || null,
      },
    });
    return this.findById(user, countId);
  }

  async skipLine(
    user: AuthPrincipal,
    countId: string,
    lineId: string,
    dto: SkipCycleCountLineDto,
  ) {
    const count = await this.requireCount(countId);
    this.companyAccess.validateResourceOwnership(user, count);
    if (count.status !== CycleCountStatus.in_progress) {
      throw new InvalidStateException('Lines can only be skipped while in progress.');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lineMutation.skipLine(tx, {
        cycleCountId: countId,
        lineId,
        requiredStatus: CycleCountStatus.in_progress,
        userId: user.id,
        countNotes: dto.countNotes,
      });
    });
    return this.findById(user, countId);
  }

  async submitForReview(user: AuthPrincipal, id: string) {
    const count = await this.requireCount(id);
    this.companyAccess.validateResourceOwnership(user, count);
    if (count.status !== CycleCountStatus.in_progress) {
      throw new InvalidStateException('Only in-progress counts can be submitted for review.');
    }
    const pending = await this.prisma.cycleCountLine.count({
      where: { cycleCountId: id, status: 'pending' },
    });
    if (pending > 0) {
      throw new BadRequestException(
        `${pending} line(s) still pending — count or skip each line before review.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cycleCount.update({
        where: { id },
        data: {
          status: CycleCountStatus.pending_review,
          updatedAt: new Date(),
        },
        include: COUNT_DETAIL_INCLUDE,
      });

      const detected = await this.varianceDetection.detectFromCount(tx, id);
      return { ...updated, variancesDetected: detected };
    }).then((updated) => {
      this.emitCycleCountEvent(updated, 'updated');
      return updated;
    });
  }

  /** Completes review after variances are resolved and any reconciliation is posted. */
  async complete(user: AuthPrincipal, id: string) {
    const count = await this.requireCount(id);
    this.companyAccess.validateResourceOwnership(user, count);
    if (count.status !== CycleCountStatus.pending_review) {
      throw new InvalidStateException('Only counts pending review can be completed.');
    }

    await this.variances.assertCountCanComplete(id);

    const schedule = count.scheduleId
      ? await this.prisma.cycleCountSchedule.findUnique({
          where: { id: count.scheduleId },
          select: { intervalDays: true },
        })
      : null;
    const intervalDays = schedule?.intervalDays ?? 30;
    const completedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cycleCount.update({
        where: { id },
        data: {
          status: CycleCountStatus.completed,
          completedAt,
          updatedAt: completedAt,
        },
        include: COUNT_DETAIL_INCLUDE,
      });
      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'CYCLE_COUNT_COMPLETED',
          resourceType: 'cycle_count',
          resourceId: id,
          companyId: count.companyId,
          previousState: { status: count.status },
          newState: {
            status: updated.status,
            completedAt: completedAt.toISOString(),
            lineCount: updated.lines.length,
          },
        }),
      );

      const productIds = [
        ...new Set(updated.lines.map((l) => l.productId)),
      ];
      for (const productId of productIds) {
        const nextDueAt = addDays(completedAt, intervalDays);
        await tx.cycleCountProductHistory.upsert({
          where: {
            companyId_warehouseId_productId: {
              companyId: count.companyId,
              warehouseId: count.warehouseId,
              productId,
            },
          },
          create: {
            companyId: count.companyId,
            warehouseId: count.warehouseId,
            productId,
            lastCountedAt: completedAt,
            lastCycleCountId: id,
            nextDueAt,
            completionCount: 1,
          },
          update: {
            lastCountedAt: completedAt,
            lastCycleCountId: id,
            nextDueAt,
            completionCount: { increment: 1 },
            updatedAt: completedAt,
          },
        });
      }

      return updated;
    }).then((updated) => {
      this.emitCycleCountEvent(updated, 'completed');
      return updated;
    });
  }

  async cancel(user: AuthPrincipal, id: string) {
    const count = await this.requireCount(id);
    this.companyAccess.validateResourceOwnership(user, count);
    if (
      count.status === CycleCountStatus.completed ||
      count.status === CycleCountStatus.cancelled
    ) {
      throw new InvalidStateException('Cycle count is already closed.');
    }
    return this.prisma.cycleCount.update({
      where: { id },
      data: {
        status: CycleCountStatus.cancelled,
        updatedAt: new Date(),
      },
      include: COUNT_DETAIL_INCLUDE,
    }).then((updated) => {
      this.emitCycleCountEvent(updated, 'updated');
      return updated;
    });
  }

  private emitCycleCountEvent(
    count: Record<string, unknown> & { companyId: string; lines?: unknown[] },
    kind: 'created' | 'updated' | 'completed',
  ): void {
    const withCount = {
      ...count,
      _count: { lines: (count.lines as unknown[] | undefined)?.length ?? 0 },
    };
    const listItem = cycleCountListItemPayload(
      withCount as Parameters<typeof cycleCountListItemPayload>[0],
    );
    const detail = cycleCountDetailPayload(count);
    const payload = { listItem, count: detail };
    switch (kind) {
      case 'created':
        this.realtime.emitCycleCountCreated(count.companyId, payload);
        break;
      case 'updated':
        this.realtime.emitCycleCountUpdated(count.companyId, payload);
        break;
      case 'completed':
        this.realtime.emitCycleCountCompleted(count.companyId, payload);
        break;
    }
  }

  /** Push list/detail patches to connected clients after worker execution mutations. */
  async publishRealtimeUpdate(countId: string): Promise<void> {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
      include: COUNT_DETAIL_INCLUDE,
    });
    if (count) this.emitCycleCountEvent(count, 'updated');
  }

  listProductHistory(user: AuthPrincipal, query: ListProductHistoryQueryDto) {
    const companyId = readCompanyIdFilterRequired(
      this.companyAccess,
      user,
      query.companyId,
    );
    const where: Prisma.CycleCountProductHistoryWhereInput = {
      warehouseId: query.warehouseId,
      ...(query.productId ? { productId: query.productId } : {}),
    };
    if (companyId) {
      where.companyId = companyId;
    }
    if (parseOverdueOnly(query.overdueOnly)) {
      where.nextDueAt = { lt: new Date() };
    }
    if (query.lastCountedFrom || query.lastCountedTo) {
      const lastCountedAt: Prisma.DateTimeFilter = {};
      if (query.lastCountedFrom) {
        lastCountedAt.gte = new Date(`${query.lastCountedFrom}T00:00:00.000Z`);
      }
      if (query.lastCountedTo) {
        lastCountedAt.lte = new Date(`${query.lastCountedTo}T23:59:59.999Z`);
      }
      where.lastCountedAt = lastCountedAt;
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.cycleCountProductHistory.findMany({
          where,
          include: {
            product: { select: { id: true, sku: true, name: true } },
          },
          orderBy: { nextDueAt: 'asc' },
          take: query.limit,
          skip: query.offset,
        }),
        tx.cycleCountProductHistory.count({ where }),
      ]);
      return { items, total, limit: query.limit, offset: query.offset };
    });
  }

  // ---------------------------------------------------------------------------
  // Scheduler / internal generation
  // ---------------------------------------------------------------------------

  async findDueProductIds(
    companyId: string,
    warehouseId: string,
    intervalDays: number,
    includeZeroOnHand: boolean,
  ): Promise<string[]> {
    const now = new Date();
    const stockRows = await this.prisma.currentStock.findMany({
      where: {
        companyId,
        warehouseId,
        packageId: null,
        ...(includeZeroOnHand ? {} : { quantityOnHand: { gt: 0 } }),
        location: { type: { in: ['internal', 'fridge', 'quarantine', 'scrap'] } },
      },
      select: { productId: true },
      distinct: ['productId'],
    });
    const productIds = stockRows.map((r) => r.productId);
    if (productIds.length === 0) return [];

    const histories = await this.prisma.cycleCountProductHistory.findMany({
      where: { companyId, warehouseId, productId: { in: productIds } },
    });
    const byProduct = new Map(histories.map((h) => [h.productId, h]));

    return productIds.filter((productId) => {
      const h = byProduct.get(productId);
      if (!h) return true;
      if (h.nextDueAt) return h.nextDueAt.getTime() <= now.getTime();
      return addDays(h.lastCountedAt, intervalDays).getTime() <= now.getTime();
    });
  }

  async generateFromSchedule(
    scheduleId: string,
    createdByUserId: string,
  ): Promise<{ created: boolean; cycleCountId?: string }> {
    const schedule = await this.prisma.cycleCountSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule || !schedule.enabled) return { created: false };

    const dueProductIds = await this.findDueProductIds(
      schedule.companyId,
      schedule.warehouseId,
      schedule.intervalDays,
      schedule.includeZeroOnHand,
    );

    const now = new Date();
    const nextRunAt = addDays(now, schedule.intervalDays);

    if (dueProductIds.length === 0) {
      await this.prisma.cycleCountSchedule.update({
        where: { id: scheduleId },
        data: { lastRunAt: now, nextRunAt, updatedAt: now },
      });
      return { created: false };
    }

    return this.prisma.$transaction(async (tx) => {
      const active = await tx.cycleCount.findFirst({
        where: {
          companyId: schedule.companyId,
          warehouseId: schedule.warehouseId,
          status: { in: [...CYCLE_COUNT_ACTIVE_STATUSES] },
        },
        select: { id: true },
      });
      if (active) {
        await tx.cycleCountSchedule.update({
          where: { id: scheduleId },
          data: { lastRunAt: now, nextRunAt, updatedAt: now },
        });
        return { created: false };
      }

      const snapshotAt = now;
      const count = await tx.cycleCount.create({
        data: {
          scheduleId: schedule.id,
          companyId: schedule.companyId,
          warehouseId: schedule.warehouseId,
          source: CycleCountSource.scheduled,
          status: CycleCountStatus.scheduled,
          snapshotAt,
          createdBy: createdByUserId,
        },
      });

      const rows = await this.snapshot.buildSnapshotRows(tx, {
        companyId: schedule.companyId,
        warehouseId: schedule.warehouseId,
        productIds: dueProductIds,
        includeZeroOnHand: schedule.includeZeroOnHand,
      });
      await this.snapshot.insertLines(tx, count.id, rows);

      await tx.cycleCountSchedule.update({
        where: { id: scheduleId },
        data: { lastRunAt: now, nextRunAt, updatedAt: now },
      });

      return { created: true, cycleCountId: count.id };
    });
  }

  async runDueSchedules(systemUserId: string): Promise<number> {
    const now = new Date();
    const due = await this.prisma.cycleCountSchedule.findMany({
      where: {
        enabled: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
    });
    let generated = 0;
    for (const s of due) {
      const result = await this.generateFromSchedule(s.id, systemUserId);
      if (result.created) generated += 1;
    }
    return generated;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async requireCount(id: string) {
    const count = await this.prisma.cycleCount.findUnique({ where: { id } });
    if (!count) throw new NotFoundException('Cycle count not found.');
    return count;
  }

  private async assertWarehouse(warehouseId: string) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException('Warehouse not found.');
  }

  private async assertWorkerForWarehouse(
    workerId: string,
    companyId: string,
    warehouseId: string,
  ) {
    const worker = await this.prisma.worker.findFirst({
      where: {
        id: workerId,
        companyId,
        status: 'active',
        OR: [{ warehouseId: null }, { warehouseId }],
      },
    });
    if (!worker) {
      throw new BadRequestException('Worker not found or not eligible for this warehouse.');
    }
  }

  private async assertNoActiveCount(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
  ) {
    const active = await tx.cycleCount.findFirst({
      where: {
        companyId,
        warehouseId,
        status: { in: [...CYCLE_COUNT_ACTIVE_STATUSES] },
      },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException(
        'An active cycle count already exists for this warehouse. Complete or cancel it first.',
      );
    }
  }
}
