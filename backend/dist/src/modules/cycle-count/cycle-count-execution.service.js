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
exports.CycleCountExecutionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cycle_count_blind_presenter_1 = require("./cycle-count-blind.presenter");
const cycle_count_line_mutation_service_1 = require("./cycle-count-line-mutation.service");
const cycle_count_service_1 = require("./cycle-count.service");
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
        orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { lotId: 'asc' }],
    },
};
let CycleCountExecutionService = class CycleCountExecutionService {
    prisma;
    companyAccess;
    lineMutation;
    cycleCounts;
    constructor(prisma, companyAccess, lineMutation, cycleCounts) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.lineMutation = lineMutation;
        this.cycleCounts = cycleCounts;
    }
    async listMyTasks(user, warehouseId) {
        const workerId = await this.requireWorkerId(user);
        const companyId = this.companyAccess.requireReadTenantScope(user);
        const statuses = [
            client_1.CycleCountStatus.scheduled,
            client_1.CycleCountStatus.in_progress,
        ];
        const where = {
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
        if (companyId)
            where.companyId = companyId;
        if (warehouseId)
            where.warehouseId = warehouseId;
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
    async getTask(user, countId) {
        const workerId = await this.requireWorkerId(user);
        const count = await this.loadCountForExecution(countId, user, workerId);
        return (0, cycle_count_blind_presenter_1.presentBlindCycleCountTask)(count);
    }
    async claimTask(user, countId) {
        const workerId = await this.requireWorkerId(user);
        const count = await this.prisma.cycleCount.findUnique({
            where: { id: countId },
            include: { lines: { select: { assignedWorkerId: true } } },
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.scheduled &&
            count.status !== client_1.CycleCountStatus.in_progress) {
            throw new domain_exceptions_1.InvalidStateException('This count is not open for execution.');
        }
        if (!this.workerCanAccessCount(workerId, count)) {
            throw new common_1.NotFoundException('Cycle count not found.');
        }
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT id FROM cycle_counts WHERE id = ${countId}::uuid FOR UPDATE
      `;
            const locked = await tx.cycleCount.findUnique({ where: { id: countId } });
            if (!locked)
                throw new common_1.NotFoundException('Cycle count not found.');
            if (locked.status !== client_1.CycleCountStatus.scheduled &&
                locked.status !== client_1.CycleCountStatus.in_progress) {
                throw new domain_exceptions_1.InvalidStateException('This count is not open for execution.');
            }
            if (locked.executingWorkerId &&
                locked.executingWorkerId !== workerId &&
                locked.status === client_1.CycleCountStatus.in_progress) {
                throw new common_1.ConflictException('Another worker is already executing this cycle count.');
            }
            const otherActive = await tx.cycleCount.findFirst({
                where: {
                    executingWorkerId: workerId,
                    status: client_1.CycleCountStatus.in_progress,
                    id: { not: countId },
                },
                select: { id: true },
            });
            if (otherActive) {
                throw new common_1.ConflictException('Finish or release your current in-progress cycle count before claiming another.');
            }
            const data = {
                executingWorker: { connect: { id: workerId } },
                updatedAt: now,
            };
            if (locked.status === client_1.CycleCountStatus.scheduled) {
                data.status = client_1.CycleCountStatus.in_progress;
                data.startedAt = now;
            }
            await tx.cycleCount.update({ where: { id: countId }, data });
            const full = await tx.cycleCount.findUniqueOrThrow({
                where: { id: countId },
                include: EXECUTION_COUNT_INCLUDE,
            });
            return (0, cycle_count_blind_presenter_1.presentBlindCycleCountTask)(full);
        }).then(async (task) => {
            await this.cycleCounts.publishRealtimeUpdate(countId);
            return task;
        });
    }
    async submitLineCount(user, countId, lineId, dto) {
        const workerId = await this.requireWorkerId(user);
        await this.assertLineAssignable(user, countId, lineId, workerId);
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT id FROM cycle_count_lines
         WHERE id = ${lineId}::uuid AND cycle_count_id = ${countId}::uuid
         FOR UPDATE
      `;
            await this.lineMutation.countLine(tx, {
                cycleCountId: countId,
                lineId,
                requiredStatus: client_1.CycleCountStatus.in_progress,
                userId: user.id,
                input: dto,
            });
        });
        await this.cycleCounts.publishRealtimeUpdate(countId);
        return this.getTask(user, countId);
    }
    async skipLine(user, countId, lineId, dto) {
        const workerId = await this.requireWorkerId(user);
        await this.assertLineAssignable(user, countId, lineId, workerId);
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT id FROM cycle_count_lines
         WHERE id = ${lineId}::uuid AND cycle_count_id = ${countId}::uuid
         FOR UPDATE
      `;
            await this.lineMutation.skipLine(tx, {
                cycleCountId: countId,
                lineId,
                requiredStatus: client_1.CycleCountStatus.in_progress,
                userId: user.id,
                countNotes: dto.countNotes,
            });
        });
        await this.cycleCounts.publishRealtimeUpdate(countId);
        return this.getTask(user, countId);
    }
    async finishTask(user, countId) {
        const workerId = await this.requireWorkerId(user);
        const count = await this.prisma.cycleCount.findUnique({ where: { id: countId } });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.executingWorkerId && count.executingWorkerId !== workerId) {
            throw new common_1.ForbiddenException('Only the executing worker can finish this count.');
        }
        if (count.assignedWorkerId &&
            count.assignedWorkerId !== workerId &&
            count.executingWorkerId !== workerId) {
            throw new common_1.ForbiddenException('You are not assigned to this cycle count.');
        }
        const updated = await this.cycleCounts.submitForReview(user, countId);
        return {
            id: updated.id,
            status: updated.status,
            message: 'Count submitted for supervisor review.',
        };
    }
    async loadCountForExecution(countId, user, workerId) {
        const count = await this.prisma.cycleCount.findUnique({
            where: { id: countId },
            include: EXECUTION_COUNT_INCLUDE,
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, count);
        const readableStatuses = [
            client_1.CycleCountStatus.scheduled,
            client_1.CycleCountStatus.in_progress,
            client_1.CycleCountStatus.pending_review,
        ];
        if (!readableStatuses.includes(count.status)) {
            throw new domain_exceptions_1.InvalidStateException('This count is not available for execution.');
        }
        if (count.status === client_1.CycleCountStatus.pending_review &&
            count.executingWorkerId !== workerId) {
            throw new common_1.NotFoundException('Cycle count not found.');
        }
        if (!this.workerCanAccessCount(workerId, count)) {
            throw new common_1.NotFoundException('Cycle count not found.');
        }
        return count;
    }
    async assertLineAssignable(user, countId, lineId, workerId) {
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
            throw new common_1.NotFoundException('Cycle count line not found.');
        }
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.in_progress) {
            throw new domain_exceptions_1.InvalidStateException('Start or claim the count before entering quantities.');
        }
        if (count.executingWorkerId && count.executingWorkerId !== workerId) {
            throw new common_1.ForbiddenException('Another worker is executing this cycle count.');
        }
        const line = count.lines[0];
        if (line.assignedWorkerId && line.assignedWorkerId !== workerId) {
            throw new common_1.ForbiddenException('This location is assigned to another worker.');
        }
        if (count.assignedWorkerId &&
            count.assignedWorkerId !== workerId &&
            !line.assignedWorkerId) {
            throw new common_1.ForbiddenException('Claim the cycle count before counting unassigned lines.');
        }
    }
    workerCanAccessCount(workerId, count) {
        if (count.assignedWorkerId === workerId || count.executingWorkerId === workerId) {
            return true;
        }
        const hasLine = count.lines.some((l) => l.assignedWorkerId === workerId);
        if (hasLine)
            return true;
        if (!count.assignedWorkerId) {
            return count.lines.some((l) => !l.assignedWorkerId);
        }
        return false;
    }
    toListItem(workerId, count) {
        const pending = count.lines.filter((l) => l.status === 'pending').length;
        let assignmentScope = 'pool';
        if (count.assignedWorkerId === workerId || count.executingWorkerId === workerId) {
            assignmentScope = 'session';
        }
        else if (count.lines.some((l) => l.assignedWorkerId === workerId)) {
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
    async requireWorkerId(user) {
        if (user.role !== client_1.UserRole.wh_operator) {
            const worker = await this.prisma.worker.findUnique({
                where: { userId: user.id },
                select: { id: true },
            });
            if (worker)
                return worker.id;
            throw new common_1.ForbiddenException('Cycle count execution requires a warehouse operator with an active linked worker profile.');
        }
        const worker = await this.prisma.worker.findUnique({
            where: { userId: user.id },
            select: { id: true, status: true },
        });
        if (!worker) {
            throw new common_1.ForbiddenException('Your account is not linked to a worker profile. An admin must open Users → Warehouse users, edit your account, and provision or link a worker profile before you can execute cycle counts.');
        }
        if (worker.status !== 'active') {
            throw new common_1.ForbiddenException('Your worker profile is inactive. Ask an admin to reactivate your user account and worker profile under Users → Warehouse users.');
        }
        return worker.id;
    }
};
exports.CycleCountExecutionService = CycleCountExecutionService;
exports.CycleCountExecutionService = CycleCountExecutionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        cycle_count_line_mutation_service_1.CycleCountLineMutationService,
        cycle_count_service_1.CycleCountService])
], CycleCountExecutionService);
//# sourceMappingURL=cycle-count-execution.service.js.map