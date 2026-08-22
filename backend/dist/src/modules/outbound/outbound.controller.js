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
exports.OutboundController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const multer_1 = require("multer");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_outbound_dto_1 = require("./dto/create-outbound.dto");
const confirm_outbound_body_dto_1 = require("./dto/confirm-outbound-body.dto");
const list_outbound_query_dto_1 = require("./dto/list-outbound-query.dto");
const update_outbound_plan_dto_1 = require("./dto/update-outbound-plan.dto");
const update_shipping_details_dto_1 = require("./dto/update-shipping-details.dto");
const outbound_orders_csv_service_1 = require("./outbound-orders-csv.service");
const outbound_service_1 = require("./outbound.service");
let OutboundController = class OutboundController {
    outbound;
    csv;
    constructor(outbound, csv) {
        this.outbound = outbound;
        this.csv = csv;
    }
    create(user, dto) {
        return this.outbound.create(user, dto);
    }
    quickDirected() {
        throw new common_1.GoneException('Quick directed outbound is no longer available.');
    }
    list(user, query) {
        return this.outbound.list(user, query);
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
    findOne(user, id) {
        return this.outbound.findById(id, user);
    }
    updatePlan(user, id, body) {
        return this.outbound.updatePlan(user, id, body);
    }
    approve(user, id) {
        return this.outbound.approveAdmin(user, id);
    }
    completePicking(user, id) {
        return this.outbound.completePickingAdmin(user, id);
    }
    completePacking(user, id) {
        return this.outbound.completePackingAdmin(user, id);
    }
    selectShippingMethod(user, id, body) {
        return this.outbound.selectShippingMethodAdmin(user, id, body);
    }
    saveShippingDetails(user, id, body) {
        return this.outbound.saveShippingDetails(user, id, body);
    }
    sendShippingDetails(user, id) {
        return this.outbound.sendShippingDetails(user, id);
    }
    completeShippingDetails(user, id) {
        return this.outbound.completeShippingDetailsAdmin(user, id);
    }
    completeDispatch(user, id) {
        return this.outbound.completeDispatchAdmin(user, id);
    }
    executeAdmin(user, id) {
        return this.outbound.executeAdmin(user, id);
    }
    confirm(user, id, body) {
        return this.outbound.confirmAndDeduct(user, id, body);
    }
    cancel(user, id) {
        return this.outbound.cancel(id, user);
    }
    remove(user, id) {
        return this.outbound.remove(id, user);
    }
};
exports.OutboundController = OutboundController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_outbound_dto_1.CreateOutboundOrderDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('quick-directed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "quickDirected", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_outbound_query_dto_1.ListOutboundQueryDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_outbound_query_dto_1.ListOutboundQueryDto, Object]),
    __metadata("design:returntype", Promise)
], OutboundController.prototype, "exportOrders", null);
__decorate([
    (0, common_1.Get)('import/template'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "importTemplate", null);
__decorate([
    (0, common_1.Post)('import/validate'),
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
], OutboundController.prototype, "validateImport", null);
__decorate([
    (0, common_1.Post)('import'),
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
], OutboundController.prototype, "importOrders", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/plan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_outbound_plan_dto_1.UpdateOutboundPlanDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/complete-picking'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "completePicking", null);
__decorate([
    (0, common_1.Post)(':id/complete-packing'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "completePacking", null);
__decorate([
    (0, common_1.Post)(':id/select-shipping-method'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "selectShippingMethod", null);
__decorate([
    (0, common_1.Patch)(':id/shipping-details'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_shipping_details_dto_1.UpdateShippingDetailsDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "saveShippingDetails", null);
__decorate([
    (0, common_1.Post)(':id/shipping-details/send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "sendShippingDetails", null);
__decorate([
    (0, common_1.Post)(':id/complete-shipping-details'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "completeShippingDetails", null);
__decorate([
    (0, common_1.Post)(':id/complete-dispatch'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "completeDispatch", null);
__decorate([
    (0, common_1.Post)(':id/execute-admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "executeAdmin", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, confirm_outbound_body_dto_1.ConfirmOutboundBodyDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "cancel", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "remove", null);
exports.OutboundController = OutboundController = __decorate([
    (0, common_1.Controller)('outbound-orders'),
    __metadata("design:paramtypes", [outbound_service_1.OutboundService,
        outbound_orders_csv_service_1.OutboundOrdersCsvService])
], OutboundController);
//# sourceMappingURL=outbound.controller.js.map