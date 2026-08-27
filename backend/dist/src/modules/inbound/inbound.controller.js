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
exports.InboundController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const multer_1 = require("multer");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const confirm_inbound_body_dto_1 = require("./dto/confirm-inbound-body.dto");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_inbound_dto_1 = require("./dto/create-inbound.dto");
const inbound_orders_export_dto_1 = require("./dto/inbound-orders-export.dto");
const list_inbound_query_dto_1 = require("./dto/list-inbound-query.dto");
const receive_line_dto_1 = require("./dto/receive-line.dto");
const update_inbound_plan_dto_1 = require("./dto/update-inbound-plan.dto");
const inbound_orders_csv_service_1 = require("./inbound-orders-csv.service");
const inbound_service_1 = require("./inbound.service");
const inbound_client_import_service_1 = require("../client-portal/order-import/inbound-client-import.service");
let InboundController = class InboundController {
    inbound;
    csv;
    clientImport;
    constructor(inbound, csv, clientImport) {
        this.inbound = inbound;
        this.csv = csv;
        this.clientImport = clientImport;
    }
    create(user, dto) {
        return this.inbound.create(user, dto);
    }
    list(user, query) {
        return this.inbound.list(user, query);
    }
    async exportOrders(user, query, res) {
        const result = await this.csv.exportCsv(user, query);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Export-Row-Count', String(result.rowCount));
        res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
        return result.body;
    }
    exportColumns() {
        return this.csv.columns();
    }
    async exportOrdersPost(user, dto, res) {
        const { columnIds, arabicHeaders, ids, ...query } = dto;
        const result = await this.csv.exportCsv(user, query, { columnIds, arabicHeaders, ids });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Export-Row-Count', String(result.rowCount));
        res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
        return result.body;
    }
    importTemplate(res) {
        const result = this.clientImport.getImportTemplate();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return result.body;
    }
    async validateImport() {
        throw new common_1.BadRequestException('Client-format import validates on upload. Use POST /inbound-orders/import with companyId.');
    }
    async importOrders(user, file, companyId) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('CSV file is required.');
        }
        if (!companyId?.trim()) {
            throw new common_1.BadRequestException('companyId is required.');
        }
        const summary = await this.clientImport.importFileForCompany(user, companyId.trim(), file.buffer, file.originalname);
        return {
            ...summary,
            imported: summary.created,
            failed: summary.invalid,
            skippedDuplicates: summary.duplicate,
            createdOrderNumbers: summary.createdOrderNumbers,
            errors: summary.errors.map((e) => ({
                rowNumber: e.rowNumber,
                externalReference: e.orderNumber,
                reason: e.error,
            })),
        };
    }
    findOne(user, id) {
        return this.inbound.findById(id, user);
    }
    updatePlan(user, id, body) {
        return this.inbound.updatePlan(user, id, body);
    }
    approve(user, id) {
        return this.inbound.approveAdmin(user, id);
    }
    completeReceiving(user, id) {
        return this.inbound.completeReceivingAdmin(user, id);
    }
    completePutaway(user, id) {
        return this.inbound.completePutawayAdmin(user, id);
    }
    executeAdmin(user, id) {
        return this.inbound.executeAdmin(user, id);
    }
    confirm(user, id, body) {
        return this.inbound.confirm(user, id, body);
    }
    cancel(user, id) {
        return this.inbound.cancel(id, user);
    }
    remove(user, id) {
        return this.inbound.remove(id, user);
    }
    receive(user, id, lineId, dto) {
        return this.inbound.receiveLine(user, id, lineId, dto);
    }
};
exports.InboundController = InboundController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_inbound_dto_1.CreateInboundOrderDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_inbound_query_dto_1.ListInboundQueryDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_inbound_query_dto_1.ListInboundQueryDto, Object]),
    __metadata("design:returntype", Promise)
], InboundController.prototype, "exportOrders", null);
__decorate([
    (0, common_1.Get)('export/columns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "exportColumns", null);
__decorate([
    (0, common_1.Post)('export'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, inbound_orders_export_dto_1.InboundOrdersExportDto, Object]),
    __metadata("design:returntype", Promise)
], InboundController.prototype, "exportOrdersPost", null);
__decorate([
    (0, common_1.Get)('import/template'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "importTemplate", null);
__decorate([
    (0, common_1.Post)('import/validate'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InboundController.prototype, "validateImport", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], InboundController.prototype, "importOrders", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/plan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_inbound_plan_dto_1.UpdateInboundPlanDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/complete-receiving'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "completeReceiving", null);
__decorate([
    (0, common_1.Post)(':id/complete-putaway'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "completePutaway", null);
__decorate([
    (0, common_1.Post)(':id/execute-admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "executeAdmin", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, confirm_inbound_body_dto_1.ConfirmInboundBodyDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "cancel", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/lines/:lineId/receive'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, receive_line_dto_1.ReceiveLineDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "receive", null);
exports.InboundController = InboundController = __decorate([
    (0, common_1.Controller)('inbound-orders'),
    __metadata("design:paramtypes", [inbound_service_1.InboundService,
        inbound_orders_csv_service_1.InboundOrdersCsvService,
        inbound_client_import_service_1.InboundClientImportService])
], InboundController);
//# sourceMappingURL=inbound.controller.js.map