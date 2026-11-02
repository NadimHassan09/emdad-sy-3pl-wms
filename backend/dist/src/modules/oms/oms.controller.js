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
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const adjust_shipping_fee_dto_1 = require("./dto/adjust-shipping-fee.dto");
const oms_order_dto_1 = require("./dto/oms-order.dto");
const oms_dashboard_service_1 = require("./oms-dashboard.service");
const oms_orders_csv_service_1 = require("./oms-orders-csv.service");
const oms_orders_service_1 = require("./oms-orders.service");
const oms_bulk_service_1 = require("./oms-bulk.service");
const bulk_approve_oms_orders_dto_1 = require("./dto/bulk-approve-oms-orders.dto");
const list_oms_orders_query_dto_1 = require("./dto/list-oms-orders-query.dto");
const oms_dashboard_order_summary_query_dto_1 = require("./dto/oms-dashboard-order-summary-query.dto");
const oms_orders_export_dto_1 = require("./dto/oms-orders-export.dto");
const export_waybills_dto_1 = require("./dto/export-waybills.dto");
const oms_waybill_service_1 = require("./oms-waybill.service");
const oms_instruction_pdf_service_1 = require("./oms-instruction-pdf.service");
const oms_client_import_service_1 = require("../client-portal/order-import/oms-client-import.service");
const oms_shipping_scan_service_1 = require("./oms-shipping-scan.service");
const scan_shipping_transition_dto_1 = require("./dto/scan-shipping-transition.dto");
const inbound_traceability_service_1 = require("./inbound-traceability.service");
let OmsController = class OmsController {
    orders;
    bulk;
    dashboard;
    csv;
    clientImport;
    waybillService;
    instructionPdf;
    shippingScan;
    traceability;
    constructor(orders, bulk, dashboard, csv, clientImport, waybillService, instructionPdf, shippingScan, traceability) {
        this.orders = orders;
        this.bulk = bulk;
        this.dashboard = dashboard;
        this.csv = csv;
        this.clientImport = clientImport;
        this.waybillService = waybillService;
        this.instructionPdf = instructionPdf;
        this.shippingScan = shippingScan;
        this.traceability = traceability;
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
    statusNavCounts(user, query) {
        return this.orders.statusNavCounts(user, query);
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
        const { columnIds, arabicHeaders, ids, format = 'csv', ...query } = dto;
        if (format === 'xlsx') {
            const result = await this.csv.exportXlsx(user, query, { columnIds, arabicHeaders, ids });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('X-Export-Row-Count', String(result.rowCount));
            res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
            return result.buffer;
        }
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
        throw new common_1.BadRequestException('Client-format import validates on upload. Use POST /oms/orders/import with companyId.');
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
    create(user, dto) {
        return this.orders.create(user, dto);
    }
    scanShippingTransition(user, dto) {
        return this.shippingScan.apply(user, dto.code, dto.action);
    }
    approveBulk(user, dto) {
        return this.bulk.approveBulk(user, dto.ids);
    }
    confirmBulk(user, dto) {
        return this.bulk.confirmBulk(user, dto.ids);
    }
    cancelBulk(user, dto) {
        return this.bulk.cancelBulk(user, dto.ids);
    }
    cancelShipmentsBulk(user, dto) {
        return this.orders.cancelShipmentsBulk(dto.ids, user);
    }
    deliveredBulk(user, dto) {
        return this.bulk.deliveredBulk(user, dto.ids);
    }
    failedDeliveryBulk(user, dto) {
        return this.bulk.failedDeliveryBulk(user, dto.ids);
    }
    returnedBulk(user, dto) {
        return this.bulk.returnedBulk(user, dto.ids);
    }
    adjustShippingFeeBulk(user, dto) {
        return this.bulk.adjustShippingFeeBulk(user, dto);
    }
    async exportWaybillsExcel(user, dto, res) {
        const result = await this.waybillService.exportWaybillsExcel(dto.orderIds, user);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Length', result.buffer.byteLength.toString());
        res.setHeader('X-Export-Row-Count', String(result.count));
        res.end(result.buffer);
    }
    async downloadWaybillsPdf(user, dto, res) {
        const result = await this.waybillService.generateCombinedWaybillPdf(dto.orderIds, user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Length', result.buffer.byteLength.toString());
        res.setHeader('X-Label-Count', String(result.count));
        res.end(result.buffer);
    }
    async downloadInstructionsPdf(user, dto, res) {
        const { buffer, filename } = await this.instructionPdf.downloadCombined(user, dto.ids);
        this.sendDownload(res, buffer, filename, 'application/pdf');
    }
    async downloadInstructionsZip(user, dto, res) {
        const { buffer, filename } = await this.instructionPdf.downloadZip(user, dto.ids);
        this.sendDownload(res, buffer, filename, 'application/zip');
    }
    findOne(user, id) {
        return this.orders.findById(id, user);
    }
    getTraceability(user, id) {
        return this.traceability.getTraceabilityForOrder(id, user);
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
    adjustShippingFee(user, id, dto) {
        return this.orders.adjustShippingFee(user, id, dto, { mode: 'single' });
    }
    reject(user, id, dto) {
        return this.orders.reject(id, user, dto);
    }
    cancel(user, id) {
        return this.orders.cancel(id, user);
    }
    cancelShipment(user, id, body) {
        return this.orders.cancelShipment(id, user, body?.reason, body?.force);
    }
    cancelRevert(user, id) {
        return this.orders.revertCancel(id, user);
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
    confirmReturnReceipt(user, id) {
        return this.orders.confirmReturnReceipt(id, user);
    }
    undoConfirmedReturn(user, id) {
        return this.orders.undoConfirmedReturn(id, user);
    }
    rollbackReturn(user, id, body) {
        return this.orders.rollbackReturn(id, user, body);
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
    shippingMovement(user, id) {
        return this.orders.getShippingMovement(id, user);
    }
    async downloadOrderInstructionsPdf(user, id, res) {
        const { buffer, filename } = await this.instructionPdf.downloadOne(user, id);
        this.sendDownload(res, buffer, filename, 'application/pdf');
    }
    getWaybill(user, id) {
        return this.waybillService.getWaybillData(id, user);
    }
    async downloadWaybillPdf(user, id, res) {
        const { buffer, filename } = await this.waybillService.generateWaybillPdf(id, user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.byteLength.toString());
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.end(buffer);
    }
    sendDownload(res, buffer, filename, contentType) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.byteLength.toString());
        res.end(buffer);
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
    (0, common_1.Get)('orders/nav-counts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_oms_orders_query_dto_1.ListOmsOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "statusNavCounts", null);
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
    (0, common_1.Get)('orders/export/columns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "exportColumns", null);
__decorate([
    (0, common_1.Post)('orders/export'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_orders_export_dto_1.OmsOrdersExportDto, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "exportOrdersPost", null);
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
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
    __param(2, (0, common_1.Body)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
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
    (0, common_1.Post)('orders/scan-shipping-transition'),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, scan_shipping_transition_dto_1.ScanShippingTransitionDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "scanShippingTransition", null);
__decorate([
    (0, common_1.Post)('orders/approve-bulk'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "approveBulk", null);
__decorate([
    (0, common_1.Post)('orders/confirm-bulk'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "confirmBulk", null);
__decorate([
    (0, common_1.Post)('orders/cancel-bulk'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "cancelBulk", null);
__decorate([
    (0, common_1.Post)('orders/cancel-shipments-bulk'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "cancelShipmentsBulk", null);
__decorate([
    (0, common_1.Post)('orders/delivered-bulk'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "deliveredBulk", null);
__decorate([
    (0, common_1.Post)('orders/failed-delivery-bulk'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "failedDeliveryBulk", null);
__decorate([
    (0, common_1.Post)('orders/returned-bulk'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "returnedBulk", null);
__decorate([
    (0, common_1.Post)('orders/adjust-shipping-fee-bulk'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, adjust_shipping_fee_dto_1.AdjustShippingFeeBulkDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "adjustShippingFeeBulk", null);
__decorate([
    (0, common_1.Post)('orders/waybills/export-excel'),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, export_waybills_dto_1.ExportWaybillsDto, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "exportWaybillsExcel", null);
__decorate([
    (0, common_1.Post)('orders/waybills/pdf'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, export_waybills_dto_1.ExportWaybillsDto, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "downloadWaybillsPdf", null);
__decorate([
    (0, common_1.Post)('orders/instructions/pdf'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "downloadInstructionsPdf", null);
__decorate([
    (0, common_1.Post)('orders/instructions/zip'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_approve_oms_orders_dto_1.BulkApproveOmsOrdersDto, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "downloadInstructionsZip", null);
__decorate([
    (0, common_1.Get)('orders/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('orders/:id/traceability'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "getTraceability", null);
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
    (0, common_1.Post)('orders/:id/adjust-shipping-fee'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, adjust_shipping_fee_dto_1.AdjustShippingFeeDto]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "adjustShippingFee", null);
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
    (0, common_1.Post)('orders/:id/cancel-shipment'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "cancelShipment", null);
__decorate([
    (0, common_1.Post)('orders/:id/cancel-revert'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "cancelRevert", null);
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
    (0, common_1.Post)('orders/:id/confirm-return-receipt'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "confirmReturnReceipt", null);
__decorate([
    (0, common_1.Post)('orders/:id/undo-confirmed-return'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "undoConfirmedReturn", null);
__decorate([
    (0, common_1.Post)('orders/:id/rollback-return'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "rollbackReturn", null);
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
__decorate([
    (0, common_1.Get)('orders/:id/shipping-movement'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "shippingMovement", null);
__decorate([
    (0, common_1.Get)('orders/:id/instructions/pdf'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "downloadOrderInstructionsPdf", null);
__decorate([
    (0, common_1.Get)('orders/:id/waybill'),
    (0, common_1.Header)('Cache-Control', 'no-store, no-cache, must-revalidate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsController.prototype, "getWaybill", null);
__decorate([
    (0, common_1.Get)('orders/:id/waybill/pdf'),
    (0, common_1.Header)('Cache-Control', 'no-store, no-cache, must-revalidate'),
    (0, common_1.Header)('Pragma', 'no-cache'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], OmsController.prototype, "downloadWaybillPdf", null);
exports.OmsController = OmsController = __decorate([
    (0, common_1.Controller)('oms'),
    __metadata("design:paramtypes", [oms_orders_service_1.OmsOrdersService,
        oms_bulk_service_1.OmsBulkService,
        oms_dashboard_service_1.OmsDashboardService,
        oms_orders_csv_service_1.OmsOrdersCsvService,
        oms_client_import_service_1.OmsClientImportService,
        oms_waybill_service_1.OmsWaybillService,
        oms_instruction_pdf_service_1.OmsInstructionPdfService,
        oms_shipping_scan_service_1.OmsShippingScanService,
        inbound_traceability_service_1.InboundTraceabilityService])
], OmsController);
//# sourceMappingURL=oms.controller.js.map