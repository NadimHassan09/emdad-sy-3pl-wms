"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const internal_rbac_1 = require("../../common/auth/internal-rbac");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const password_service_1 = require("../../common/crypto/password.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_service_1 = require("../realtime/realtime.service");
const realtime_master_data_payload_1 = require("../realtime/realtime-master-data.payload");
const user_worker_profile_util_1 = require("./user-worker-profile.util");
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
    worker: { select: user_worker_profile_util_1.WORKER_PROFILE_SELECT },
};
function mapSystemRoleToUserRole(ui) {
    switch (ui) {
        case 'super_admin':
            return client_1.UserRole.super_admin;
        case 'admin':
            return client_1.UserRole.wh_manager;
        case 'worker':
            return client_1.UserRole.wh_operator;
        default:
            return client_1.UserRole.wh_operator;
    }
}
const SYSTEM_ROLES = [
    client_1.UserRole.super_admin,
    client_1.UserRole.wh_manager,
    client_1.UserRole.wh_operator,
    client_1.UserRole.finance,
];
const CLIENT_ROLES = [client_1.UserRole.client_admin, client_1.UserRole.client_staff];
let UsersService = class UsersService {
    prisma;
    password;
    companyAccess;
    realtime;
    constructor(prisma, password, companyAccess, realtime) {
        this.prisma = prisma;
        this.password = password;
        this.companyAccess = companyAccess;
        this.realtime = realtime;
    }
    async list(actor, query) {
        const where = this.buildListWhere(actor, query);
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                orderBy: [{ email: 'asc' }],
                select: USER_LIST_SELECT,
                take: query.limit,
                skip: query.offset,
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            items: rows.map((u) => this.toListRow(u)),
            total,
            limit: query.limit,
            offset: query.offset,
        };
    }
    buildListWhere(actor, query) {
        const kind = query.kind ?? 'all';
        const and = [];
        if (kind === 'system') {
            and.push({ companyId: null });
        }
        else if (kind === 'client') {
            and.push({ companyId: { not: null } });
        }
        if (actor.tenantScope === 'restricted') {
            if (kind === 'client') {
                and.push({ companyId: { in: actor.authorizedCompanyIds } });
            }
            else if (kind === 'all') {
                and.push({
                    OR: [
                        { companyId: null },
                        { companyId: { in: actor.authorizedCompanyIds } },
                    ],
                });
            }
        }
        if (query.companyId && kind !== 'system') {
            this.companyAccess.assertCompanyAccess(actor, query.companyId);
            and.push({ companyId: query.companyId });
        }
        if (query.role) {
            and.push({ role: query.role });
        }
        if (query.search?.trim()) {
            const t = query.search.trim();
            and.push({
                OR: [
                    { fullName: { contains: t, mode: 'insensitive' } },
                    { email: { contains: t, mode: 'insensitive' } },
                ],
            });
        }
        return and.length ? { AND: and } : {};
    }
    async findById(id, actor) {
        const u = await this.prisma.user.findUnique({
            where: { id },
            select: USER_LIST_SELECT,
        });
        if (!u)
            throw new common_1.NotFoundException('User not found.');
        if (u.companyId) {
            this.companyAccess.assertCompanyAccess(actor, u.companyId);
        }
        return this.toListRow(u);
    }
    async getWorkerProfile(userId, actor) {
        (0, internal_rbac_1.assertInternalAdmin)(actor);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, companyId: true, role: true, worker: { select: user_worker_profile_util_1.WORKER_PROFILE_SELECT } },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found.');
        if (user.companyId) {
            this.companyAccess.assertCompanyAccess(actor, user.companyId);
        }
        this.assertOperatorWorkerEligible(user.role, user.companyId);
        return (0, user_worker_profile_util_1.toWorkerProfileSummary)(user.worker);
    }
    async upsertWorkerProfile(userId, dto, actor) {
        (0, internal_rbac_1.assertInternalAdmin)(actor);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                companyId: true,
                role: true,
                status: true,
                fullName: true,
                worker: { select: user_worker_profile_util_1.WORKER_PROFILE_SELECT },
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found.');
        if (user.companyId) {
            this.companyAccess.assertCompanyAccess(actor, user.companyId);
        }
        this.assertOperatorWorkerEligible(user.role, user.companyId);
        const tenantCompanyId = await this.resolveWorkerProvisionCompanyId(actor);
        const roles = dto.roles?.length ? dto.roles : undefined;
        const warehouseId = dto.warehouseId === undefined ? undefined : dto.warehouseId?.trim() || null;
        if (warehouseId) {
            const wh = await this.prisma.warehouse.findUnique({
                where: { id: warehouseId },
                select: { id: true },
            });
            if (!wh) {
                throw new common_1.NotFoundException('Warehouse not found. Choose a valid warehouse or leave blank for tenant-wide.');
            }
        }
        if (dto.linkWorkerId) {
            return this.linkExistingWorker(user, dto.linkWorkerId, tenantCompanyId, actor, {
                warehouseId,
                roles,
            });
        }
        if (user.worker) {
            return this.prisma.$transaction(async (tx) => {
                if (roles) {
                    await tx.workerRoleAssignment.deleteMany({ where: { workerId: user.worker.id } });
                    await tx.workerRoleAssignment.createMany({
                        data: roles.map((role) => ({ workerId: user.worker.id, role })),
                    });
                }
                const updated = await tx.worker.update({
                    where: { id: user.worker.id },
                    data: {
                        displayName: user.fullName,
                        ...(warehouseId !== undefined ? { warehouseId } : {}),
                        status: user.status === client_1.UserStatus.active
                            ? client_1.WorkerOperationalStatus.active
                            : client_1.WorkerOperationalStatus.inactive,
                    },
                    select: user_worker_profile_util_1.WORKER_PROFILE_SELECT,
                });
                return (0, user_worker_profile_util_1.toWorkerProfileSummary)(updated);
            });
        }
        if (!roles?.length) {
            throw new common_1.BadRequestException('Choose at least one operational role (receiver, picker, packer, etc.) when creating a worker profile.');
        }
        const resolvedWarehouseId = warehouseId === undefined
            ? await this.resolveWorkerWarehouseId(undefined)
            : warehouseId;
        const created = await this.prisma.worker.create({
            data: {
                companyId: tenantCompanyId,
                warehouseId: resolvedWarehouseId,
                displayName: user.fullName,
                userId: user.id,
                status: user.status === client_1.UserStatus.active
                    ? client_1.WorkerOperationalStatus.active
                    : client_1.WorkerOperationalStatus.inactive,
                roles: {
                    createMany: {
                        data: roles.map((role) => ({ role })),
                    },
                },
            },
            select: user_worker_profile_util_1.WORKER_PROFILE_SELECT,
        });
        return (0, user_worker_profile_util_1.toWorkerProfileSummary)(created);
    }
    async create(dto, actor) {
        (0, internal_rbac_1.assertInternalAdmin)(actor);
        const email = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.count({ where: { email } });
        if (existing) {
            throw new common_1.ConflictException('A user with this email already exists.');
        }
        const passwordHash = await this.password.hash(dto.password);
        if (dto.kind === 'system') {
            const role = mapSystemRoleToUserRole(dto.systemRole);
            const tenantCompanyId = role === client_1.UserRole.wh_operator
                ? await this.resolveWorkerProvisionCompanyId(actor)
                : null;
            const shouldProvisionWorker = role === client_1.UserRole.wh_operator;
            const workerWarehouseId = shouldProvisionWorker
                ? await this.resolveWorkerWarehouseId(dto.workerWarehouseId)
                : null;
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
                if (shouldProvisionWorker && tenantCompanyId) {
                    await tx.worker.create({
                        data: {
                            companyId: tenantCompanyId,
                            warehouseId: workerWarehouseId,
                            displayName: dto.fullName.trim(),
                            userId: u.id,
                            roles: {
                                createMany: {
                                    data: user_worker_profile_util_1.DEFAULT_WORKER_ROLES.map((r) => ({ role: r })),
                                },
                            },
                        },
                    });
                }
                const row = this.toListRow(u);
                this.realtime.emitUserCreated(this.serializeUserForRealtime(row));
                return row;
            });
        }
        const companyId = this.companyAccess.resolveWriteCompanyId(actor, dto.companyId);
        const u = await this.prisma.user.create({
            data: {
                email,
                fullName: dto.fullName.trim(),
                phone: dto.phone?.trim() || null,
                passwordHash,
                role: dto.clientRole,
                companyId,
            },
            select: USER_LIST_SELECT,
        });
        const row = this.toListRow(u);
        this.realtime.emitUserCreated(this.serializeUserForRealtime(row));
        return row;
    }
    async update(id, dto, actor) {
        (0, internal_rbac_1.assertInternalAdmin)(actor);
        const keys = Object.keys(dto).filter((k) => dto[k] !== undefined);
        if (keys.length === 0) {
            throw new common_1.BadRequestException('No changes provided.');
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
        if (!existing)
            throw new common_1.NotFoundException('User not found.');
        if (existing.companyId) {
            this.companyAccess.assertCompanyAccess(actor, existing.companyId);
        }
        const isSystem = existing.companyId === null;
        if (dto.email !== undefined) {
            const email = dto.email.trim().toLowerCase();
            const clash = await this.prisma.user.count({ where: { email, NOT: { id } } });
            if (clash)
                throw new common_1.ConflictException('A user with this email already exists.');
        }
        if (dto.role !== undefined) {
            if (isSystem && !SYSTEM_ROLES.includes(dto.role)) {
                throw new common_1.ConflictException('Invalid role for a system user.');
            }
            if (!isSystem && !CLIENT_ROLES.includes(dto.role)) {
                throw new common_1.ConflictException('Invalid role for a client user.');
            }
        }
        if (dto.companyId !== undefined) {
            if (isSystem) {
                throw new common_1.ConflictException('Cannot set company on a system user.');
            }
            this.companyAccess.assertCompanyAccess(actor, dto.companyId);
        }
        const data = {};
        if (dto.email !== undefined)
            data.email = dto.email.trim().toLowerCase();
        if (dto.fullName !== undefined)
            data.fullName = dto.fullName.trim();
        if (dto.phone !== undefined)
            data.phone = dto.phone === null ? null : dto.phone.trim() || null;
        if (dto.password !== undefined)
            data.passwordHash = await this.password.hash(dto.password);
        if (dto.role !== undefined)
            data.role = dto.role;
        if (dto.status !== undefined) {
            data.status = dto.status;
            if (dto.status === client_1.UserStatus.inactive) {
                data.tokenVersion = { increment: 1 };
            }
        }
        if (dto.companyId !== undefined)
            data.company = { connect: { id: dto.companyId } };
        const effectiveRole = dto.role !== undefined ? dto.role : existing.role;
        const effectiveName = dto.fullName !== undefined ? dto.fullName.trim() : existing.fullName;
        const effectiveStatus = dto.status !== undefined ? dto.status : existing.status;
        return this.prisma.$transaction(async (tx) => {
            const u = await tx.user.update({
                where: { id },
                data,
                select: USER_LIST_SELECT,
            });
            if (dto.status === client_1.UserStatus.inactive) {
                await tx.authRefreshSession.updateMany({
                    where: { userId: id, revokedAt: null },
                    data: { revokedAt: new Date() },
                });
            }
            if (isSystem) {
                await this.syncWorkerForSystemUser(tx, id, effectiveRole, effectiveName, effectiveStatus, actor);
            }
            const row = this.toListRow(u);
            this.realtime.emitUserUpdated(this.serializeUserForRealtime(row));
            return row;
        });
    }
    async suspend(id, actor) {
        return this.update(id, { status: client_1.UserStatus.inactive }, actor);
    }
    async remove(id, actor) {
        (0, internal_rbac_1.assertInternalAdmin)(actor);
        if (actor.id === id) {
            throw new common_1.ForbiddenException('You cannot delete your own user account.');
        }
        const u = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, companyId: true },
        });
        if (!u)
            throw new common_1.NotFoundException('User not found.');
        if (u.companyId) {
            this.companyAccess.assertCompanyAccess(actor, u.companyId);
        }
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.worker.deleteMany({ where: { userId: id } });
                await tx.user.delete({ where: { id } });
            });
            this.realtime.emitUserDeleted(id, u.companyId);
            return { id, deleted: true };
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                throw new common_1.ConflictException('This user cannot be deleted while related orders, ledger rows, or assignments exist. Suspend the account instead.');
            }
            throw e;
        }
    }
    assertOperatorWorkerEligible(role, companyId) {
        if (companyId !== null) {
            throw new common_1.BadRequestException('Worker profiles apply only to warehouse (system) operator accounts, not client portal users.');
        }
        if (role !== client_1.UserRole.wh_operator) {
            throw new common_1.BadRequestException('Only users with the Worker role can have a worker profile. Change the user role to Worker first.');
        }
    }
    async linkExistingWorker(user, linkWorkerId, tenantCompanyId, actor, opts) {
        if (user.worker) {
            throw new common_1.ConflictException('This user already has a worker profile. Update the existing profile instead of linking another worker.');
        }
        const orphan = await this.prisma.worker.findUnique({
            where: { id: linkWorkerId },
            select: {
                id: true,
                companyId: true,
                userId: true,
                displayName: true,
            },
        });
        if (!orphan) {
            throw new common_1.NotFoundException('Worker profile not found. Refresh the worker list and try again.');
        }
        this.companyAccess.validateResourceOwnership(actor, orphan);
        if (actor.tenantScope !== 'all' &&
            orphan.companyId !== tenantCompanyId) {
            throw new common_1.ConflictException('The selected worker profile belongs to a different client tenant. Switch tenant and try again.');
        }
        if (orphan.userId && orphan.userId !== user.id) {
            throw new common_1.ConflictException('That worker profile is already linked to another user. Choose an unlinked worker or create a new profile.');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            if (opts.roles?.length) {
                await tx.workerRoleAssignment.deleteMany({ where: { workerId: orphan.id } });
                await tx.workerRoleAssignment.createMany({
                    data: opts.roles.map((role) => ({ workerId: orphan.id, role })),
                });
            }
            return tx.worker.update({
                where: { id: orphan.id },
                data: {
                    userId: user.id,
                    displayName: user.fullName,
                    ...(opts.warehouseId !== undefined ? { warehouseId: opts.warehouseId } : {}),
                    status: user.status === client_1.UserStatus.active
                        ? client_1.WorkerOperationalStatus.active
                        : client_1.WorkerOperationalStatus.inactive,
                },
                select: user_worker_profile_util_1.WORKER_PROFILE_SELECT,
            });
        });
        return (0, user_worker_profile_util_1.toWorkerProfileSummary)(updated);
    }
    async syncWorkerForSystemUser(tx, userId, role, displayName, userStatus, actor) {
        const worker = await tx.worker.findUnique({ where: { userId } });
        const userInactive = userStatus === client_1.UserStatus.inactive;
        if (userInactive || role !== client_1.UserRole.wh_operator) {
            if (worker) {
                await tx.worker.update({
                    where: { id: worker.id },
                    data: { status: client_1.WorkerOperationalStatus.inactive, displayName },
                });
            }
            return;
        }
        const tenantCompanyId = await this.resolveWorkerProvisionCompanyId(actor);
        if (worker) {
            const wh001Id = await this.resolveWorkerWarehouseId(undefined);
            await tx.worker.update({
                where: { id: worker.id },
                data: {
                    displayName,
                    status: client_1.WorkerOperationalStatus.active,
                    ...(worker.warehouseId ? {} : { warehouseId: wh001Id }),
                },
            });
            return;
        }
        const wh001Id = await this.resolveWorkerWarehouseId(undefined);
        await tx.worker.create({
            data: {
                companyId: tenantCompanyId,
                warehouseId: wh001Id,
                displayName,
                userId,
                roles: {
                    createMany: {
                        data: user_worker_profile_util_1.DEFAULT_WORKER_ROLES.map((r) => ({ role: r })),
                    },
                },
            },
        });
    }
    async resolveWorkerProvisionCompanyId(actor, explicitCompanyId) {
        const trimmed = explicitCompanyId?.trim();
        if (trimmed) {
            this.companyAccess.assertCompanyAccess(actor, trimmed);
            return trimmed;
        }
        if (actor.companyId) {
            this.companyAccess.assertCompanyAccess(actor, actor.companyId);
            return actor.companyId;
        }
        const first = await this.prisma.company.findFirst({
            where: { status: client_1.CompanyStatus.active },
            orderBy: { name: 'asc' },
            select: { id: true },
        });
        if (!first) {
            throw new common_1.BadRequestException('No active client company exists to provision a warehouse operator profile.');
        }
        return first.id;
    }
    async resolveWorkerWarehouseId(explicitId) {
        const trimmed = explicitId?.trim();
        if (trimmed) {
            const wh = await this.prisma.warehouse.findUnique({
                where: { id: trimmed },
                select: { id: true },
            });
            if (!wh)
                throw new common_1.NotFoundException('Warehouse not found.');
            return wh.id;
        }
        const main = await this.prisma.warehouse.findUnique({
            where: { code: 'WH-001' },
            select: { id: true },
        });
        return main?.id ?? null;
    }
    serializeUserForRealtime(row) {
        return (0, realtime_master_data_payload_1.userRealtimePayload)({
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
            lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
        });
    }
    toListRow(u) {
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
            workerProfile: (0, user_worker_profile_util_1.toWorkerProfileSummary)(u.worker),
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            lastLoginAt: u.lastLoginAt,
            lastActivityAt: u.lastActivityAt,
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService,
        company_access_service_1.CompanyAccessService,
        realtime_service_1.RealtimeService])
], UsersService);
//# sourceMappingURL=users.service.js.map