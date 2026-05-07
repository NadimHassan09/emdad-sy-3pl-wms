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
var RealtimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_events_1 = require("./realtime.events");
let RealtimeService = RealtimeService_1 = class RealtimeService {
    prisma;
    log = new common_1.Logger(RealtimeService_1.name);
    io = null;
    constructor(prisma) {
        this.prisma = prisma;
    }
    attachServer(server) {
        this.io = server;
    }
    emit(companyId, event, payload) {
        if (!this.io) {
            this.log.debug(`Skip ${event} (socket server not ready).`);
            return;
        }
        try {
            const body = { ...payload, companyId, at: new Date().toISOString() };
            this.io.to(`company:${companyId}`).emit(event, body);
        }
        catch (err) {
            this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    emitInboundOrderCreated(companyId, payload) {
        this.emit(companyId, realtime_events_1.RealtimeEvents.INBOUND_ORDER_CREATED, payload);
    }
    emitInboundOrderUpdated(companyId, payload) {
        this.emit(companyId, realtime_events_1.RealtimeEvents.INBOUND_ORDER_UPDATED, payload);
    }
    emitOutboundOrderCreated(companyId, payload) {
        this.emit(companyId, realtime_events_1.RealtimeEvents.OUTBOUND_ORDER_CREATED, payload);
    }
    emitOutboundOrderUpdated(companyId, payload) {
        this.emit(companyId, realtime_events_1.RealtimeEvents.OUTBOUND_ORDER_UPDATED, payload);
    }
    emitTaskUpdated(companyId, payload) {
        this.emit(companyId, realtime_events_1.RealtimeEvents.TASK_UPDATED, payload);
    }
    emitInventoryChanged(companyId, payload) {
        this.emit(companyId, realtime_events_1.RealtimeEvents.INVENTORY_CHANGED, payload);
    }
    async emitTaskUpdatedByTaskId(taskId, options) {
        const row = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            select: {
                id: true,
                workflowInstance: { select: { companyId: true, warehouseId: true } },
            },
        });
        if (!row)
            return;
        const { companyId, warehouseId } = row.workflowInstance;
        this.emitTaskUpdated(companyId, { taskId, warehouseId });
        if (options?.inventorySource) {
            this.emitInventoryChanged(companyId, {
                taskId,
                source: options.inventorySource,
            });
        }
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = RealtimeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map