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
exports.ClientInboundOrdersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const multer_1 = require("multer");
const create_inbound_dto_1 = require("../../inbound/dto/create-inbound.dto");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const client_inbound_export_service_1 = require("../order-export/client-inbound-export.service");
const inbound_client_import_service_1 = require("../order-import/inbound-client-import.service");
const client_inbound_orders_service_1 = require("./client-inbound-orders.service");
const client_inbound_export_dto_1 = require("./dto/client-inbound-export.dto");
const client_list_inbound_query_dto_1 = require("./dto/client-list-inbound-query.dto");
let ClientInboundOrdersController = class ClientInboundOrdersController {
    inbound;
    importSvc;
    exportSvc;
    constructor(inbound, importSvc, exportSvc) {
        this.inbound = inbound;
        this.importSvc = importSvc;
        this.exportSvc = exportSvc;
    }
    list(client, query) {
        return this.inbound.list(client, query);
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
        return this.inbound.findOne(client, id);
    }
    create(client, body) {
        return this.inbound.create(client, body);
    }
};
exports.ClientInboundOrdersController = ClientInboundOrdersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_list_inbound_query_dto_1.ClientListInboundQueryDto]),
    __metadata("design:returntype", void 0)
], ClientInboundOrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('import/template'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientInboundOrdersController.prototype, "importTemplate", null);
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
], ClientInboundOrdersController.prototype, "importOrders", null);
__decorate([
    (0, common_1.Get)('export/columns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClientInboundOrdersController.prototype, "exportColumns", null);
__decorate([
    (0, common_1.Post)('export'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_inbound_export_dto_1.ClientInboundOrdersExportDto, Object]),
    __metadata("design:returntype", Promise)
], ClientInboundOrdersController.prototype, "exportOrders", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientInboundOrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_inbound_dto_1.CreateInboundOrderDto]),
    __metadata("design:returntype", void 0)
], ClientInboundOrdersController.prototype, "create", null);
exports.ClientInboundOrdersController = ClientInboundOrdersController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client/inbound-orders'),
    __metadata("design:paramtypes", [client_inbound_orders_service_1.ClientInboundOrdersService,
        inbound_client_import_service_1.InboundClientImportService,
        client_inbound_export_service_1.ClientInboundExportService])
], ClientInboundOrdersController);
//# sourceMappingURL=client-inbound-orders.controller.js.map