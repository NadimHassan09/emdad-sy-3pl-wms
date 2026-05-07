import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UserRole,
  UserStatus,
  WorkerOperationalRole,
  WorkerOperationalStatus,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PasswordService } from '../../common/crypto/password.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, CreateSystemRoleUi } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_LIST_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  lastActivityAt: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

const DEFAULT_WORKER_ROLES: WorkerOperationalRole[] = ['receiver', 'picker', 'packer'];

export type UserListRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: string;
  companyId: string | null;
  companyName: string | null;
  kind: 'system' | 'client';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
};

function mapSystemRoleToUserRole(ui: CreateSystemRoleUi): UserRole {
  switch (ui) {
    case 'super_admin':
      return UserRole.super_admin;
    case 'admin':
      return UserRole.wh_manager;
    case 'worker':
      return UserRole.wh_operator;
    default:
      return UserRole.wh_operator;
  }
}

const SYSTEM_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.wh_manager,
  UserRole.wh_operator,
  UserRole.finance,
];
const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<UserListRow[]> {
    const kind = query.kind ?? 'all';
    const where: Prisma.UserWhereInput = {};
    if (kind === 'system') {
      where.companyId = null;
    } else if (kind === 'client') {
      where.companyId = { not: null };
    }

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ email: 'asc' }],
      select: USER_LIST_SELECT,
    });

    return rows.map((u) => this.toListRow(u));
  }

  async findById(id: string): Promise<UserListRow> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: USER_LIST_SELECT,
    });
    if (!u) throw new NotFoundException('User not found.');
    return this.toListRow(u);
  }

  async create(dto: CreateUserDto, actor: AuthPrincipal) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.count({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await this.password.hash(dto.password);

    if (dto.kind === 'system') {
      const role = mapSystemRoleToUserRole(dto.systemRole);
      const shouldProvisionWorker =
        role === UserRole.wh_operator && !!actor.companyId;

      if (shouldProvisionWorker && dto.workerWarehouseId) {
        const wh = await this.prisma.warehouse.findUnique({
          where: { id: dto.workerWarehouseId },
          select: { id: true },
        });
        if (!wh) {
          throw new NotFoundException('Warehouse not found.');
        }
      }

      return this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email,
            fullName: dto.fullName.trim(),
            phone: dto.phone?.trim() || null,
            passwordHash,
            role,
            companyId: null,
          },
          select: USER_LIST_SELECT,
        });

        if (shouldProvisionWorker) {
          await tx.worker.create({
            data: {
              companyId: actor.companyId!,
              warehouseId: dto.workerWarehouseId ?? null,
              displayName: dto.fullName.trim(),
              userId: u.id,
              roles: {
                createMany: {
                  data: DEFAULT_WORKER_ROLES.map((r) => ({ role: r })),
                },
              },
            },
          });
        }

        return this.toListRow(u);
      });
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    const u = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        passwordHash,
        role: dto.clientRole,
        companyId: dto.companyId,
      },
      select: USER_LIST_SELECT,
    });

    return this.toListRow(u);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthPrincipal) {
    const keys = Object.keys(dto).filter((k) => dto[k as keyof UpdateUserDto] !== undefined);
    if (keys.length === 0) {
      throw new BadRequestException('No changes provided.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        companyId: true,
        role: true,
        fullName: true,
        status: true,
      },
    });
    if (!existing) throw new NotFoundException('User not found.');

    const isSystem = existing.companyId === null;

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const clash = await this.prisma.user.count({ where: { email, NOT: { id } } });
      if (clash) throw new ConflictException('A user with this email already exists.');
    }

    if (dto.role !== undefined) {
      if (isSystem && !SYSTEM_ROLES.includes(dto.role)) {
        throw new ConflictException('Invalid role for a system user.');
      }
      if (!isSystem && !CLIENT_ROLES.includes(dto.role)) {
        throw new ConflictException('Invalid role for a client user.');
      }
    }

    if (dto.companyId !== undefined) {
      if (isSystem) {
        throw new ConflictException('Cannot set company on a system user.');
      }
      const co = await this.prisma.company.findUnique({
        where: { id: dto.companyId },
        select: { id: true },
      });
      if (!co) throw new NotFoundException('Company not found.');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone === null ? null : dto.phone.trim() || null;
    if (dto.password !== undefined) data.passwordHash = await this.password.hash(dto.password);
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === UserStatus.inactive) {
        data.tokenVersion = { increment: 1 };
      }
    }
    if (dto.companyId !== undefined) data.company = { connect: { id: dto.companyId } };

    const effectiveRole = dto.role !== undefined ? dto.role : existing.role;
    const effectiveName =
      dto.fullName !== undefined ? dto.fullName.trim() : existing.fullName;
    const effectiveStatus =
      dto.status !== undefined ? dto.status : existing.status;

    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data,
        select: USER_LIST_SELECT,
      });

      if (isSystem) {
        await this.syncWorkerForSystemUser(tx, id, effectiveRole, effectiveName, effectiveStatus, actor);
      }

      return this.toListRow(u);
    });
  }

  async suspend(id: string, actor: AuthPrincipal) {
    return this.update(
      id,
      { status: UserStatus.inactive },
      actor,
    );
  }

  async remove(id: string, actor: AuthPrincipal) {
    if (actor.id === id) {
      throw new ForbiddenException('You cannot delete your own user account.');
    }
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!u) throw new NotFoundException('User not found.');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.worker.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
      });
      return { id, deleted: true as const };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'This user cannot be deleted while related orders, ledger rows, or assignments exist. Suspend the account instead.',
        );
      }
      throw e;
    }
  }

  private async syncWorkerForSystemUser(
    tx: Prisma.TransactionClient,
    userId: string,
    role: UserRole,
    displayName: string,
    userStatus: UserStatus,
    actor: AuthPrincipal,
  ) {
    const worker = await tx.worker.findUnique({ where: { userId } });
    const userInactive = userStatus === UserStatus.inactive;

    if (userInactive || role !== UserRole.wh_operator) {
      if (worker) {
        await tx.worker.update({
          where: { id: worker.id },
          data: { status: WorkerOperationalStatus.inactive, displayName },
        });
      }
      return;
    }

    if (!actor.companyId) {
      if (worker) {
        await tx.worker.update({
          where: { id: worker.id },
          data: { displayName, status: WorkerOperationalStatus.active },
        });
      }
      return;
    }

    if (worker) {
      await tx.worker.update({
        where: { id: worker.id },
        data: { displayName, status: WorkerOperationalStatus.active },
      });
      return;
    }

    await tx.worker.create({
      data: {
        companyId: actor.companyId,
        warehouseId: null,
        displayName,
        userId,
        roles: {
          createMany: {
            data: DEFAULT_WORKER_ROLES.map((r) => ({ role: r })),
          },
        },
      },
    });
  }

  private toListRow(
    u: Prisma.UserGetPayload<{ select: typeof USER_LIST_SELECT }>,
  ): UserListRow {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      status: u.status,
      companyId: u.companyId,
      companyName: u.company?.name ?? null,
      kind: u.companyId ? 'client' : 'system',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastLoginAt: u.lastLoginAt,
      lastActivityAt: u.lastActivityAt,
    };
  }
}
