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
exports.WarehouseTasksService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const realtime_service_1 = require("../realtime/realtime.service");
const cache_invalidation_service_1 = require("../../common/redis/cache-invalidation.service");
const task_read_cache_service_1 = require("../../common/redis/task-read-cache.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const task_inventory_effects_service_1 = require("./task-inventory-effects.service");
const workflow_orchestration_service_1 = require("./workflow-orchestration.service");
const task_payload_schema_1 = require("./task-payload.schema");
const task_transitions_1 = require("./task-transitions");
const task_runnable_util_1 = require("./task-runnable.util");
function isRecord(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
let WarehouseTasksService = class WarehouseTasksService {
    prisma;
    effects;
    cacheInv;
    orchestration;
    taskReadCache;
    realtime;
    constructor(prisma, effects, cacheInv, orchestration, taskReadCache, realtime) {
        this.prisma = prisma;
        this.effects = effects;
        this.cacheInv = cacheInv;
        this.orchestration = orchestration;
        this.taskReadCache = taskReadCache;
        this.realtime = realtime;
    }
    async list(user, query) {
        if (!user.companyId) {
            throw new common_1.BadRequestException('companyId is required to list warehouse tasks.');
        }
        const where = {};
        if (query.status)
            where.status = query.status;
        if (query.taskType)
            where.taskType = query.taskType;
        const and = [];
        if (query.warehouseId) {
            and.push({
                workflowInstance: { warehouseId: query.warehouseId },
            });
        }
        if (query.workerId) {
            and.push({
                assignments: { some: { workerId: query.workerId, unassignedAt: null } },
            });
        }
        if (query.referenceId) {
            and.push({
                workflowInstance: { referenceId: query.referenceId },
            });
        }
        if (query.updatedFrom || query.updatedTo) {
            where.updatedAt = {};
            if (query.updatedFrom)
                where.updatedAt.gte = query.updatedFrom;
            if (query.updatedTo)
                where.updatedAt.lte = query.updatedTo;
        }
        if (user.companyId) {
            and.push({
                workflowInstance: { companyId: user.companyId },
            });
        }
        if (and.length)
            where.AND = and;
        return this.prisma.$transaction([
            this.prisma.warehouseTask.findMany({
                where,
                take: query.limit,
                skip: query.offset,
                orderBy: { updatedAt: 'desc' },
                include: {
                    workflowInstance: {
                        select: {
                            id: true,
                            referenceType: true,
                            referenceId: true,
                            warehouseId: true,
                        },
                    },
                    requiredSkills: true,
                    assignments: {
                        where: { unassignedAt: null },
                        take: 1,
                        include: { worker: true },
                    },
                },
            }),
            this.prisma.warehouseTask.count({ where }),
        ]).then(async ([items, total]) => {
            const enriched = await this.withRunnableFlags(items);
            return {
                items: enriched,
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async getById(taskId, user) {
        const companyKey = user.companyId ?? '_';
        const task = await this.taskReadCache.getOrLoad(companyKey, taskId, () => this.fetchTaskAuthorized(taskId, user));
        const [withFlag] = await this.withRunnableFlags([task]);
        return withFlag;
    }
    async fetchTaskAuthorized(taskId, user) {
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            include: {
                workflowInstance: true,
                assignments: { orderBy: { assignedAt: 'desc' }, include: { worker: true } },
                events: { orderBy: { createdAt: 'desc' }, take: 80 },
                requiredSkills: true,
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Task not found.');
        if (user.companyId && task.workflowInstance.companyId !== user.companyId) {
            throw new common_1.NotFoundException('Task not found.');
        }
        return task;
    }
    async withRunnableFlags(items) {
        const instIds = [...new Set(items.map((i) => i.workflowInstanceId))];
        if (instIds.length === 0) {
            return items.map((i) => ({
                ...i,
                is_current_runnable: false,
                runnability_blocked_reason: task_runnable_util_1.RUNN_BLOCKED_NOT_ON_FRONT,
            }));
        }
        const all = await this.prisma.warehouseTask.findMany({
            where: { workflowInstanceId: { in: instIds } },
            select: { id: true, taskType: true, status: true, workflowInstanceId: true },
        });
        const byInst = new Map();
        for (const row of all) {
            const cur = byInst.get(row.workflowInstanceId) ?? [];
            cur.push(row);
            byInst.set(row.workflowInstanceId, cur);
        }
        const withFrontier = items.map((task) => {
            const grp = byInst.get(task.workflowInstanceId) ?? [];
            const blockedReason = (0, task_runnable_util_1.getFrontierBlockedReason)(task.id, grp, task.workflowInstance.referenceType);
            return {
                ...task,
                is_current_runnable: blockedReason === null,
                runnability_blocked_reason: blockedReason,
            };
        });
        return this.applySkillRunnability(withFrontier);
    }
    async applySkillRunnability(items) {
        const now = new Date();
        return Promise.all(items.map(async (task) => {
            if (!task.is_current_runnable)
                return task;
            const reqs = task.requiredSkills ?? [];
            if (!reqs.length)
                return task;
            const workerId = task.assignments?.find((a) => a.unassignedAt == null)?.workerId ?? undefined;
            if (!workerId) {
                return {
                    ...task,
                    is_current_runnable: false,
                    runnability_blocked_reason: task_runnable_util_1.RUNN_BLOCKED_ASSIGNMENT_REQUIRED,
                };
            }
            const ok = await this.workerMeetsRequiredSkills(workerId, reqs, now);
            if (!ok) {
                return {
                    ...task,
                    is_current_runnable: false,
                    runnability_blocked_reason: task_runnable_util_1.RUNN_BLOCKED_SKILL_GAP,
                };
            }
            return task;
        }));
    }
    async workerMeetsRequiredSkills(workerId, reqs, now) {
        if (!reqs.length)
            return true;
        const skills = await this.prisma.workerSkill.findMany({ where: { workerId } });
        for (const r of reqs) {
            const s = skills.find((x) => x.skillCode === r.skillCode);
            if (!s || s.proficiency < r.minimumProficiency)
                return false;
            if (s.certifiedUntil != null && s.certifiedUntil < now)
                return false;
        }
        return true;
    }
    async workerMeetsRequiredSkillsTx(tx, workerId, reqs, now) {
        if (!reqs.length)
            return true;
        const skills = await tx.workerSkill.findMany({ where: { workerId } });
        for (const r of reqs) {
            const s = skills.find((x) => x.skillCode === r.skillCode);
            if (!s || s.proficiency < r.minimumProficiency)
                return false;
            if (s.certifiedUntil != null && s.certifiedUntil < now)
                return false;
        }
        return true;
    }
    rejectNotRunnable(reason) {
        throw new common_1.ForbiddenException({
            statusCode: 403,
            code: 'FORBIDDEN_NOT_RUNNABLE_STEP',
            reason,
        });
    }
    async assertFrontierOnlyTx(tx, task) {
        const wfAll = await tx.warehouseTask.findMany({
            where: { workflowInstanceId: task.workflowInstanceId },
            select: { id: true, taskType: true, status: true, workflowInstanceId: true },
        });
        if (!(0, task_runnable_util_1.computeRunnableTaskIds)(wfAll, task.workflowInstance.referenceType).has(task.id)) {
            this.rejectNotRunnable(task_runnable_util_1.RUNN_BLOCKED_NOT_ON_FRONT);
        }
    }
    async assertFrontierAndSkillsTx(tx, task, assignmentWorkerIds, now = new Date()) {
        await this.assertFrontierOnlyTx(tx, task);
        const reqs = task.requiredSkills ?? [];
        if (!reqs.length)
            return;
        const wid = assignmentWorkerIds[0];
        if (!wid)
            this.rejectNotRunnable(task_runnable_util_1.RUNN_BLOCKED_ASSIGNMENT_REQUIRED);
        const ok = await this.workerMeetsRequiredSkillsTx(tx, wid, reqs, now);
        if (!ok)
            this.rejectNotRunnable(task_runnable_util_1.RUNN_BLOCKED_SKILL_GAP);
    }
    async appendEvent(tx, taskId, event, actorId, payload) {
        await tx.taskEvent.create({
            data: {
                taskId,
                event,
                actorId: actorId ?? null,
                payload: payload !== undefined ? payload : undefined,
            },
        });
    }
    parseExecState(raw) {
        if (!isRecord(raw))
            return { reservations: [] };
        const r = raw.reservations;
        if (!Array.isArray(r))
            return { reservations: [] };
        return { reservations: r };
    }
    async lockTask(tx, taskId) {
        await tx.$executeRaw(client_1.Prisma.sql `SELECT id FROM warehouse_tasks WHERE id = ${taskId}::uuid FOR UPDATE`);
    }
    async ensureRunnableForExecutionGate(taskId, user) {
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            include: {
                workflowInstance: true,
                requiredSkills: true,
                assignments: { where: { unassignedAt: null }, take: 1 },
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Task not found.');
        if (user.companyId && task.workflowInstance.companyId !== user.companyId) {
            throw new common_1.NotFoundException('Task not found.');
        }
        const wfAll = await this.prisma.warehouseTask.findMany({
            where: { workflowInstanceId: task.workflowInstanceId },
            select: { id: true, taskType: true, status: true, workflowInstanceId: true },
        });
        if (!(0, task_runnable_util_1.computeRunnableTaskIds)(wfAll, task.workflowInstance.referenceType).has(task.id)) {
            this.rejectNotRunnable(task_runnable_util_1.RUNN_BLOCKED_NOT_ON_FRONT);
        }
        const reqs = task.requiredSkills ?? [];
        if (!reqs.length)
            return;
        const wid = task.assignments[0]?.workerId;
        if (!wid)
            this.rejectNotRunnable(task_runnable_util_1.RUNN_BLOCKED_ASSIGNMENT_REQUIRED);
        const ok = await this.workerMeetsRequiredSkills(wid, reqs, new Date());
        if (!ok)
            this.rejectNotRunnable(task_runnable_util_1.RUNN_BLOCKED_SKILL_GAP);
    }
    async bumpStatus(tx, taskId, fromLock, next, data = {}) {
        const res = await tx.warehouseTask.updateMany({
            where: { id: taskId, lockVersion: fromLock },
            data: {
                status: next,
                lockVersion: { increment: 1 },
                ...data,
            },
        });
        if (res.count === 0) {
            throw new common_1.ConflictException('Task was modified concurrently; retry.');
        }
    }
    async assign(taskId, user, workerId) {
        const wid = typeof workerId === 'string' ? workerId.trim() : '';
        if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(wid)) {
            throw new common_1.BadRequestException('workerId must be a full UUID. Choose a worker from the list instead of a short preview.');
        }
        await this.ensureWorker(wid, user);
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUnique({
                where: { id: taskId },
            });
            if (!task)
                throw new common_1.NotFoundException('Task not found.');
            await tx.taskAssignment.updateMany({
                where: { taskId, unassignedAt: null },
                data: { unassignedAt: new Date() },
            });
            await tx.taskAssignment.create({
                data: { taskId, workerId: wid, assignedById: user.id },
            });
            if (task.status === client_1.WarehouseTaskStatus.pending) {
                await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.assigned);
            }
            await this.appendEvent(tx, taskId, 'assigned', user.id, { workerId: wid });
        });
        await this.cacheInv.afterTaskMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId);
        return this.loadTaskEnvelope(taskId, user);
    }
    async unassign(taskId, user) {
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUnique({
                where: { id: taskId },
            });
            if (!task)
                throw new common_1.NotFoundException('Task not found.');
            await tx.taskAssignment.updateMany({
                where: { taskId, unassignedAt: null },
                data: { unassignedAt: new Date() },
            });
            if (task.status === client_1.WarehouseTaskStatus.assigned) {
                await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.pending);
            }
            await this.appendEvent(tx, taskId, 'unassigned', user.id);
        });
        await this.cacheInv.afterTaskMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId);
        return this.loadTaskEnvelope(taskId, user);
    }
    async start(taskId, user, workerId) {
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUnique({
                where: { id: taskId },
                include: {
                    assignments: {
                        where: { unassignedAt: null },
                        take: 1,
                    },
                    workflowInstance: true,
                    requiredSkills: true,
                },
            });
            if (!task)
                throw new common_1.NotFoundException('Task not found.');
            const activeWorker = workerId ?? task.assignments[0]?.workerId;
            if (!activeWorker)
                throw new common_1.BadRequestException('Assign a worker before starting.');
            await this.assertFrontierAndSkillsTx(tx, task, workerId ? [workerId] : [activeWorker]);
            if (task.status === client_1.WarehouseTaskStatus.pending) {
                await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.in_progress, {
                    startedAt: new Date(),
                });
            }
            else if (task.status === client_1.WarehouseTaskStatus.assigned) {
                await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.in_progress, {
                    startedAt: new Date(),
                });
            }
            else if (task.status !== client_1.WarehouseTaskStatus.in_progress) {
                throw new common_1.BadRequestException(`Cannot start from status ${task.status}.`);
            }
            if (task.taskType === 'pick') {
                const wf = await tx.workflowInstance.findUniqueOrThrow({
                    where: { id: task.workflowInstanceId },
                });
                const parsed = parsePickPayload(task.payload);
                const linesDb = await tx.outboundOrderLine.findMany({
                    where: {
                        outboundOrderId: parsed.outbound_order_id,
                        id: { in: parsed.lines.map((l) => l.outbound_order_line_id) },
                    },
                });
                const lines = parsed.lines.map((l) => {
                    const ol = linesDb.find((x) => x.id === l.outbound_order_line_id);
                    if (!ol)
                        throw new common_1.BadRequestException(`Missing outbound line ${l.outbound_order_line_id}`);
                    return {
                        outboundOrderLineId: l.outbound_order_line_id,
                        productId: ol.productId,
                        requestedQty: new client_1.Prisma.Decimal(l.requested_qty),
                        specificLotId: ol.specificLotId,
                    };
                });
                const reservations = await this.effects.buildPickReservations(tx, wf.companyId, wf.warehouseId, lines);
                await tx.warehouseTask.update({
                    where: { id: taskId },
                    data: {
                        executionState: { reservations },
                    },
                });
            }
            await this.appendEvent(tx, taskId, 'started', user.id, { workerId: activeWorker });
        });
        await this.cacheInv.afterTaskAndStockMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId);
        return this.loadTaskEnvelope(taskId, user);
    }
    async complete(taskId, user, bodyRaw) {
        const parsed = (0, task_payload_schema_1.safeParseTaskComplete)(bodyRaw);
        if (!parsed.success) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                code: 'TASK_EXECUTION_VALIDATION',
                issues: parsed.issues,
            });
        }
        if (parsed.request.task_id && parsed.request.task_id !== taskId) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                code: 'TASK_EXECUTION_VALIDATION',
                message: 'task_id must match route id',
            });
        }
        const body = parsed.body;
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUnique({
                where: { id: taskId },
                include: {
                    workflowInstance: true,
                    requiredSkills: true,
                    assignments: { where: { unassignedAt: null }, take: 1 },
                },
            });
            if (!task)
                throw new common_1.NotFoundException('Task not found.');
            if (task.taskType !== body.task_type) {
                throw new common_1.BadRequestException('task_type does not match target task.');
            }
            if (task.status !== client_1.WarehouseTaskStatus.in_progress) {
                throw new common_1.BadRequestException('Task must be in_progress to complete.');
            }
            const assignmentIds = task.assignments.map((a) => a.workerId);
            await this.assertFrontierAndSkillsTx(tx, task, assignmentIds);
            const exec = this.parseExecState(task.executionState);
            const companyId = task.workflowInstance.companyId;
            switch (body.task_type) {
                case 'receiving': {
                    const inboundId = receivingOrderId(task.payload);
                    const stagingMap = stagingMapFromReceivingPayload(task.payload);
                    await this.effects.applyReceivingStaging(tx, user.id, taskId, inboundId, companyId, body, stagingMap);
                    break;
                }
                case 'putaway': {
                    const put = task.payload;
                    const srcMap = sourceMapFromPutawayPayload(put);
                    await this.effects.applyPutaway(tx, user.id, taskId, put.inbound_order_id, companyId, body, srcMap);
                    break;
                }
                case 'putaway_quarantine': {
                    const put = task.payload;
                    const srcMap = sourceMapFromPutawayPayload(put);
                    await this.effects.applyPutaway(tx, user.id, taskId, put.inbound_order_id, companyId, body, srcMap, {
                        movementType: client_1.MovementType.qc_quarantine,
                        quarantineBinsOnly: true,
                    });
                    break;
                }
                case 'qc': {
                    const pl = task.payload;
                    await this.effects.applyQcLines(tx, pl.inbound_order_id, body);
                    break;
                }
                case 'pick': {
                    const po = parsePickPayload(task.payload);
                    await this.effects.applyPickRecord(tx, po.outbound_order_id, exec.reservations, body);
                    break;
                }
                case 'pack': {
                    const outboundId = outboundIdFromPackPayload(task.payload);
                    await this.effects.applyPackRecord(tx, outboundId, body);
                    break;
                }
                case 'dispatch': {
                    const outboundId = task.payload.outbound_order_id;
                    const pickSibling = await tx.warehouseTask.findFirst({
                        where: {
                            workflowInstanceId: task.workflowInstanceId,
                            taskType: 'pick',
                            status: 'completed',
                        },
                        orderBy: { completedAt: 'desc' },
                    });
                    const pickExec = this.parseExecState(pickSibling?.executionState);
                    if (!pickExec.reservations.length) {
                        throw new common_1.BadRequestException('No pick reservations found for dispatch.');
                    }
                    await this.effects.applyDispatchShip(tx, user.id, taskId, outboundId, companyId, pickExec.reservations, body);
                    break;
                }
                case 'routing':
                    throw new common_1.BadRequestException('routing task type is not implemented in this release.');
                default:
                    break;
            }
            const clearExec = body.task_type !== 'pick';
            await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.completed, {
                completedAt: new Date(),
                completedById: user.id,
                ...(clearExec ? { executionState: client_1.Prisma.DbNull } : {}),
            });
            await this.appendEvent(tx, taskId, 'completed', user.id, { task_type: task.taskType });
            const finalized = await tx.warehouseTask.findUniqueOrThrow({
                where: { id: taskId },
                include: { workflowInstance: true },
            });
            await this.orchestration.onTaskCompleted(tx, finalized, body, user.id);
            await this.refreshWorkflowInstanceHealth(tx, finalized.workflowInstanceId);
        });
        await this.cacheInv.afterTaskAndStockMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId, { inventorySource: 'task_complete' });
        return this.loadTaskEnvelope(taskId, user);
    }
    async cancel(taskId, user, reason) {
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUniqueOrThrow({
                where: { id: taskId },
            });
            if (!(0, task_transitions_1.canTransitionTask)(task.status, client_1.WarehouseTaskStatus.cancelled)) {
                throw new common_1.BadRequestException(`Cannot cancel from ${task.status}.`);
            }
            const exec = this.parseExecState(task.executionState);
            if (task.taskType === 'pick' && exec.reservations?.length > 0) {
                await this.effects.releaseReservations(tx, exec.reservations);
            }
            await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.cancelled, {
                failureReason: reason ?? null,
                executionState: client_1.Prisma.DbNull,
            });
            await this.appendEvent(tx, taskId, 'cancelled', user.id, { reason });
            await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
        });
        await this.cacheInv.afterTaskAndStockMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId, { inventorySource: 'task_cancel' });
        return this.loadTaskEnvelope(taskId, user);
    }
    async skipTask(taskId, user, body) {
        if (!['super_admin', 'wh_manager'].includes(user.role)) {
            throw new common_1.ForbiddenException('Only warehouse managers may skip workflow steps.');
        }
        const reason = (body.reason ?? '').trim();
        if (reason.length < 4) {
            throw new common_1.BadRequestException('reason is required (min 4 characters).');
        }
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUniqueOrThrow({
                where: { id: taskId },
                include: { workflowInstance: true },
            });
            await this.assertFrontierOnlyTx(tx, task);
            if (body.skip_target === 'qc') {
                if (task.taskType !== client_1.WarehouseTaskType.qc) {
                    throw new common_1.BadRequestException({
                        statusCode: 400,
                        error: 'Bad Request',
                        code: 'SKIP_NOT_ALLOWED_FOR_TYPE',
                        message: `skip_target qc does not apply to task type ${task.taskType}.`,
                        skip_target: body.skip_target,
                        task_type: task.taskType,
                    });
                }
                if (task.status !== client_1.WarehouseTaskStatus.pending && task.status !== client_1.WarehouseTaskStatus.assigned) {
                    throw new common_1.BadRequestException('QC can only be skipped before work starts.');
                }
                await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.cancelled, {
                    failureReason: reason,
                });
                await this.appendEvent(tx, taskId, 'qc_skipped', user.id, { reason });
                await this.orchestration.spawnPutawayFromFullReceive(tx, task.workflowInstance);
                return;
            }
            if (body.skip_target === 'pack') {
                if (task.taskType !== client_1.WarehouseTaskType.pack) {
                    throw new common_1.BadRequestException({
                        statusCode: 400,
                        error: 'Bad Request',
                        code: 'SKIP_NOT_ALLOWED_FOR_TYPE',
                        message: `skip_target pack does not apply to task type ${task.taskType}.`,
                        skip_target: body.skip_target,
                        task_type: task.taskType,
                    });
                }
                if (task.status !== client_1.WarehouseTaskStatus.pending && task.status !== client_1.WarehouseTaskStatus.assigned) {
                    throw new common_1.BadRequestException('Pack can only be skipped before work starts.');
                }
                if (task.workflowInstance.referenceType !== 'outbound_order') {
                    throw new common_1.BadRequestException('Pack skip is only valid for outbound workflows.');
                }
                await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.cancelled, {
                    failureReason: reason,
                });
                await this.appendEvent(tx, taskId, 'pack_skipped', user.id, { reason });
                await this.orchestration.enqueueDispatchTaskIfNeeded(tx, task.workflowInstance.id, task.workflowInstance.referenceId);
                await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
                return;
            }
            throw new common_1.BadRequestException('Unsupported skip_target.');
        });
        await this.cacheInv.afterTaskMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId);
        return this.loadTaskEnvelope(taskId, user);
    }
    async patchProgress(taskId, user, body) {
        const progParsed = task_payload_schema_1.taskProgressRequestSchema.safeParse({
            execution_state_patch: body.execution_state_patch,
            task_id: body.task_id,
            schema_version: body.schema_version,
            metadata: body.metadata,
        });
        if (!progParsed.success) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                code: 'TASK_PROGRESS_VALIDATION',
                issues: progParsed.error.issues,
            });
        }
        const patch = progParsed.data.execution_state_patch;
        if (progParsed.data.task_id && progParsed.data.task_id !== taskId) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                code: 'TASK_PROGRESS_VALIDATION',
                message: 'task_id must match route id',
            });
        }
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUnique({
                where: { id: taskId },
                include: {
                    workflowInstance: true,
                    requiredSkills: true,
                    assignments: { where: { unassignedAt: null }, take: 1 },
                },
            });
            if (!task)
                throw new common_1.NotFoundException('Task not found.');
            if (user.companyId && task.workflowInstance.companyId !== user.companyId) {
                throw new common_1.NotFoundException('Task not found.');
            }
            if (task.status !== client_1.WarehouseTaskStatus.in_progress) {
                throw new common_1.BadRequestException('progress updates require task status in_progress.');
            }
            const wids = task.assignments.map((a) => a.workerId);
            await this.assertFrontierAndSkillsTx(tx, task, wids);
            const cur = task.executionState && typeof task.executionState === 'object' && !Array.isArray(task.executionState)
                ? task.executionState
                : {};
            const next = { ...cur, ...patch };
            await tx.warehouseTask.update({
                where: { id: taskId },
                data: {
                    executionState: next,
                },
            });
            await this.appendEvent(tx, taskId, 'execution_progress', user.id, { keys: Object.keys(patch) });
        });
        await this.cacheInv.afterTaskMutation();
        return this.loadTaskEnvelope(taskId, user);
    }
    async leaseAcquire(taskId, user, minutesRaw) {
        const minutes = Math.min(Math.max(minutesRaw ?? 30, 5), 480);
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUnique({
                where: { id: taskId },
                include: {
                    workflowInstance: true,
                    requiredSkills: true,
                    assignments: { where: { unassignedAt: null }, take: 1 },
                },
            });
            if (!task)
                throw new common_1.NotFoundException('Task not found.');
            if (user.companyId && task.workflowInstance.companyId !== user.companyId) {
                throw new common_1.NotFoundException('Task not found.');
            }
            if (task.status !== client_1.WarehouseTaskStatus.pending &&
                task.status !== client_1.WarehouseTaskStatus.assigned &&
                task.status !== client_1.WarehouseTaskStatus.in_progress) {
                throw new common_1.BadRequestException('Lease is only valid for open actionable tasks.');
            }
            await this.assertFrontierAndSkillsTx(tx, task, task.assignments.map((a) => a.workerId));
            const until = new Date(Date.now() + minutes * 60_000);
            await tx.warehouseTask.update({
                where: { id: taskId },
                data: { leaseExpiresAt: until },
            });
            await this.appendEvent(tx, taskId, 'lease_acquired', user.id, { leaseExpiresAt: until.toISOString() });
        });
        await this.cacheInv.afterTaskMutation();
        return this.loadTaskEnvelope(taskId, user);
    }
    async leaseRelease(taskId, user) {
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUnique({
                where: { id: taskId },
                include: { workflowInstance: true },
            });
            if (!task)
                throw new common_1.NotFoundException('Task not found.');
            if (user.companyId && task.workflowInstance.companyId !== user.companyId) {
                throw new common_1.NotFoundException('Task not found.');
            }
            await tx.warehouseTask.update({
                where: { id: taskId },
                data: { leaseExpiresAt: null },
            });
            await this.appendEvent(tx, taskId, 'lease_released', user.id);
        });
        await this.cacheInv.afterTaskMutation();
        return this.loadTaskEnvelope(taskId, user);
    }
    async getPathOrder(taskId, user) {
        const task = await this.fetchTaskAuthorized(taskId, user);
        const st = task.executionState && typeof task.executionState === 'object' && !Array.isArray(task.executionState)
            ? task.executionState
            : {};
        const explicit = st.pickPathOrderedIds;
        if (Array.isArray(explicit) && explicit.every((x) => typeof x === 'string')) {
            return { orderedIds: explicit, source: 'pickPathOrderedIds' };
        }
        const reservations = st.reservations;
        if (Array.isArray(reservations)) {
            const ids = [];
            const seen = new Set();
            for (const raw of reservations) {
                const r = raw && typeof raw === 'object' && !Array.isArray(raw)
                    ? raw
                    : null;
                const lidRaw = r?.locationId ?? r?.location_id;
                const lid = typeof lidRaw === 'string' ? lidRaw : '';
                if (lid && !seen.has(lid)) {
                    seen.add(lid);
                    ids.push(lid);
                }
            }
            return { orderedIds: ids, source: 'reservations' };
        }
        return { orderedIds: [], source: 'none' };
    }
    async reopen(taskId, user) {
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUniqueOrThrow({ where: { id: taskId } });
            if (task.status !== client_1.WarehouseTaskStatus.failed) {
                throw new common_1.BadRequestException('Only failed tasks may be reopened.');
            }
            if (!(0, task_transitions_1.canTransitionTask)(task.status, client_1.WarehouseTaskStatus.pending)) {
                throw new common_1.BadRequestException('Invalid reopen.');
            }
            await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.pending, {
                failureReason: null,
            });
            await this.appendEvent(tx, taskId, 'reopened', user.id);
            await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
        });
        await this.cacheInv.afterTaskMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId);
        return this.loadTaskEnvelope(taskId, user);
    }
    async retry(taskId, user, body) {
        if (!['super_admin', 'wh_manager'].includes(user.role)) {
            throw new common_1.ForbiddenException('Only warehouse managers may retry retry_pending tasks.');
        }
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUniqueOrThrow({
                where: { id: taskId },
                include: { workflowInstance: true },
            });
            if (task.status !== client_1.WarehouseTaskStatus.retry_pending) {
                throw new common_1.BadRequestException('retry is only valid when task status is retry_pending.');
            }
            if (!(0, task_transitions_1.canTransitionTask)(task.status, client_1.WarehouseTaskStatus.in_progress)) {
                throw new common_1.BadRequestException('Invalid retry transition.');
            }
            await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.in_progress, {
                failureReason: null,
            });
            await this.appendEvent(tx, taskId, 'retry_initiated', user.id, {
                reason: body?.reason?.trim() ?? null,
            });
            await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
        });
        await this.cacheInv.afterTaskMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId);
        return this.loadTaskEnvelope(taskId, user);
    }
    async resolveBlocked(taskId, user, body) {
        if (!['super_admin', 'wh_manager'].includes(user.role)) {
            throw new common_1.ForbiddenException('Only warehouse managers may resolve blocked tasks.');
        }
        const reason = body.reason.trim();
        await this.prisma.$transaction(async (tx) => {
            await this.lockTask(tx, taskId);
            const task = await tx.warehouseTask.findUniqueOrThrow({
                where: { id: taskId },
                include: { workflowInstance: true },
            });
            if (task.status !== client_1.WarehouseTaskStatus.blocked) {
                throw new common_1.BadRequestException('resolve only applies to blocked tasks.');
            }
            const payloadBase = {
                resolution: body.resolution,
                reason,
                fork_hint: body.fork_hint,
            };
            switch (body.resolution) {
                case 'resume':
                    if (!(0, task_transitions_1.canTransitionTask)(task.status, client_1.WarehouseTaskStatus.in_progress)) {
                        throw new common_1.BadRequestException('Invalid resolve transition.');
                    }
                    await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.in_progress, {
                        failureReason: null,
                    });
                    await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
                    break;
                case 'approve_partial':
                    if (!(0, task_transitions_1.canTransitionTask)(task.status, client_1.WarehouseTaskStatus.in_progress)) {
                        throw new common_1.BadRequestException('Invalid resolve transition.');
                    }
                    await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.in_progress, {
                        failureReason: null,
                    });
                    {
                        const prior = task.workflowInstance.metadata ?? {};
                        const meta = {
                            ...prior,
                            approve_partial_at: new Date().toISOString(),
                            approve_partial_by: user.id,
                            approve_partial_reason: reason,
                        };
                        await tx.workflowInstance.update({
                            where: { id: task.workflowInstanceId },
                            data: { metadata: meta },
                        });
                    }
                    await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
                    break;
                case 'cancel_remaining':
                    if (!(0, task_transitions_1.canTransitionTask)(task.status, client_1.WarehouseTaskStatus.cancelled)) {
                        throw new common_1.BadRequestException('Invalid cancel_remaining transition.');
                    }
                    await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.cancelled, {
                        failureReason: reason.slice(0, 500),
                    });
                    await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
                    await tx.warehouseTask.updateMany({
                        where: {
                            workflowInstanceId: task.workflowInstanceId,
                            id: { not: taskId },
                            status: { in: [client_1.WarehouseTaskStatus.pending, client_1.WarehouseTaskStatus.assigned] },
                        },
                        data: {
                            status: client_1.WarehouseTaskStatus.cancelled,
                            failureReason: `cancel_remaining: ${reason.slice(0, 300)}`,
                        },
                    });
                    break;
                case 'fork_new_task':
                    if (!(0, task_transitions_1.canTransitionTask)(task.status, client_1.WarehouseTaskStatus.in_progress)) {
                        throw new common_1.BadRequestException('Invalid fork_new_task transition.');
                    }
                    await this.bumpStatus(tx, taskId, task.lockVersion, client_1.WarehouseTaskStatus.in_progress, {
                        failureReason: null,
                    });
                    {
                        const prior = task.workflowInstance.metadata ?? {};
                        await tx.workflowInstance.update({
                            where: { id: task.workflowInstanceId },
                            data: {
                                metadata: {
                                    ...prior,
                                    fork_remediation_at: new Date().toISOString(),
                                    fork_remediation_by: user.id,
                                    fork_remediation_hint: body.fork_hint ?? null,
                                },
                            },
                        });
                    }
                    await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
                    break;
                default:
                    throw new common_1.BadRequestException(`Unsupported resolution`);
            }
            await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
        });
        await this.cacheInv.afterTaskMutation();
        void this.realtime.emitTaskUpdatedByTaskId(taskId);
        return this.loadTaskEnvelope(taskId, user);
    }
    async refreshWorkflowInstanceHealth(tx, instanceId) {
        const wf = await tx.workflowInstance.findUnique({ where: { id: instanceId } });
        if (!wf || wf.status === client_1.WorkflowInstanceStatus.completed || wf.status === client_1.WorkflowInstanceStatus.cancelled) {
            return;
        }
        const tasks = await tx.warehouseTask.findMany({
            where: { workflowInstanceId: instanceId },
            select: {
                status: true,
                startedAt: true,
                slaMinutes: true,
            },
        });
        const now = Date.now();
        const bad = tasks.filter((t) => {
            if (t.status === client_1.WarehouseTaskStatus.blocked ||
                t.status === client_1.WarehouseTaskStatus.failed ||
                t.status === client_1.WarehouseTaskStatus.retry_pending) {
                return true;
            }
            if (t.status === client_1.WarehouseTaskStatus.in_progress &&
                t.slaMinutes != null &&
                t.startedAt != null &&
                t.startedAt.getTime() + t.slaMinutes * 60_000 < now) {
                return true;
            }
            return false;
        }).length;
        let next = wf.status;
        if (bad > 0) {
            next = client_1.WorkflowInstanceStatus.degraded;
        }
        else if (wf.status === client_1.WorkflowInstanceStatus.degraded) {
            next = client_1.WorkflowInstanceStatus.in_progress;
        }
        if (next !== wf.status) {
            await tx.workflowInstance.update({
                where: { id: instanceId },
                data: { status: next },
            });
        }
    }
    async ensureWorker(workerId, user) {
        const w = await this.prisma.worker.findUnique({
            where: { id: workerId },
            include: {
                user: { select: { companyId: true, role: true, status: true } },
            },
        });
        if (!w) {
            throw new common_1.BadRequestException('Worker not found. Create a system user with Worker role on Users (with X-Company-Id set), then assign again.');
        }
        if (user.companyId && w.companyId !== user.companyId) {
            throw new common_1.BadRequestException('Worker belongs to a different company than your session (check MOCK_COMPANY_ID / X-Company-Id matches the worker tenant).');
        }
        if (!w.userId ||
            !w.user ||
            w.user.companyId != null ||
            w.user.role !== client_1.UserRole.wh_operator) {
            throw new common_1.BadRequestException('Only operators linked to a system Worker user (Users → system user, Worker role) can be assigned to tasks.');
        }
        if (w.status !== client_1.WorkerOperationalStatus.active) {
            throw new common_1.BadRequestException('This operator profile is inactive.');
        }
        if (w.user.status !== client_1.UserStatus.active) {
            throw new common_1.BadRequestException('This user account is inactive.');
        }
    }
    async loadTaskEnvelope(taskId, user) {
        const task = await this.fetchTaskAuthorized(taskId, user);
        const [enriched] = await this.withRunnableFlags([task]);
        const wf = await this.prisma.workflowInstance.findUnique({
            where: { id: task.workflowInstanceId },
        });
        let orderSummary;
        if (wf?.referenceType === 'inbound_order') {
            const o = await this.prisma.inboundOrder.findUnique({
                where: { id: wf.referenceId },
                select: { id: true, orderNumber: true, status: true },
            });
            if (o)
                orderSummary = { kind: 'inbound', ...o };
        }
        if (wf?.referenceType === 'outbound_order') {
            const o = await this.prisma.outboundOrder.findUnique({
                where: { id: wf.referenceId },
                select: { id: true, orderNumber: true, status: true },
            });
            if (o)
                orderSummary = { kind: 'outbound', ...o };
        }
        const { assignments, workflowInstance: _wf, ...rest } = enriched;
        return {
            task: rest,
            workflowInstance: wf,
            assignments,
            orderSummary,
        };
    }
};
exports.WarehouseTasksService = WarehouseTasksService;
exports.WarehouseTasksService = WarehouseTasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        task_inventory_effects_service_1.TaskInventoryEffectsService,
        cache_invalidation_service_1.CacheInvalidationService,
        workflow_orchestration_service_1.WorkflowOrchestrationService,
        task_read_cache_service_1.TaskReadCacheService,
        realtime_service_1.RealtimeService])
], WarehouseTasksService);
function parsePickPayload(raw) {
    if (!isRecord(raw))
        throw new common_1.BadRequestException('Invalid pick task payload.');
    const lines = raw.lines;
    if (!Array.isArray(lines))
        throw new common_1.BadRequestException('pick payload missing lines.');
    return raw;
}
function receivingOrderId(raw) {
    if (!isRecord(raw) || typeof raw.inbound_order_id !== 'string') {
        throw new common_1.BadRequestException('Invalid receiving task payload.');
    }
    return raw.inbound_order_id;
}
function stagingMapFromReceivingPayload(raw) {
    if (!isRecord(raw) || !Array.isArray(raw.lines))
        throw new common_1.BadRequestException('Receiving payload malformed.');
    const m = new Map();
    for (const row of raw.lines) {
        if (row &&
            typeof row === 'object' &&
            typeof row.inbound_order_line_id === 'string' &&
            typeof row.staging_location_id === 'string') {
            m.set(row.inbound_order_line_id, row.staging_location_id);
        }
    }
    return m;
}
function sourceMapFromPutawayPayload(put) {
    const m = new Map();
    for (const row of put.lines) {
        m.set(row.inbound_order_line_id, {
            locationId: row.source_staging_location_id,
            productId: row.product_id,
            lotId: row.lot_id ?? null,
        });
    }
    return m;
}
function outboundIdFromPackPayload(raw) {
    if (!isRecord(raw) || typeof raw.outbound_order_id !== 'string') {
        throw new common_1.BadRequestException('pack payload malformed.');
    }
    return raw.outbound_order_id;
}
//# sourceMappingURL=warehouse-tasks.service.js.map