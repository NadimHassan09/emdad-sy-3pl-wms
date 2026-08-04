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
exports.DocumentSlotOverridesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma/prisma.service");
const realtime_service_1 = require("../modules/realtime/realtime.service");
const EMPTY = {
    clientReference: '',
    notes: '',
    supplier: '',
    poNumber: '',
    operatorName: '',
    destination: '',
    carrier: '',
    trackingNumber: '',
    vehicle: '',
    driver: '',
};
function orEmpty(value) {
    return (value ?? '').trim();
}
function display(value) {
    return value || '—';
}
let DocumentSlotOverridesService = class DocumentSlotOverridesService {
    prisma;
    realtime;
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    async resolveForTask(taskId, type) {
        const merged = await this.loadMerged(taskId, type);
        return {
            clientReference: display(merged.clientReference),
            notes: merged.notes,
            supplier: display(merged.supplier),
            poNumber: display(merged.poNumber),
            operatorName: display(merged.operatorName),
            destination: display(merged.destination),
            carrier: display(merged.carrier),
            trackingNumber: display(merged.trackingNumber),
            vehicle: display(merged.vehicle),
            driver: display(merged.driver),
        };
    }
    async getEditable(taskId, type) {
        const merged = await this.loadMerged(taskId, type);
        return { taskId, type, fields: merged };
    }
    async upsert(taskId, dto) {
        await this.assertTaskMatchesType(taskId, dto.type);
        const data = {
            clientReference: dto.clientReference?.trim() || null,
            notes: dto.notes?.trim() || null,
            supplier: dto.supplier?.trim() || null,
            poNumber: dto.poNumber?.trim() || null,
            operatorName: dto.operatorName?.trim() || null,
            destination: dto.destination?.trim() || null,
            carrier: dto.carrier?.trim() || null,
            trackingNumber: dto.trackingNumber?.trim() || null,
            vehicle: dto.vehicle?.trim() || null,
            driver: dto.driver?.trim() || null,
        };
        await this.prisma.documentSlotOverride.upsert({
            where: { taskId },
            create: { taskId, ...data },
            update: data,
        });
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            include: { workflowInstance: true },
        });
        const referenceId = task?.workflowInstance.referenceId;
        let companyId = null;
        if (task && referenceId) {
            if (dto.type === 'grn') {
                const order = await this.prisma.inboundOrder.findUnique({
                    where: { id: referenceId },
                    select: { companyId: true },
                });
                companyId = order?.companyId ?? null;
            }
            else {
                const order = await this.prisma.outboundOrder.findUnique({
                    where: { id: referenceId },
                    select: { companyId: true },
                });
                companyId = order?.companyId ?? null;
            }
        }
        if (companyId) {
            this.realtime.emitDocumentSlotOverrideChanged(companyId, {
                taskId,
                type: dto.type,
                companyId,
            });
        }
        return this.getEditable(taskId, dto.type);
    }
    async loadMerged(taskId, type) {
        const { defaults, override } = await this.loadSources(taskId, type);
        return {
            clientReference: orEmpty(override?.clientReference ?? defaults.clientReference),
            notes: orEmpty(override?.notes ?? defaults.notes),
            supplier: orEmpty(override?.supplier ?? defaults.supplier),
            poNumber: orEmpty(override?.poNumber ?? defaults.poNumber),
            operatorName: orEmpty(override?.operatorName ?? defaults.operatorName),
            destination: orEmpty(override?.destination ?? defaults.destination),
            carrier: orEmpty(override?.carrier ?? defaults.carrier),
            trackingNumber: orEmpty(override?.trackingNumber ?? defaults.trackingNumber),
            vehicle: orEmpty(override?.vehicle ?? defaults.vehicle),
            driver: orEmpty(override?.driver ?? defaults.driver),
        };
    }
    async loadSources(taskId, type) {
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            include: { workflowInstance: true },
        });
        if (!task)
            throw new common_1.NotFoundException('Task not found.');
        await this.assertTaskMatchesType(taskId, type, task);
        const override = await this.prisma.documentSlotOverride.findUnique({ where: { taskId } });
        const refId = task.workflowInstance.referenceId;
        if (type === 'grn') {
            const order = await this.prisma.inboundOrder.findUnique({
                where: { id: refId },
                include: { company: true },
            });
            if (!order)
                throw new common_1.NotFoundException('Inbound order not found.');
            const operator = task.completedById
                ? await this.prisma.user.findUnique({ where: { id: task.completedById } })
                : null;
            return {
                override,
                defaults: {
                    ...EMPTY,
                    clientReference: orEmpty(order.clientReference),
                    notes: orEmpty(order.notes),
                    operatorName: orEmpty(operator?.fullName),
                },
            };
        }
        const order = await this.prisma.outboundOrder.findUnique({ where: { id: refId } });
        if (!order)
            throw new common_1.NotFoundException('Outbound order not found.');
        const operator = task.completedById
            ? await this.prisma.user.findUnique({ where: { id: task.completedById } })
            : null;
        return {
            override,
            defaults: {
                ...EMPTY,
                clientReference: orEmpty(order.clientReference),
                notes: orEmpty(order.notes),
                destination: orEmpty(order.destinationAddress),
                carrier: orEmpty(order.carrier),
                trackingNumber: orEmpty(order.trackingNumber),
                operatorName: orEmpty(operator?.fullName),
            },
        };
    }
    async assertTaskMatchesType(taskId, type, task) {
        const row = task ??
            (await this.prisma.warehouseTask.findUnique({
                where: { id: taskId },
                select: { taskType: true },
            }));
        if (!row)
            throw new common_1.NotFoundException('Task not found.');
        const expected = type === 'grn' ? 'receiving' : 'dispatch';
        if (row.taskType !== expected) {
            throw new common_1.BadRequestException(`Task type does not match document type ${type}.`);
        }
    }
};
exports.DocumentSlotOverridesService = DocumentSlotOverridesService;
exports.DocumentSlotOverridesService = DocumentSlotOverridesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_service_1.RealtimeService])
], DocumentSlotOverridesService);
//# sourceMappingURL=document-slot-overrides.service.js.map