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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOrderExecutionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const warehouse_tasks_service_1 = require("../warehouse-workflow/warehouse-tasks.service");
const execution_plan_util_1 = require("./execution-plan.util");
const inbound_service_1 = require("../inbound/inbound.service");
const outbound_service_1 = require("../outbound/outbound.service");
const OPEN = [
    client_1.WarehouseTaskStatus.pending,
    client_1.WarehouseTaskStatus.assigned,
    client_1.WarehouseTaskStatus.in_progress,
];
function isRecord(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
function wrapStep(step, err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new common_1.BadRequestException(`Admin execute failed at ${step}: ${msg}`);
}
let AdminOrderExecutionService = class AdminOrderExecutionService {
    prisma;
    inbound;
    outbound;
    tasks;
    constructor(prisma, inbound, outbound, tasks) {
        this.prisma = prisma;
        this.inbound = inbound;
        this.outbound = outbound;
        this.tasks = tasks;
    }
    async findOpenTask(referenceType, referenceId, taskType) {
        return this.prisma.warehouseTask.findFirst({
            where: {
                taskType,
                status: { in: OPEN },
                workflowInstance: { referenceType, referenceId },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async waitForOpenTask(referenceType, referenceId, taskType, attempts = 8) {
        for (let i = 0; i < attempts; i++) {
            const t = await this.findOpenTask(referenceType, referenceId, taskType);
            if (t)
                return t;
            await new Promise((r) => setTimeout(r, 50 * (i + 1)));
        }
        throw new common_1.BadRequestException(`Admin execute failed: expected open ${taskType} task was not created.`);
    }
    async executeInboundAdmin(user, orderId) {
        const order = await this.inbound.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('execute-admin requires executionMode=admin.');
        }
        if (order.status !== 'draft' && order.status !== 'pending_approval') {
            throw new common_1.BadRequestException(`Admin execute requires draft order (current: ${order.status}).`);
        }
        const plan = (0, execution_plan_util_1.parseInboundExecutionPlan)(order.executionPlan);
        if (!plan)
            throw new common_1.BadRequestException('Admin execute requires a saved executionPlan.');
        (0, execution_plan_util_1.assertInboundAdminPlanComplete)(plan);
        const stagingByLineId = {};
        for (const line of order.lines) {
            stagingByLineId[line.id] = plan.receivingDockId;
        }
        try {
            await this.inbound.confirm(user, orderId, {
                warehouseId: plan.warehouseId,
                stagingByLineId,
            });
        }
        catch (err) {
            throw wrapStep('confirm', err);
        }
        const receiving = await this.waitForOpenTask('inbound_order', orderId, client_1.WarehouseTaskType.receiving);
        const receiveBody = {
            task_type: 'receiving',
            lines: order.lines.map((l) => {
                const lotPayload = l.product?.trackingType === 'lot' && l.expectedLotNumber?.trim()
                    ? { capture_lot_number: l.expectedLotNumber.trim() }
                    : {};
                return {
                    inbound_order_line_id: l.id,
                    received_qty: String(l.expectedQuantity),
                    ...lotPayload,
                };
            }),
        };
        try {
            await this.tasks.adminConfirm(receiving.id, user, receiveBody);
        }
        catch (err) {
            throw wrapStep('receiving', err);
        }
        const putaway = await this.waitForOpenTask('inbound_order', orderId, client_1.WarehouseTaskType.putaway);
        const putawayLines = [];
        for (const ol of order.lines) {
            const planLine = plan.lines.find((p) => p.orderLineId === ol.id) ??
                plan.lines.find((p) => p.productId === ol.productId);
            for (const s of planLine?.putaway ?? []) {
                putawayLines.push({
                    inbound_order_line_id: ol.id,
                    putaway_quantity: String(s.qty),
                    destination_location_id: s.locationId,
                });
            }
        }
        if (putawayLines.length === 0) {
            throw new common_1.BadRequestException('Admin execute failed at putaway: no destination splits.');
        }
        try {
            await this.tasks.adminConfirm(putaway.id, user, {
                task_type: 'putaway',
                lines: putawayLines,
            });
        }
        catch (err) {
            throw wrapStep('putaway', err);
        }
        return this.inbound.findById(orderId, user);
    }
    async executeOutboundAdmin(user, orderId) {
        const order = await this.outbound.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('execute-admin requires executionMode=admin.');
        }
        if (order.status !== 'draft' && order.status !== 'pending_approval') {
            throw new common_1.BadRequestException(`Admin execute requires draft order (current: ${order.status}).`);
        }
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        if (!plan)
            throw new common_1.BadRequestException('Admin execute requires a saved executionPlan.');
        (0, execution_plan_util_1.assertOutboundAdminPlanComplete)(plan);
        try {
            await this.outbound.confirmAndDeduct(user, orderId, { warehouseId: plan.warehouseId });
        }
        catch (err) {
            throw wrapStep('confirm', err);
        }
        const pick = await this.waitForOpenTask('outbound_order', orderId, client_1.WarehouseTaskType.pick);
        try {
            await this.tasks.start(pick.id, user);
        }
        catch (err) {
            throw wrapStep('pick_start', err);
        }
        const pickDetail = await this.prisma.warehouseTask.findUnique({ where: { id: pick.id } });
        if (!pickDetail)
            throw new common_1.NotFoundException('Pick task missing after start.');
        const exec = isRecord(pickDetail.executionState) ? pickDetail.executionState : {};
        const reservations = Array.isArray(exec.reservations) ? exec.reservations : [];
        if (reservations.length === 0) {
            throw new common_1.BadRequestException('Admin execute failed at pick: no FEFO reservations (stock may be insufficient).');
        }
        const pickGroups = new Map();
        for (const raw of reservations) {
            if (!isRecord(raw))
                continue;
            const lineId = typeof raw.outboundOrderLineId === 'string'
                ? raw.outboundOrderLineId
                : typeof raw.outbound_order_line_id === 'string'
                    ? raw.outbound_order_line_id
                    : null;
            const locationId = typeof raw.locationId === 'string'
                ? raw.locationId
                : typeof raw.location_id === 'string'
                    ? raw.location_id
                    : null;
            const qty = raw.quantity != null
                ? String(raw.quantity)
                : raw.qty != null
                    ? String(raw.qty)
                    : null;
            if (!lineId || !locationId || !qty)
                continue;
            const lotRaw = raw.lotId ?? raw.lot_id;
            const lotId = lotRaw == null || lotRaw === '' ? null : String(lotRaw);
            const g = pickGroups.get(lineId) ?? [];
            g.push({ location_id: locationId, lot_id: lotId, quantity: qty });
            pickGroups.set(lineId, g);
        }
        try {
            await this.tasks.complete(pick.id, user, {
                task_type: 'pick',
                picks: [...pickGroups.entries()].map(([outbound_order_line_id, lines]) => ({
                    outbound_order_line_id,
                    lines,
                })),
            });
        }
        catch (err) {
            throw wrapStep('pick', err);
        }
        const requiresPacking = order.requiresPacking !== false && plan.requiresPacking !== false;
        if (requiresPacking) {
            const pack = await this.waitForOpenTask('outbound_order', orderId, client_1.WarehouseTaskType.pack);
            const refreshed = await this.outbound.findById(orderId, user);
            try {
                await this.tasks.adminConfirm(pack.id, user, {
                    task_type: 'pack',
                    lines: refreshed.lines.map((l) => ({
                        outbound_order_line_id: l.id,
                        packed_qty: String(l.pickedQuantity ?? l.requestedQuantity),
                    })),
                });
            }
            catch (err) {
                throw wrapStep('pack', err);
            }
        }
        const dispatch = await this.waitForOpenTask('outbound_order', orderId, client_1.WarehouseTaskType.dispatch);
        const finalOrder = await this.outbound.findById(orderId, user);
        try {
            await this.tasks.adminConfirm(dispatch.id, user, {
                task_type: 'dispatch',
                lines: finalOrder.lines.map((l) => ({
                    outbound_order_line_id: l.id,
                    ship_qty: String(l.pickedQuantity ?? l.requestedQuantity),
                })),
            });
        }
        catch (err) {
            throw wrapStep('dispatch', err);
        }
        return this.outbound.findById(orderId, user);
    }
};
exports.AdminOrderExecutionService = AdminOrderExecutionService;
exports.AdminOrderExecutionService = AdminOrderExecutionService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => inbound_service_1.InboundService))),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => outbound_service_1.OutboundService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inbound_service_1.InboundService,
        outbound_service_1.OutboundService,
        warehouse_tasks_service_1.WarehouseTasksService])
], AdminOrderExecutionService);
//# sourceMappingURL=admin-order-execution.service.js.map