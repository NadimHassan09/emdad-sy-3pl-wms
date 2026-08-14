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
exports.ClientOmsOrdersController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const client_oms_orders_service_1 = require("./client-oms-orders.service");
const create_client_oms_order_dto_1 = require("./dto/create-client-oms-order.dto");
const client_cod_report_query_dto_1 = require("./dto/client-cod-report-query.dto");
const client_oms_status_summary_query_dto_1 = require("./dto/client-oms-status-summary-query.dto");
const list_client_oms_orders_query_dto_1 = require("./dto/list-client-oms-orders-query.dto");
let ClientOmsOrdersController = class ClientOmsOrdersController {
    oms;
    constructor(oms) {
        this.oms = oms;
    }
    list(client, query) {
        return this.oms.list(client, query);
    }
    statusSummary(client, query) {
        return this.oms.statusSummary(client, query);
    }
    create(client, dto) {
        return this.oms.create(client, dto);
    }
    confirm(client, id) {
        return this.oms.confirm(client, id);
    }
    cancel(client, id) {
        return this.oms.cancel(client, id);
    }
    findOne(client, id) {
        return this.oms.findOne(client, id);
    }
    timeline(client, id) {
        return this.oms.timeline(client, id);
    }
    codReport(client, query) {
        return this.oms.codReport(client, query);
    }
};
exports.ClientOmsOrdersController = ClientOmsOrdersController;
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_client_oms_orders_query_dto_1.ListClientOmsOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('orders/status-summary'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_oms_status_summary_query_dto_1.ClientOmsStatusSummaryQueryDto]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "statusSummary", null);
__decorate([
    (0, common_1.Post)('orders'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_client_oms_order_dto_1.CreateClientOmsOrderDto]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('orders/:id/confirm'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)('orders/:id/cancel'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('orders/:id'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('orders/:id/timeline'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "timeline", null);
__decorate([
    (0, common_1.Get)('cod-report'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_cod_report_query_dto_1.ClientCodReportQueryDto]),
    __metadata("design:returntype", void 0)
], ClientOmsOrdersController.prototype, "codReport", null);
exports.ClientOmsOrdersController = ClientOmsOrdersController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client/oms'),
    __metadata("design:paramtypes", [client_oms_orders_service_1.ClientOmsOrdersService])
], ClientOmsOrdersController);
//# sourceMappingURL=client-oms-orders.controller.js.map