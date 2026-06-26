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
exports.CycleCountService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const realtime_service_1 = require("../realtime/realtime.service");
const realtime_ops_payload_1 = require("../realtime/realtime-ops.payload");
const cycle_count_constants_1 = require("./cycle-count.constants");
const cycle_count_snapshot_service_1 = require("./cycle-count-snapshot.service");
const cycle_count_line_mutation_service_1 = require("./cycle-count-line-mutation.service");
const cycle_count_variance_detection_service_1 = require("./cycle-count-variance-detection.service");
const cycle_count_variance_service_1 = require("./cycle-count-variance.service");
const list_cycle_counts_query_dto_1 = require("./dto/list-cycle-counts-query.dto");
const list_product_history_query_dto_1 = require("./dto/list-product-history-query.dto");
const SCHEDULE_INCLUDE = {
    company: { select: { id: true, name: true } },
    warehouse: { select: { id: true, code: true, name: true } },
    creator: { select: { id: true, fullName: true } },
};
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
        orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { lotId: 'asc' }],
    },
};
let CycleCountService = class CycleCountService {
    prisma;
    companyAccess;
    snapshot;
    lineMutation;
    varianceDetection;
    variances;
    audit;
    realtime;
    constructor(prisma, companyAccess, snapshot, lineMutation, varianceDetection, variances, audit, realtime) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.snapshot = snapshot;
        this.lineMutation = lineMutation;
        this.varianceDetection = varianceDetection;
        this.variances = variances;
        this.audit = audit;
        this.realtime = realtime;
    }
    async upsertSchedule(user, dto) {
        if (!(0, cycle_count_constants_1.isValidCycleCountInterval)(dto.intervalDays)) {
            throw new common_1.BadRequestException('intervalDays must be 7, 30, or 90.');
        }
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        await this.assertWarehouse(dto.warehouseId);
        const now = new Date();
        const nextRunAt = (0, cycle_count_constants_1.addDays)(now, dto.intervalDays);
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
    listSchedules(user, companyIdParam) {
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, companyIdParam);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.cycleCountSchedule.findMany({
            where: companyId ? { companyId } : {},
            include: SCHEDULE_INCLUDE,
            orderBy: [{ warehouseId: 'asc' }],
        }));
    }
    async createManual(user, dto) {
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
                    source: client_1.CycleCountSource.manual,
                    status: client_1.CycleCountStatus.scheduled,
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
                throw new common_1.BadRequestException('No stock rows match the cycle count scope (check products and warehouse).');
            }
            await this.snapshot.insertLines(tx, count.id, rows, dto.assignedWorkerId);
            const detail = await tx.cycleCount.findUniqueOrThrow({
                where: { id: count.id },
                include: COUNT_DETAIL_INCLUDE,
            });
            await this.audit.logTx(tx, this.audit.fromPrincipal(user, {
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
            }));
            return detail;
        }).then((detail) => {
            this.emitCycleCountEvent(detail, 'created');
            return detail;
        });
    }
    list(user, query) {
        const where = {};
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, query.companyId);
        if (companyId) {
            where.companyId = companyId;
        }
        if (query.warehouseId)
            where.warehouseId = query.warehouseId;
        if ((0, list_cycle_counts_query_dto_1.parseDiscrepancyOnly)(query.discrepancyOnly)) {
            where.status = client_1.CycleCountStatus.pending_review;
        }
        else if (query.status) {
            where.status = query.status;
        }
        if (query.assignedWorkerId)
            where.assignedWorkerId = query.assignedWorkerId;
        if (query.createdFrom || query.createdTo) {
            const createdAt = {};
            if (query.createdFrom)
                createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
            if (query.createdTo)
                createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
            where.createdAt = createdAt;
        }
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
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
    async findById(user, id) {
        const row = await this.prisma.cycleCount.findUnique({
            where: { id },
            include: COUNT_DETAIL_INCLUDE,
        });
        if (!row)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, row);
        return row;
    }
    async start(user, id) {
        const count = await this.requireCount(id);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.scheduled) {
            throw new domain_exceptions_1.InvalidStateException('Only scheduled cycle counts can be started.');
        }
        const now = new Date();
        return this.prisma.cycleCount.update({
            where: { id },
            data: {
                status: client_1.CycleCountStatus.in_progress,
                startedAt: now,
                updatedAt: now,
            },
            include: COUNT_DETAIL_INCLUDE,
        }).then((updated) => {
            this.emitCycleCountEvent(updated, 'updated');
            return updated;
        });
    }
    async assignSession(user, id, dto) {
        const count = await this.requireCount(id);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status === client_1.CycleCountStatus.completed ||
            count.status === client_1.CycleCountStatus.cancelled) {
            throw new domain_exceptions_1.InvalidStateException('Cannot assign a closed cycle count.');
        }
        if (dto.assignedWorkerId) {
            await this.assertWorkerForWarehouse(dto.assignedWorkerId, count.companyId, count.warehouseId);
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
    async assignLine(user, countId, lineId, dto) {
        const count = await this.requireCount(countId);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.scheduled &&
            count.status !== client_1.CycleCountStatus.in_progress) {
            throw new domain_exceptions_1.InvalidStateException('Lines can only be assigned while the count is open.');
        }
        const line = await this.prisma.cycleCountLine.findFirst({
            where: { id: lineId, cycleCountId: countId },
        });
        if (!line)
            throw new common_1.NotFoundException('Cycle count line not found.');
        if (dto.assignedWorkerId) {
            await this.assertWorkerForWarehouse(dto.assignedWorkerId, count.companyId, count.warehouseId);
        }
        await this.prisma.cycleCountLine.update({
            where: { id: lineId },
            data: { assignedWorkerId: dto.assignedWorkerId ?? null },
        });
        return this.findById(user, countId);
    }
    async submitLineCount(user, countId, lineId, dto) {
        const count = await this.requireCount(countId);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.in_progress) {
            throw new domain_exceptions_1.InvalidStateException('Counts can only be entered while in progress.');
        }
        const line = await this.prisma.cycleCountLine.findFirst({
            where: { id: lineId, cycleCountId: countId },
        });
        if (!line)
            throw new common_1.NotFoundException('Cycle count line not found.');
        if (line.status !== 'pending') {
            throw new domain_exceptions_1.InvalidStateException('Line is already counted or skipped.');
        }
        const actual = new client_1.Prisma.Decimal(dto.actualQuantity);
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
    async skipLine(user, countId, lineId, dto) {
        const count = await this.requireCount(countId);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.in_progress) {
            throw new domain_exceptions_1.InvalidStateException('Lines can only be skipped while in progress.');
        }
        await this.prisma.$transaction(async (tx) => {
            await this.lineMutation.skipLine(tx, {
                cycleCountId: countId,
                lineId,
                requiredStatus: client_1.CycleCountStatus.in_progress,
                userId: user.id,
                countNotes: dto.countNotes,
            });
        });
        return this.findById(user, countId);
    }
    async submitForReview(user, id) {
        const count = await this.requireCount(id);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.in_progress) {
            throw new domain_exceptions_1.InvalidStateException('Only in-progress counts can be submitted for review.');
        }
        const pending = await this.prisma.cycleCountLine.count({
            where: { cycleCountId: id, status: 'pending' },
        });
        if (pending > 0) {
            throw new common_1.BadRequestException(`${pending} line(s) still pending — count or skip each line before review.`);
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.cycleCount.update({
                where: { id },
                data: {
                    status: client_1.CycleCountStatus.pending_review,
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
    async complete(user, id) {
        const count = await this.requireCount(id);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.pending_review) {
            throw new domain_exceptions_1.InvalidStateException('Only counts pending review can be completed.');
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
                    status: client_1.CycleCountStatus.completed,
                    completedAt,
                    updatedAt: completedAt,
                },
                include: COUNT_DETAIL_INCLUDE,
            });
            await this.audit.logTx(tx, this.audit.fromPrincipal(user, {
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
            }));
            const productIds = [
                ...new Set(updated.lines.map((l) => l.productId)),
            ];
            for (const productId of productIds) {
                const nextDueAt = (0, cycle_count_constants_1.addDays)(completedAt, intervalDays);
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
    async cancel(user, id) {
        const count = await this.requireCount(id);
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status === client_1.CycleCountStatus.completed ||
            count.status === client_1.CycleCountStatus.cancelled) {
            throw new domain_exceptions_1.InvalidStateException('Cycle count is already closed.');
        }
        return this.prisma.cycleCount.update({
            where: { id },
            data: {
                status: client_1.CycleCountStatus.cancelled,
                updatedAt: new Date(),
            },
            include: COUNT_DETAIL_INCLUDE,
        }).then((updated) => {
            this.emitCycleCountEvent(updated, 'updated');
            return updated;
        });
    }
    emitCycleCountEvent(count, kind) {
        const withCount = {
            ...count,
            _count: { lines: count.lines?.length ?? 0 },
        };
        const listItem = (0, realtime_ops_payload_1.cycleCountListItemPayload)(withCount);
        const detail = (0, realtime_ops_payload_1.cycleCountDetailPayload)(count);
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
    async publishRealtimeUpdate(countId) {
        const count = await this.prisma.cycleCount.findUnique({
            where: { id: countId },
            include: COUNT_DETAIL_INCLUDE,
        });
        if (count)
            this.emitCycleCountEvent(count, 'updated');
    }
    listProductHistory(user, query) {
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, query.companyId);
        const where = {
            warehouseId: query.warehouseId,
            ...(query.productId ? { productId: query.productId } : {}),
        };
        if (companyId) {
            where.companyId = companyId;
        }
        if ((0, list_product_history_query_dto_1.parseOverdueOnly)(query.overdueOnly)) {
            where.nextDueAt = { lt: new Date() };
        }
        if (query.lastCountedFrom || query.lastCountedTo) {
            const lastCountedAt = {};
            if (query.lastCountedFrom) {
                lastCountedAt.gte = new Date(`${query.lastCountedFrom}T00:00:00.000Z`);
            }
            if (query.lastCountedTo) {
                lastCountedAt.lte = new Date(`${query.lastCountedTo}T23:59:59.999Z`);
            }
            where.lastCountedAt = lastCountedAt;
        }
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
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
    async findDueProductIds(companyId, warehouseId, intervalDays, includeZeroOnHand) {
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
        if (productIds.length === 0)
            return [];
        const histories = await this.prisma.cycleCountProductHistory.findMany({
            where: { companyId, warehouseId, productId: { in: productIds } },
        });
        const byProduct = new Map(histories.map((h) => [h.productId, h]));
        return productIds.filter((productId) => {
            const h = byProduct.get(productId);
            if (!h)
                return true;
            if (h.nextDueAt)
                return h.nextDueAt.getTime() <= now.getTime();
            return (0, cycle_count_constants_1.addDays)(h.lastCountedAt, intervalDays).getTime() <= now.getTime();
        });
    }
    async generateFromSchedule(scheduleId, createdByUserId) {
        const schedule = await this.prisma.cycleCountSchedule.findUnique({
            where: { id: scheduleId },
        });
        if (!schedule || !schedule.enabled)
            return { created: false };
        const dueProductIds = await this.findDueProductIds(schedule.companyId, schedule.warehouseId, schedule.intervalDays, schedule.includeZeroOnHand);
        const now = new Date();
        const nextRunAt = (0, cycle_count_constants_1.addDays)(now, schedule.intervalDays);
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
                    status: { in: [...cycle_count_constants_1.CYCLE_COUNT_ACTIVE_STATUSES] },
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
                    source: client_1.CycleCountSource.scheduled,
                    status: client_1.CycleCountStatus.scheduled,
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
    async runDueSchedules(systemUserId) {
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
            if (result.created)
                generated += 1;
        }
        return generated;
    }
    async requireCount(id) {
        const count = await this.prisma.cycleCount.findUnique({ where: { id } });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        return count;
    }
    async assertWarehouse(warehouseId) {
        const wh = await this.prisma.warehouse.findUnique({
            where: { id: warehouseId },
            select: { id: true },
        });
        if (!wh)
            throw new common_1.NotFoundException('Warehouse not found.');
    }
    async assertWorkerForWarehouse(workerId, companyId, warehouseId) {
        const worker = await this.prisma.worker.findFirst({
            where: {
                id: workerId,
                companyId,
                status: 'active',
                OR: [{ warehouseId: null }, { warehouseId }],
            },
        });
        if (!worker) {
            throw new common_1.BadRequestException('Worker not found or not eligible for this warehouse.');
        }
    }
    async assertNoActiveCount(tx, companyId, warehouseId) {
        const active = await tx.cycleCount.findFirst({
            where: {
                companyId,
                warehouseId,
                status: { in: [...cycle_count_constants_1.CYCLE_COUNT_ACTIVE_STATUSES] },
            },
            select: { id: true },
        });
        if (active) {
            throw new common_1.ConflictException('An active cycle count already exists for this warehouse. Complete or cancel it first.');
        }
    }
};
exports.CycleCountService = CycleCountService;
exports.CycleCountService = CycleCountService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        cycle_count_snapshot_service_1.CycleCountSnapshotService,
        cycle_count_line_mutation_service_1.CycleCountLineMutationService,
        cycle_count_variance_detection_service_1.CycleCountVarianceDetectionService,
        cycle_count_variance_service_1.CycleCountVarianceService,
        audit_log_service_1.AuditLogService,
        realtime_service_1.RealtimeService])
], CycleCountService);
//# sourceMappingURL=cycle-count.service.js.map