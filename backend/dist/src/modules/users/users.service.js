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
const password_service_1 = require("../../common/crypto/password.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
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
};
const DEFAULT_WORKER_ROLES = ['receiver', 'picker', 'packer'];
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
    constructor(prisma, password) {
        this.prisma = prisma;
        this.password = password;
    }
    async list(query) {
        const kind = query.kind ?? 'all';
        const where = {};
        if (kind === 'system') {
            where.companyId = null;
        }
        else if (kind === 'client') {
            where.companyId = { not: null };
        }
        const rows = await this.prisma.user.findMany({
            where,
            orderBy: [{ email: 'asc' }],
            select: USER_LIST_SELECT,
        });
        return rows.map((u) => this.toListRow(u));
    }
    async findById(id) {
        const u = await this.prisma.user.findUnique({
            where: { id },
            select: USER_LIST_SELECT,
        });
        if (!u)
            throw new common_1.NotFoundException('User not found.');
        return this.toListRow(u);
    }
    async create(dto, actor) {
        const email = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.count({ where: { email } });
        if (existing) {
            throw new common_1.ConflictException('A user with this email already exists.');
        }
        const passwordHash = await this.password.hash(dto.password);
        if (dto.kind === 'system') {
            const role = mapSystemRoleToUserRole(dto.systemRole);
            const shouldProvisionWorker = role === client_1.UserRole.wh_operator && !!actor.companyId;
            if (shouldProvisionWorker && dto.workerWarehouseId) {
                const wh = await this.prisma.warehouse.findUnique({
                    where: { id: dto.workerWarehouseId },
                    select: { id: true },
                });
                if (!wh) {
                    throw new common_1.NotFoundException('Warehouse not found.');
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
                            companyId: actor.companyId,
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
            throw new common_1.NotFoundException('Company not found.');
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
    async update(id, dto, actor) {
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
            const co = await this.prisma.company.findUnique({
                where: { id: dto.companyId },
                select: { id: true },
            });
            if (!co)
                throw new common_1.NotFoundException('Company not found.');
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
            if (isSystem) {
                await this.syncWorkerForSystemUser(tx, id, effectiveRole, effectiveName, effectiveStatus, actor);
            }
            return this.toListRow(u);
        });
    }
    async suspend(id, actor) {
        return this.update(id, { status: client_1.UserStatus.inactive }, actor);
    }
    async remove(id, actor) {
        if (actor.id === id) {
            throw new common_1.ForbiddenException('You cannot delete your own user account.');
        }
        const u = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!u)
            throw new common_1.NotFoundException('User not found.');
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.worker.deleteMany({ where: { userId: id } });
                await tx.user.delete({ where: { id } });
            });
            return { id, deleted: true };
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                throw new common_1.ConflictException('This user cannot be deleted while related orders, ledger rows, or assignments exist. Suspend the account instead.');
            }
            throw e;
        }
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
        if (!actor.companyId) {
            if (worker) {
                await tx.worker.update({
                    where: { id: worker.id },
                    data: { displayName, status: client_1.WorkerOperationalStatus.active },
                });
            }
            return;
        }
        if (worker) {
            await tx.worker.update({
                where: { id: worker.id },
                data: { displayName, status: client_1.WorkerOperationalStatus.active },
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
        password_service_1.PasswordService])
], UsersService);
//# sourceMappingURL=users.service.js.map