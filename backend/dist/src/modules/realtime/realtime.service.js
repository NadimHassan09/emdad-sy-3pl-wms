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
const realtime_socket_auth_1 = require("./realtime-socket-auth");
const realtime_events_1 = require("./realtime.events");
const realtime_task_payload_1 = require("./realtime-task.payload");
const mutation_bus_service_1 = require("./sync/mutation-bus.service");
const realtime_sync_mode_service_1 = require("./sync/realtime-sync-mode.service");
let RealtimeService = RealtimeService_1 = class RealtimeService {
    prisma;
    mutationBus;
    syncMode;
    log = new common_1.Logger(RealtimeService_1.name);
    io = null;
    dashboardSchedule = null;
    constructor(prisma, mutationBus, syncMode) {
        this.prisma = prisma;
        this.mutationBus = mutationBus;
        this.syncMode = syncMode;
    }
    mutationQueue = null;
    attachServer(server) {
        this.io = server;
        this.mutationQueue?.attachServer(server);
    }
    attachMutationQueue(queue) {
        this.mutationQueue = queue;
        if (this.io)
            queue.attachServer(this.io);
    }
    notify(mutationId, companyId, userId) {
        this.mutationBus.publish({ mutationId, companyId, userId });
    }
    registerDashboardSchedule(fn) {
        this.dashboardSchedule = fn;
    }
    scheduleDashboard(section) {
        try {
            this.dashboardSchedule?.(section);
        }
        catch (err) {
            this.log.warn(`Dashboard schedule failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    emitDashboard(event, payload) {
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, event, payload);
    }
    emitToRoomRaw(room, event, payload) {
        if (!this.io) {
            this.log.debug(`Skip ${event} (socket server not ready).`);
            return;
        }
        try {
            this.io.to(room).emit(event, { ...payload, at: new Date().toISOString() });
        }
        catch (err) {
            this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    emitToRoom(room, event, payload) {
        if (!this.syncMode.emitLegacy())
            return;
        this.emitToRoomRaw(room, event, payload);
    }
    emit(companyId, event, payload) {
        if (!this.syncMode.emitLegacy())
            return;
        if (!this.io) {
            this.log.debug(`Skip ${event} (socket server not ready).`);
            return;
        }
        const normalizedCompanyId = (0, realtime_socket_auth_1.normalizeCompanyId)(companyId);
        if (!normalizedCompanyId) {
            this.log.warn(`Skip ${event}: invalid company room id.`);
            return;
        }
        try {
            const body = { ...payload, companyId: normalizedCompanyId, at: new Date().toISOString() };
            this.io.to((0, realtime_socket_auth_1.companyRoomName)(normalizedCompanyId)).emit(event, body);
        }
        catch (err) {
            this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    emitInboundOrderCreated(companyId, payload) {
        this.notify('InboundCreated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.INBOUND_ORDER_CREATED, payload);
        this.scheduleDashboard('orders');
    }
    emitInboundOrderUpdated(companyId, payload) {
        this.notify('InboundUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.INBOUND_ORDER_UPDATED, payload);
        this.scheduleDashboard('orders');
    }
    emitOutboundOrderCreated(companyId, payload) {
        this.notify('OutboundCreated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.OUTBOUND_ORDER_CREATED, payload);
        this.scheduleDashboard('orders');
    }
    emitOutboundOrderUpdated(companyId, payload) {
        this.notify('OutboundUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.OUTBOUND_ORDER_UPDATED, payload);
        this.scheduleDashboard('orders');
    }
    emitOmsOrderEvent(companyId, payload) {
        this.notify('OmsOrderEvent', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.OMS_ORDER_EVENT, payload);
        this.scheduleDashboard('orders');
    }
    emitOmsReturnEvent(companyId, payload) {
        this.notify('OmsReturnEvent', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.OMS_RETURN_EVENT, payload);
        this.scheduleDashboard('orders');
    }
    emitCompanyLifecycleChanged(companyId, payload) {
        this.notify('CompanyLifecycle', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.COMPANY_LIFECYCLE_CHANGED, payload);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.COMPANY_LIFECYCLE_CHANGED, payload);
        this.scheduleDashboard('kpi');
    }
    emitBillingRestrictionChanged(companyId, payload) {
        this.notify('BillingRestriction', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.BILLING_RESTRICTION_CHANGED, payload);
        this.scheduleDashboard('kpi');
    }
    emitCodUpdated(companyId, payload) {
        this.notify('CodUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.COD_UPDATED, payload);
        this.scheduleDashboard('orders');
    }
    emitDocumentGenerated(companyId, payload) {
        this.notify('DocumentGenerated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.DOCUMENT_GENERATED, payload);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.DOCUMENT_GENERATED, {
            ...payload,
            companyId,
        });
    }
    emitDocumentSlotOverrideChanged(companyId, payload) {
        this.notify('DocumentSlotOverride', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.DOCUMENT_SLOT_OVERRIDE_CHANGED, payload);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.DOCUMENT_SLOT_OVERRIDE_CHANGED, payload);
    }
    emitFinalContractChanged(companyId, payload) {
        this.notify('FinalContractChanged', companyId);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.FINAL_CONTRACT_CHANGED, payload);
        if (companyId) {
            this.emit(companyId, realtime_events_1.RealtimeEvents.FINAL_CONTRACT_CHANGED, payload);
        }
    }
    emitFormSubmitted(payload) {
        this.notify('FormSubmitted');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.FORM_SUBMITTED, payload);
    }
    emitInvoiceUpdated(companyId, payload) {
        this.notify('InvoiceUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.INVOICE_UPDATED, payload);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.INVOICE_UPDATED, payload);
        this.scheduleDashboard('kpi');
    }
    emitPlanUpdated(companyId, payload) {
        this.notify('PlanUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.PLAN_UPDATED, payload);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.PLAN_UPDATED, payload);
        this.scheduleDashboard('kpi');
    }
    emitBackupJobProgress(payload) {
        this.notify('BackupJobProgress');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.BACKUP_JOB_PROGRESS, payload);
    }
    emitBulkShippingProgress(payload) {
        this.notify('ShippingBulkProgress');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.SHIPPING_BULK_PROGRESS, payload);
    }
    emitTaskUpdated(companyId, payload) {
        this.notify('TaskUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.TASK_UPDATED, payload);
        this.scheduleDashboard('tasks');
    }
    emitInventoryChanged(companyId, payload) {
        this.notify('InventoryChanged', companyId);
        void this.emitInventoryChangedAsync(companyId, payload);
    }
    async emitInventoryChangedAsync(companyId, payload) {
        const body = { ...payload };
        if (payload.productId) {
            const [stockRow, productSummary] = await Promise.all([
                this.fetchClientStockRow(companyId, payload.productId),
                this.fetchAdminProductSummary(companyId, payload.productId),
            ]);
            if (stockRow)
                body.stockRow = stockRow;
            if (productSummary)
                body.productSummary = productSummary;
        }
        this.emit(companyId, realtime_events_1.RealtimeEvents.INVENTORY_CHANGED, body);
        this.scheduleDashboard('inventory');
    }
    async fetchAdminProductSummary(companyId, productId) {
        const product = await this.prisma.product.findFirst({
            where: { id: productId, companyId },
            select: {
                id: true,
                sku: true,
                name: true,
                uom: true,
                barcode: true,
                company: { select: { id: true, name: true } },
            },
        });
        if (!product)
            return null;
        const agg = await this.prisma.currentStock.aggregate({
            where: { companyId, productId },
            _sum: { quantityOnHand: true },
        });
        return {
            productId: product.id,
            totalQuantity: String(agg._sum.quantityOnHand ?? 0),
            product: {
                id: product.id,
                sku: product.sku,
                name: product.name,
                uom: product.uom,
                barcode: product.barcode,
            },
            client: product.company,
        };
    }
    async fetchClientStockRow(companyId, productId) {
        const product = await this.prisma.product.findFirst({
            where: { id: productId, companyId },
            select: { id: true, name: true, sku: true, uom: true },
        });
        if (!product)
            return null;
        const agg = await this.prisma.currentStock.aggregate({
            where: { companyId, productId },
            _sum: { quantityOnHand: true },
        });
        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            totalQuantity: String(agg._sum.quantityOnHand ?? 0),
            uom: product.uom,
            expiryDate: null,
        };
    }
    emitProductCreated(companyId, product) {
        this.notify('ProductCreated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.PRODUCT_CREATED, { product });
        this.scheduleDashboard('kpi');
    }
    emitProductUpdated(companyId, product) {
        this.notify('ProductUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.PRODUCT_UPDATED, { product });
        this.scheduleDashboard('kpi');
    }
    emitProductArchived(companyId, productId) {
        this.notify('ProductArchived', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.PRODUCT_ARCHIVED, { productId });
        this.scheduleDashboard('kpi');
    }
    emitProductDeleted(companyId, productId) {
        this.notify('ProductDeleted', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.PRODUCT_DELETED, { productId });
        this.scheduleDashboard('kpi');
    }
    emitUserCreated(user) {
        this.notify('UserCreated', user.companyId);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.USER_CREATED, { user });
        if (user.companyId) {
            this.emit(user.companyId, realtime_events_1.RealtimeEvents.USER_CREATED, { user });
        }
        this.scheduleDashboard('kpi');
    }
    emitUserUpdated(user) {
        this.notify('UserUpdated', user.companyId);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.USER_UPDATED, { user });
        if (user.companyId) {
            this.emit(user.companyId, realtime_events_1.RealtimeEvents.USER_UPDATED, { user });
        }
    }
    emitUserDeleted(userId, companyId) {
        this.notify('UserDeleted', companyId);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.USER_DELETED, { userId });
        if (companyId) {
            this.emit(companyId, realtime_events_1.RealtimeEvents.USER_DELETED, { userId });
        }
    }
    emitWarehouseCreated(warehouse) {
        this.notify('WarehouseCreated');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.WAREHOUSE_CREATED, { warehouse });
    }
    emitWarehouseUpdated(warehouse) {
        this.notify('WarehouseUpdated');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.WAREHOUSE_UPDATED, { warehouse });
    }
    emitLocationCreated(location) {
        this.notify('LocationCreated');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.LOCATION_CREATED, { location });
        this.scheduleDashboard('inventory');
    }
    emitLocationUpdated(location) {
        this.notify('LocationUpdated');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.LOCATION_UPDATED, { location });
        this.scheduleDashboard('inventory');
    }
    emitLocationArchived(warehouseId, locationId) {
        this.notify('LocationArchived');
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.LOCATION_ARCHIVED, {
            warehouseId,
            locationId,
        });
        this.scheduleDashboard('inventory');
    }
    emitReturnCreated(companyId, payload) {
        this.notify('ReturnCreated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.RETURN_CREATED, payload);
        this.scheduleDashboard('kpi');
    }
    emitReturnUpdated(companyId, payload) {
        this.notify('ReturnUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.RETURN_UPDATED, payload);
    }
    emitReturnConfirmed(companyId, payload) {
        this.notify('ReturnConfirmed', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.RETURN_CONFIRMED, payload);
    }
    emitReturnCompleted(companyId, payload) {
        this.notify('ReturnCompleted', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.RETURN_COMPLETED, payload);
        this.scheduleDashboard('inventory');
        this.scheduleDashboard('kpi');
    }
    emitCycleCountCreated(companyId, payload) {
        this.notify('CycleCountCreated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.CYCLE_COUNT_CREATED, payload);
        this.scheduleDashboard('kpi');
    }
    emitCycleCountUpdated(companyId, payload) {
        this.notify('CycleCountUpdated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.CYCLE_COUNT_UPDATED, payload);
    }
    emitCycleCountCompleted(companyId, payload) {
        this.notify('CycleCountCompleted', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.CYCLE_COUNT_COMPLETED, payload);
        this.scheduleDashboard('inventory');
        this.scheduleDashboard('kpi');
    }
    emitAdjustmentCreated(companyId, adjustment) {
        this.notify('AdjustmentCreated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.ADJUSTMENT_CREATED, { adjustment });
    }
    emitAdjustmentApproved(companyId, adjustment) {
        this.notify('AdjustmentApproved', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.ADJUSTMENT_APPROVED, { adjustment });
        this.scheduleDashboard('inventory');
    }
    emitTransferCreated(companyId, transfer) {
        this.notify('TransferCreated', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.TRANSFER_CREATED, { transfer });
    }
    emitTransferCompleted(companyId, transfer) {
        this.notify('TransferCompleted', companyId);
        this.emit(companyId, realtime_events_1.RealtimeEvents.TRANSFER_COMPLETED, { transfer });
        this.scheduleDashboard('inventory');
    }
    emitDashboardKpiUpdated(patch) {
        this.notify('DashboardUpdated');
        this.emitDashboard(realtime_events_1.RealtimeEvents.DASHBOARD_KPI_UPDATED, patch);
    }
    emitDashboardInventoryUpdated(patch) {
        this.notify('DashboardUpdated');
        this.emitDashboard(realtime_events_1.RealtimeEvents.DASHBOARD_INVENTORY_UPDATED, patch);
    }
    emitDashboardOrdersUpdated(patch) {
        this.notify('DashboardUpdated');
        this.emitDashboard(realtime_events_1.RealtimeEvents.DASHBOARD_ORDERS_UPDATED, patch);
    }
    emitDashboardTasksUpdated(patch) {
        this.notify('DashboardUpdated');
        this.emitDashboard(realtime_events_1.RealtimeEvents.DASHBOARD_TASKS_UPDATED, patch);
    }
    emitPresenceOnline(presence) {
        this.emitToRoomRaw(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.PRESENCE_ONLINE, { presence });
    }
    emitPresenceOffline(presence) {
        this.emitToRoomRaw(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.PRESENCE_OFFLINE, { presence });
    }
    emitAuthSessionChanged(userId, payload) {
        this.notify('SessionChanged', null, userId);
        this.emitToUserRaw(userId, realtime_events_1.RealtimeEvents.AUTH_SESSION_CHANGED, payload);
        this.emitToRoomRaw(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.AUTH_SESSION_CHANGED, payload);
    }
    emitToUserRaw(userId, event, payload) {
        if (!this.io) {
            this.log.debug(`Skip ${event} (socket server not ready).`);
            return;
        }
        try {
            this.io.to((0, realtime_socket_auth_1.userRoomName)(userId)).emit(event, { ...payload, at: new Date().toISOString() });
        }
        catch (err) {
            this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    emitToUser(userId, event, payload) {
        if (!this.syncMode.emitLegacy())
            return;
        this.emitToUserRaw(userId, event, payload);
    }
    emitAuditLogCreated(auditLog, companyId) {
        this.notify('AuditLogCreated', companyId);
        this.emitToRoom(realtime_socket_auth_1.INTERNAL_MASTER_DATA_ROOM, realtime_events_1.RealtimeEvents.AUDIT_LOG_CREATED, { auditLog });
        if (companyId) {
            this.emit(companyId, realtime_events_1.RealtimeEvents.AUDIT_LOG_CREATED, { auditLog });
        }
    }
    emitNotificationCreated(notification, target) {
        this.notify('NotificationCreated', target.companyId, target.userId);
        const payload = { notification };
        if (target.userId) {
            this.emitToUser(target.userId, realtime_events_1.RealtimeEvents.NOTIFICATION_CREATED, payload);
        }
        else if (target.companyId) {
            this.emit(target.companyId, realtime_events_1.RealtimeEvents.NOTIFICATION_CREATED, payload);
        }
    }
    emitNotificationRead(userId, payload) {
        this.notify('NotificationRead', null, userId);
        this.emitToUser(userId, realtime_events_1.RealtimeEvents.NOTIFICATION_READ, payload);
    }
    emitNotificationDeleted(userId, notificationId) {
        this.notify('NotificationDeleted', null, userId);
        this.emitToUser(userId, realtime_events_1.RealtimeEvents.NOTIFICATION_DELETED, { notificationId });
    }
    async emitTaskUpdatedByTaskId(taskId, options) {
        const taskPayload = await (0, realtime_task_payload_1.buildTaskListPayload)(this.prisma, taskId);
        if (!taskPayload?.companyId)
            return;
        const companyId = String(taskPayload.companyId);
        this.emitTaskUpdated(companyId, taskPayload);
        if (options?.inventorySource) {
            const productId = await this.resolveProductIdFromTask(taskId);
            this.emitInventoryChanged(companyId, {
                taskId,
                source: options.inventorySource,
                productId: productId ?? undefined,
            });
        }
    }
    async resolveProductIdFromTask(taskId) {
        const task = await this.prisma.warehouseTask.findUnique({
            where: { id: taskId },
            select: { taskType: true, workflowInstance: { select: { referenceId: true, referenceType: true } } },
        });
        if (!task)
            return null;
        if (task.workflowInstance.referenceType === 'outbound_order') {
            const line = await this.prisma.outboundOrderLine.findFirst({
                where: { outboundOrderId: task.workflowInstance.referenceId },
                select: { productId: true },
            });
            return line?.productId ?? null;
        }
        if (task.workflowInstance.referenceType === 'inbound_order') {
            const line = await this.prisma.inboundOrderLine.findFirst({
                where: { inboundOrderId: task.workflowInstance.referenceId },
                select: { productId: true },
            });
            return line?.productId ?? null;
        }
        return null;
    }
    getHealthSnapshot() {
        if (!this.io) {
            return { attached: false, connectedClients: 0 };
        }
        try {
            return {
                attached: true,
                connectedClients: this.io.sockets.sockets.size,
            };
        }
        catch {
            return { attached: true, connectedClients: 0 };
        }
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = RealtimeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mutation_bus_service_1.MutationBusService,
        realtime_sync_mode_service_1.RealtimeSyncModeService])
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map