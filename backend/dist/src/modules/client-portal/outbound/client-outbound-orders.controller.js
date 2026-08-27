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
exports.ClientOutboundOrdersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const multer_1 = require("multer");
const create_outbound_dto_1 = require("../../outbound/dto/create-outbound.dto");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const client_outbound_export_service_1 = require("../order-export/client-outbound-export.service");
const outbound_client_import_service_1 = require("../order-import/outbound-client-import.service");
const client_outbound_orders_service_1 = require("./client-outbound-orders.service");
const client_outbound_export_dto_1 = require("./dto/client-outbound-export.dto");
const client_list_outbound_query_dto_1 = require("./dto/client-list-outbound-query.dto");
let ClientOutboundOrdersController = class ClientOutboundOrdersController {
    outbound;
    importSvc;
    exportSvc;
    constructor(outbound, importSvc, exportSvc) {
        this.outbound = outbound;
        this.importSvc = importSvc;
        this.exportSvc = exportSvc;
    }
    list(client, query) {
        return this.outbound.list(client, query);
    }
    importTemplate(res) {
        const result = this.importSvc.getImportTemplate();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return result.body;
    }
    async importOrders(client, file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('Excel or CSV file is required.');
        }
        return this.importSvc.importFile(client, file.buffer, file.originalname);
    }
    exportColumns() {
        return this.exportSvc.columns();
    }
    async exportOrders(client, dto, res) {
        const result = await this.exportSvc.exportCsv(client, dto);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Export-Row-Count', String(result.rowCount));
        res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
        return result.body;
    }
    findOne(client, id) {
        return this.outbound.findOne(client, id);
    }
    create(client, body) {
        return this.outbound.create(client, body);
    }
};
exports.ClientOutboundOrdersController = ClientOutboundOrdersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_list_outbound_query_dto_1.ClientListOutboundQueryDto]),
    __metadata("design:returntype", void 0)
], ClientOutboundOrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('import/template'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientOutboundOrdersController.prototype, "importTemplate", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ClientOutboundOrdersController.prototype, "importOrders", null);
__decorate([
    (0, common_1.Get)('export/columns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClientOutboundOrdersController.prototype, "exportColumns", null);
__decorate([
    (0, common_1.Post)('export'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_outbound_export_dto_1.ClientOutboundOrdersExportDto, Object]),
    __metadata("design:returntype", Promise)
], ClientOutboundOrdersController.prototype, "exportOrders", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientOutboundOrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_outbound_dto_1.CreateOutboundOrderDto]),
    __metadata("design:returntype", void 0)
], ClientOutboundOrdersController.prototype, "create", null);
exports.ClientOutboundOrdersController = ClientOutboundOrdersController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client/outbound-orders'),
    __metadata("design:paramtypes", [client_outbound_orders_service_1.ClientOutboundOrdersService,
        outbound_client_import_service_1.OutboundClientImportService,
        client_outbound_export_service_1.ClientOutboundExportService])
], ClientOutboundOrdersController);
//# sourceMappingURL=client-outbound-orders.controller.js.map