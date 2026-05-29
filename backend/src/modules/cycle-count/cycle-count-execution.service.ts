import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CycleCountStatus, Prisma, UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BlindCycleCountTaskListItem,
  presentBlindCycleCountTask,
} from './cycle-count-blind.presenter';
import { CycleCountLineMutationService } from './cycle-count-line-mutation.service';
import { CycleCountService } from './cycle-count.service';
import { SubmitLineCountDto } from './dto/submit-line-count.dto';
import { SkipCycleCountLineDto } from './dto/skip-cycle-count-line.dto';

const EXECUTION_COUNT_INCLUDE = {
  warehouse: { select: { id: true, code: true, name: true } },
  lines: {
    include: {
      product: {
        select: { id: true, sku: true, name: true, barcode: true, uom: true },
      },
      location: { select: { id: true, name: true, fullPath: true, barcode: true } },
      lot: { select: { id: true, lotNumber: true } },
    },
    orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { lotId: 'asc' }] as const,
  },
} satisfies Prisma.CycleCountInclude;

@Injectable()
export class CycleCountExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly lineMutation: CycleCountLineMutationService,
    private readonly cycleCounts: CycleCountService,
  ) {}

  async listMyTasks(user: AuthPrincipal, warehouseId?: string) {
    const workerId = await this.requireWorkerId(user);
    const companyId = this.companyAccess.requireReadTenantScope(user);

    const statuses: CycleCountStatus[] = [
      CycleCountStatus.scheduled,
      CycleCountStatus.in_progress,
    ];

    const where: Prisma.CycleCountWhereInput = {
      status: { in: statuses },
      OR: [
        { assignedWorkerId: workerId },
        { executingWorkerId: workerId },
        {
          lines: {
            some: {
              assignedWorkerId: workerId,
              status: 'pending',
            },
          },
        },
        {
          assignedWorkerId: null,
          executingWorkerId: null,
          lines: { some: { assignedWorkerId: null, status: 'pending' } },
        },
      ],
    };
    if (companyId) where.companyId = companyId;
    if (warehouseId) where.warehouseId = warehouseId;

    const rows = await this.prisma.cycleCount.findMany({
      where,
      select: {
        id: true,
        status: true,
        snapshotAt: true,
        startedAt: true,
        assignedWorkerId: true,
        executingWorkerId: true,
        warehouse: { select: { id: true, code: true, name: true } },
        lines: { select: { id: true, status: true, assignedWorkerId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows
      .filter((c) => this.workerCanAccessCount(workerId, c))
      .map((c) => this.toListItem(workerId, c));
  }

  async getTask(user: AuthPrincipal, countId: string) {
    const workerId = await this.requireWorkerId(user);
    const count = await this.loadCountForExecution(countId, user, workerId);
    return presentBlindCycleCountTask(count);
  }

  async claimTask(user: AuthPrincipal, countId: string) {
    const workerId = await this.requireWorkerId(user);
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
      include: { lines: { select: { assignedWorkerId: true } } },
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
    this.companyAccess.validateResourceOwnership(user, count);
    if (
      count.status !== CycleCountStatus.scheduled &&
      count.status !== CycleCountStatus.in_progress
    ) {
      throw new InvalidStateException('This count is not open for execution.');
    }
    if (!this.workerCanAccessCount(workerId, count)) {
      throw new NotFoundException('Cycle count not found.');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM cycle_counts WHERE id = ${countId}::uuid FOR UPDATE
      `;

      const locked = await tx.cycleCount.findUnique({ where: { id: countId } });
      if (!locked) throw new NotFoundException('Cycle count not found.');
      if (
        locked.status !== CycleCountStatus.scheduled &&
        locked.status !== CycleCountStatus.in_progress
      ) {
        throw new InvalidStateException('This count is not open for execution.');
      }

      if (
        locked.executingWorkerId &&
        locked.executingWorkerId !== workerId &&
        locked.status === CycleCountStatus.in_progress
      ) {
        throw new ConflictException(
          'Another worker is already executing this cycle count.',
        );
      }

      const otherActive = await tx.cycleCount.findFirst({
        where: {
          executingWorkerId: workerId,
          status: CycleCountStatus.in_progress,
          id: { not: countId },
        },
        select: { id: true },
      });
      if (otherActive) {
        throw new ConflictException(
          'Finish or release your current in-progress cycle count before claiming another.',
        );
      }

      const data: Prisma.CycleCountUpdateInput = {
        executingWorker: { connect: { id: workerId } },
        updatedAt: now,
      };
      if (locked.status === CycleCountStatus.scheduled) {
        data.status = CycleCountStatus.in_progress;
        data.startedAt = now;
      }

      await tx.cycleCount.update({ where: { id: countId }, data });

      const full = await tx.cycleCount.findUniqueOrThrow({
        where: { id: countId },
        include: EXECUTION_COUNT_INCLUDE,
      });
      return presentBlindCycleCountTask(full);
    });
  }

  async submitLineCount(
    user: AuthPrincipal,
    countId: string,
    lineId: string,
    dto: SubmitLineCountDto,
  ) {
    const workerId = await this.requireWorkerId(user);
    await this.assertLineAssignable(user, countId, lineId, workerId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM cycle_count_lines
         WHERE id = ${lineId}::uuid AND cycle_count_id = ${countId}::uuid
         FOR UPDATE
      `;
      await this.lineMutation.countLine(tx, {
        cycleCountId: countId,
        lineId,
        requiredStatus: CycleCountStatus.in_progress,
        userId: user.id,
        input: dto,
      });
    });

    return this.getTask(user, countId);
  }

  async skipLine(
    user: AuthPrincipal,
    countId: string,
    lineId: string,
    dto: SkipCycleCountLineDto,
  ) {
    const workerId = await this.requireWorkerId(user);
    await this.assertLineAssignable(user, countId, lineId, workerId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM cycle_count_lines
         WHERE id = ${lineId}::uuid AND cycle_count_id = ${countId}::uuid
         FOR UPDATE
      `;
      await this.lineMutation.skipLine(tx, {
        cycleCountId: countId,
        lineId,
        requiredStatus: CycleCountStatus.in_progress,
        userId: user.id,
        countNotes: dto.countNotes,
      });
    });

    return this.getTask(user, countId);
  }

  /** Worker completes counting and submits for supervisor review. */
  async finishTask(user: AuthPrincipal, countId: string) {
    const workerId = await this.requireWorkerId(user);
    const count = await this.prisma.cycleCount.findUnique({ where: { id: countId } });
    if (!count) throw new NotFoundException('Cycle count not found.');
    this.companyAccess.validateResourceOwnership(user, count);

    if (count.executingWorkerId && count.executingWorkerId !== workerId) {
      throw new ForbiddenException('Only the executing worker can finish this count.');
    }
    if (
      count.assignedWorkerId &&
      count.assignedWorkerId !== workerId &&
      count.executingWorkerId !== workerId
    ) {
      throw new ForbiddenException('You are not assigned to this cycle count.');
    }

    const updated = await this.cycleCounts.submitForReview(user, countId);
    return {
      id: updated.id,
      status: updated.status,
      message: 'Count submitted for supervisor review.',
    };
  }

  private async loadCountForExecution(
    countId: string,
    user: AuthPrincipal,
    workerId: string,
  ) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
      include: EXECUTION_COUNT_INCLUDE,
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
    this.companyAccess.validateResourceOwnership(user, count);

    const readableStatuses: CycleCountStatus[] = [
      CycleCountStatus.scheduled,
      CycleCountStatus.in_progress,
      CycleCountStatus.pending_review,
    ];
    if (!readableStatuses.includes(count.status)) {
      throw new InvalidStateException('This count is not available for execution.');
    }
    if (
      count.status === CycleCountStatus.pending_review &&
      count.executingWorkerId !== workerId
    ) {
      throw new NotFoundException('Cycle count not found.');
    }
    if (!this.workerCanAccessCount(workerId, count)) {
      throw new NotFoundException('Cycle count not found.');
    }
    return count;
  }

  private async assertLineAssignable(
    user: AuthPrincipal,
    countId: string,
    lineId: string,
    workerId: string,
  ) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
      include: {
        lines: {
          where: { id: lineId },
          select: { id: true, assignedWorkerId: true, status: true },
        },
      },
    });
    if (!count || count.lines.length === 0) {
      throw new NotFoundException('Cycle count line not found.');
    }
    this.companyAccess.validateResourceOwnership(user, count);
    if (count.status !== CycleCountStatus.in_progress) {
      throw new InvalidStateException('Start or claim the count before entering quantities.');
    }
    if (count.executingWorkerId && count.executingWorkerId !== workerId) {
      throw new ForbiddenException('Another worker is executing this cycle count.');
    }
    const line = count.lines[0]!;
    if (line.assignedWorkerId && line.assignedWorkerId !== workerId) {
      throw new ForbiddenException('This location is assigned to another worker.');
    }
    if (
      count.assignedWorkerId &&
      count.assignedWorkerId !== workerId &&
      !line.assignedWorkerId
    ) {
      throw new ForbiddenException('Claim the cycle count before counting unassigned lines.');
    }
  }

  private workerCanAccessCount(
    workerId: string,
    count: {
      assignedWorkerId: string | null;
      executingWorkerId?: string | null;
      lines: Array<{ assignedWorkerId: string | null }>;
    },
  ): boolean {
    if (count.assignedWorkerId === workerId || count.executingWorkerId === workerId) {
      return true;
    }
    const hasLine = count.lines.some((l) => l.assignedWorkerId === workerId);
    if (hasLine) return true;
    if (!count.assignedWorkerId) {
      return count.lines.some((l) => !l.assignedWorkerId);
    }
    return false;
  }

  private toListItem(
    workerId: string,
    count: {
      id: string;
      status: CycleCountStatus;
      snapshotAt: Date | null;
      startedAt: Date | null;
      assignedWorkerId: string | null;
      executingWorkerId: string | null;
      warehouse: { id: string; code: string; name: string };
      lines: Array<{ status: string; assignedWorkerId: string | null }>;
    },
  ): BlindCycleCountTaskListItem {
    const pending = count.lines.filter((l) => l.status === 'pending').length;
    let assignmentScope: BlindCycleCountTaskListItem['assignmentScope'] = 'pool';
    if (count.assignedWorkerId === workerId || count.executingWorkerId === workerId) {
      assignmentScope = 'session';
    } else if (count.lines.some((l) => l.assignedWorkerId === workerId)) {
      assignmentScope = 'line';
    }

    return {
      id: count.id,
      warehouse: count.warehouse,
      status: count.status,
      snapshotAt: count.snapshotAt,
      startedAt: count.startedAt,
      progress: { totalLines: count.lines.length, pending },
      assignmentScope,
    };
  }

  private async requireWorkerId(user: AuthPrincipal): Promise<string> {
    if (user.role !== UserRole.wh_operator) {
      const worker = await this.prisma.worker.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (worker) return worker.id;
      throw new ForbiddenException(
        'Cycle count execution requires an operator linked to a Worker profile.',
      );
    }
    const worker = await this.prisma.worker.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true },
    });
    if (!worker) {
      throw new ForbiddenException(
        'Your user account is not linked to a Worker profile. Ask an admin to link Users → Worker.',
      );
    }
    if (worker.status !== 'active') {
      throw new ForbiddenException('Your worker profile is inactive.');
    }
    return worker.id;
  }
}
