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
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const oms_order_dto_1 = require("./dto/oms-order.dto");
const oms_dashboard_service_1 = require("./oms-dashboard.service");
const oms_orders_service_1 = require("./oms-orders.service");
const list_oms_orders_query_dto_1 = require("./dto/list-oms-orders-query.dto");
let OmsController = class OmsController {
    orders;
    dashboard;
    constructor(orders, dashboard) {
        this.orders = orders;
        this.dashboard = dashboard;
    }
    dashboardSummary(user, companyId) {
        return this.dashboard.summary(user, companyId);
    }
    list(user, query) {
        return this.orders.list(user, query);
    }
    create(user, dto) {
        return this.orders.create(user, dto);
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
    delivered(user, id) {
        return this.orders.markDelivered(id, user);
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
    (0, common_1.Get)('orders'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_oms_orders_query_dto_1.ListOmsOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "list", null);
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
    (0, common_1.Post)('orders/:id/delivered'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "delivered", null);
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
        oms_dashboard_service_1.OmsDashboardService])
], OmsController);
//# sourceMappingURL=oms.controller.js.map