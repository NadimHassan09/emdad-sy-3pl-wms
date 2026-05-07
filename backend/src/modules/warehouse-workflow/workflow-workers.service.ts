import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  Prisma,
  UserRole,
  UserStatus,
  WorkerOperationalStatus,
  type WorkerOperationalRole,
} from '@prisma/client';

interface CreateWorkerDto {
  displayName: string;
  warehouseId?: string;
  roles: WorkerOperationalRole[];
}

@Injectable()
export class WorkflowWorkersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Task assignment: only workers backed by a **system** user (`users.company_id` null)
   * with **Worker** platform role (`wh_operator`).
   */
  async list(user: AuthPrincipal, warehouseId?: string) {
    if (!user.companyId) return [];
    const where: Prisma.WorkerWhereInput = {
      companyId: user.companyId,
      status: WorkerOperationalStatus.active,
      userId: { not: null },
      user: {
        companyId: null,
        role: UserRole.wh_operator,
        status: UserStatus.active,
      },
    };
    // Workers created from Users often have `warehouse_id` null (tenant-wide). Tasks always pass a
    // workflow warehouse — still list those operators alongside warehouse-specific rows.
    if (warehouseId) {
      where.OR = [{ warehouseId }, { warehouseId: null }];
    }
    return this.prisma.worker.findMany({
      where,
      include: { roles: true, user: { select: { id: true, email: true, fullName: true, role: true } } },
      orderBy: { displayName: 'asc' },
    });
  }

  async create(user: AuthPrincipal, dto: CreateWorkerDto) {
    if (!user.companyId) throw new NotFoundException('company required');
    return this.prisma.worker.create({
      data: {
        companyId: user.companyId,
        warehouseId: dto.warehouseId,
        displayName: dto.displayName,
        roles: {
          createMany: {
            data: dto.roles.map((role) => ({ role })),
          },
        },
      },
      include: { roles: true },
    });
  }

  async workerLoad(user: AuthPrincipal, warehouseId?: string) {
    if (!user.companyId) {
      throw new BadRequestException('companyId required for worker load.');
    }
    const whFilter = warehouseId
      ? Prisma.sql`AND (w.warehouse_id = ${warehouseId}::uuid OR w.warehouse_id IS NULL)`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{
        worker_id: string;
        full_name: string | null;
        in_progress_count: number | null;
        assigned_pending_count: number | null;
        load_score: number | null;
      }>
    >(Prisma.sql`
      SELECT
        v.worker_id,
        v.full_name,
        v.in_progress_count,
        v.assigned_pending_count,
        v.load_score
      FROM v_wms_worker_load v
      INNER JOIN workers w ON w.id = v.worker_id
      INNER JOIN users u ON u.id = w.user_id
      WHERE w.company_id = ${user.companyId}::uuid
        AND w.status = 'active'::worker_operational_status
        AND w.user_id IS NOT NULL
        AND u.company_id IS NULL
        AND u.role = ${UserRole.wh_operator}::user_role
        AND u.status = 'active'::user_status
      ${whFilter}
      ORDER BY v.load_score DESC NULLS LAST, v.full_name ASC
    `);
    return rows.map((r) => ({
      workerId: r.worker_id,
      displayName: r.full_name ?? '',
      inProgressCount: Number(r.in_progress_count ?? 0),
      assignedPendingCount: Number(r.assigned_pending_count ?? 0),
      loadScore: Number(r.load_score ?? 0),
    }));
  }

  async get(workerId: string, user: AuthPrincipal) {
    const w = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        roles: true,
        taskAssignments: {
          where: { unassignedAt: null },
          take: 20,
          include: { task: true },
        },
      },
    });
    if (!w || (user.companyId && w.companyId !== user.companyId)) {
      throw new NotFoundException('Worker not found.');
    }

    const openTaskCount = await this.prisma.taskAssignment.count({
      where: { workerId, unassignedAt: null },
    });

    return { ...w, openTaskCount };
  }
}
