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
exports.OmsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const multer_1 = require("multer");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const oms_order_dto_1 = require("./dto/oms-order.dto");
const oms_dashboard_service_1 = require("./oms-dashboard.service");
const oms_orders_csv_service_1 = require("./oms-orders-csv.service");
const oms_orders_service_1 = require("./oms-orders.service");
const list_oms_orders_query_dto_1 = require("./dto/list-oms-orders-query.dto");
const oms_dashboard_order_summary_query_dto_1 = require("./dto/oms-dashboard-order-summary-query.dto");
let OmsController = class OmsController {
    orders;
    dashboard;
    csv;
    constructor(orders, dashboard, csv) {
        this.orders = orders;
        this.dashboard = dashboard;
        this.csv = csv;
    }
    dashboardSummary(user, companyId) {
        return this.dashboard.summary(user, companyId);
    }
    orderSummary(user, query) {
        return this.dashboard.orderSummary(user, query);
    }
    list(user, query) {
        return this.orders.list(user, query);
    }
    async exportOrders(user, query, res) {
        const result = await this.csv.exportCsv(user, query);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Export-Row-Count', String(result.rowCount));
        res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
        return result.body;
    }
    importTemplate(res) {
        const result = this.csv.getImportTemplate();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return result.body;
    }
    async validateImport(user, file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('CSV file is required.');
        }
        const result = await this.csv.validateImport(user, file.buffer);
        const { _validPayloads: _, ...publicResult } = result;
        return publicResult;
    }
    async importOrders(user, file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('CSV file is required.');
        }
        return this.csv.executeImport(user, file.buffer);
    }
    create(user, dto) {
        return this.orders.create(user, dto, { provisionOutbound: !dto.outboundOrderId });
    }
    findOne(user, id) {
        return this.orders.findById(id, user);
    }
    update(user, id, dto) {
        return this.orders.update(id, user, dto);
    }
    delete(user, id) {
        return this.orders.delete(id, user);
    }
    confirm(user, id) {
        return this.orders.confirm(id, user);
    }
    approve(user, id, dto) {
        return this.orders.approve(id, user, dto);
    }
    reject(user, id, dto) {
        return this.orders.reject(id, user, dto);
    }
    cancel(user, id) {
        return this.orders.cancel(id, user);
    }
    failedDelivery(user, id) {
        return this.orders.markFailedDelivery(id, user);
    }
    complete(user, id) {
        return this.orders.markCompleted(id, user);
    }
    allocate(user, id, dto) {
        return this.orders.allocate(id, user, dto);
    }
    releaseAllocation(user, id) {
        return this.orders.releaseAllocation(id, user);
    }
    outForDelivery(user, id) {
        return this.orders.markOutForDelivery(id, user);
    }
    recordExternalFulfillment(user, id) {
        return this.orders.recordExternalFulfillment(id, user);
    }
    delivered(user, id) {
        return this.orders.markDelivered(id, user);
    }
    deliveryRevert(user, id, dto) {
        return this.orders.revertDelivery(id, user, dto);
    }
    returned(user, id) {
        return this.orders.markReturned(id, user);
    }
    collectCod(user, id) {
        return this.orders.collectCod(id, user);
    }
    settleCod(user, id) {
        return this.orders.settleCod(id, user);
    }
    timeline(user, id) {
        return this.orders.timeline(id, user);
    }
};
exports.OmsController = OmsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "dashboardSummary", null);
__decorate([
    (0, common_1.Get)('dashboard/order-summary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_dashboard_order_summary_query_dto_1.OmsDashboardOrderSummaryQueryDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "orderSummary", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_oms_orders_query_dto_1.ListOmsOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('orders/export'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_oms_orders_query_dto_1.ListOmsOrdersQueryDto, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "exportOrders", null);
__decorate([
    (0, common_1.Get)('orders/import/template'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "importTemplate", null);
__decorate([
    (0, common_1.Post)('orders/import/validate'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "validateImport", null);
__decorate([
    (0, common_1.Post)('orders/import'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "importOrders", null);
__decorate([
    (0, common_1.Post)('orders'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_order_dto_1.CreateOmsOrderDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('orders/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('orders/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_order_dto_1.UpdateOmsOrderDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('orders/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('orders/:id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)('orders/:id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_order_dto_1.ApproveOmsOrderDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('orders/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_order_dto_1.RejectOmsOrderDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)('orders/:id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('orders/:id/failed-delivery'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "failedDelivery", null);
__decorate([
    (0, common_1.Post)('orders/:id/complete'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)('orders/:id/allocate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_order_dto_1.AllocateOmsOrderDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "allocate", null);
__decorate([
    (0, common_1.Post)('orders/:id/release-allocation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "releaseAllocation", null);
__decorate([
    (0, common_1.Post)('orders/:id/out-for-delivery'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "outForDelivery", null);
__decorate([
    (0, common_1.Post)('orders/:id/external-fulfillment'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "recordExternalFulfillment", null);
__decorate([
    (0, common_1.Post)('orders/:id/delivered'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "delivered", null);
__decorate([
    (0, common_1.Post)('orders/:id/delivery-revert'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_order_dto_1.RevertOmsDeliveryDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "deliveryRevert", null);
__decorate([
    (0, common_1.Post)('orders/:id/returned'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "returned", null);
__decorate([
    (0, common_1.Post)('orders/:id/cod/collect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "collectCod", null);
__decorate([
    (0, common_1.Post)('orders/:id/cod/settle'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "settleCod", null);
__decorate([
    (0, common_1.Get)('orders/:id/timeline'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "timeline", null);
exports.OmsController = OmsController = __decorate([
    (0, common_1.Controller)('oms'),
    __metadata("design:paramtypes", [oms_orders_service_1.OmsOrdersService,
        oms_dashboard_service_1.OmsDashboardService,
        oms_orders_csv_service_1.OmsOrdersCsvService])
], OmsController);
//# sourceMappingURL=oms.controller.js.map