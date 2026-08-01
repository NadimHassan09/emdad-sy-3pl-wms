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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const invoice_pdf_service_1 = require("../../pdf/invoice-pdf.service");
const billing_cycles_service_1 = require("./billing-cycles.service");
const billing_dashboard_service_1 = require("./billing-dashboard.service");
const billing_invoices_service_1 = require("./billing-invoices.service");
const billing_plans_service_1 = require("./billing-plans.service");
const billing_preview_service_1 = require("./billing-preview.service");
const order_manual_charges_service_1 = require("./order-manual-charges.service");
const update_invoice_status_dto_1 = require("./dto/update-invoice-status.dto");
const create_billing_plan_dto_1 = require("./dto/create-billing-plan.dto");
const create_invoice_line_dto_1 = require("./dto/create-invoice-line.dto");
const invoice_mutations_dto_1 = require("./dto/invoice-mutations.dto");
const list_billing_invoices_query_dto_1 = require("./dto/list-billing-invoices-query.dto");
const list_billing_plans_query_dto_1 = require("./dto/list-billing-plans-query.dto");
const update_billing_plan_dto_1 = require("./dto/update-billing-plan.dto");
const create_order_manual_charge_dto_1 = require("./dto/create-order-manual-charge.dto");
const update_order_manual_charge_dto_1 = require("./dto/update-order-manual-charge.dto");
let BillingController = class BillingController {
    plans;
    cycles;
    invoices;
    dashboard;
    preview;
    orderCharges;
    invoicePdf;
    constructor(plans, cycles, invoices, dashboard, preview, orderCharges, invoicePdf) {
        this.plans = plans;
        this.cycles = cycles;
        this.invoices = invoices;
        this.dashboard = dashboard;
        this.preview = preview;
        this.orderCharges = orderCharges;
        this.invoicePdf = invoicePdf;
    }
    capacitySummary() {
        return this.plans.getCapacitySummary();
    }
    companyStorage(user, companyId) {
        return this.plans.getCompanyStorageSummary(companyId, user);
    }
    listPlans(user, query) {
        return this.plans.listPage(user, query);
    }
    getPlan(user, id) {
        return this.plans.findById(user, id);
    }
    createPlan(user, dto) {
        return this.plans.create(user, dto);
    }
    updatePlan(user, id, dto) {
        return this.plans.update(user, id, dto);
    }
    listCycles(user, companyId) {
        return this.cycles.list(user, companyId);
    }
    listExpiringSoon(user, limit) {
        const n = limit ? Number.parseInt(limit, 10) : 5;
        return this.cycles.listExpiringSoon(user, Number.isFinite(n) ? n : 5);
    }
    getCycle(user, id) {
        return this.cycles.findById(user, id);
    }
    renewCycle(user, id) {
        return this.cycles.renew(user, id);
    }
    listInvoices(user, query) {
        return this.invoices.listPage(user, query);
    }
    createAdHocInvoice(user, dto) {
        return this.invoices.createAdHoc(user, dto);
    }
    dashboardSummary(user) {
        return this.dashboard.getSummary(user);
    }
    expiringBuckets(user) {
        return this.dashboard.listExpiringBuckets(user);
    }
    cyclePreview(user, companyId) {
        return this.preview.getCompanyPreview(user, companyId);
    }
    listOverdueClients(user, limit) {
        const n = limit ? Number.parseInt(limit, 10) : 5;
        return this.dashboard.listOverdueClients(user, Number.isFinite(n) ? n : 5);
    }
    listRecentInvoices(user, limit) {
        const n = limit ? Number.parseInt(limit, 10) : 5;
        return this.dashboard.listRecentInvoices(user, Number.isFinite(n) ? n : 5);
    }
    listSuspendedAccounts(user, limit) {
        const n = limit ? Number.parseInt(limit, 10) : 5;
        return this.dashboard.listSuspendedAccounts(user, Number.isFinite(n) ? n : 5);
    }
    getInvoice(user, id) {
        return this.invoices.findById(user, id);
    }
    async downloadInvoicePdf(user, id, res) {
        await this.invoices.findById(user, id);
        const buffer = await this.invoicePdf.renderInvoicePdf(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
        res.setHeader('Content-Length', buffer.byteLength.toString());
        res.end(buffer);
    }
    updateInvoice(user, id, dto) {
        return this.invoices.updateInvoice(user, id, dto);
    }
    issueInvoice(user, id) {
        return this.invoices.issueInvoice(user, id);
    }
    updateInvoiceStatus(user, id, dto) {
        return this.invoices.updateStatus(user, id, dto.status);
    }
    addInvoiceLine(user, id, dto) {
        return this.invoices.addLine(user, id, dto);
    }
    updateInvoiceLine(user, id, lineId, dto) {
        return this.invoices.updateManualLine(user, id, lineId, dto);
    }
    removeInvoiceLine(user, id, lineId) {
        return this.invoices.removeManualLine(user, id, lineId);
    }
    listOrderCharges(user, referenceType, referenceId) {
        return this.orderCharges.listForReference(user, referenceType, referenceId);
    }
    createOrderCharge(user, dto) {
        return this.orderCharges.create(user, dto);
    }
    updateOrderCharge(user, id, dto) {
        return this.orderCharges.update(user, id, dto);
    }
    removeOrderCharge(user, id) {
        return this.orderCharges.remove(user, id);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)('capacity'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "capacitySummary", null);
__decorate([
    (0, common_1.Get)('companies/:companyId/storage'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('companyId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "companyStorage", null);
__decorate([
    (0, common_1.Get)('plans'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_billing_plans_query_dto_1.ListBillingPlansQueryDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listPlans", null);
__decorate([
    (0, common_1.Get)('plans/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getPlan", null);
__decorate([
    (0, common_1.Post)('plans'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_billing_plan_dto_1.CreateBillingPlanDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "createPlan", null);
__decorate([
    (0, common_1.Patch)('plans/:id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_billing_plan_dto_1.UpdateBillingPlanDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Get)('cycles'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listCycles", null);
__decorate([
    (0, common_1.Get)('cycles/expiring-soon'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listExpiringSoon", null);
__decorate([
    (0, common_1.Get)('cycles/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getCycle", null);
__decorate([
    (0, common_1.Post)('cycles/:id/renew'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "renewCycle", null);
__decorate([
    (0, common_1.Get)('invoices'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_billing_invoices_query_dto_1.ListBillingInvoicesQueryDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listInvoices", null);
__decorate([
    (0, common_1.Post)('invoices/ad-hoc'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, invoice_mutations_dto_1.CreateAdHocInvoiceDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "createAdHocInvoice", null);
__decorate([
    (0, common_1.Get)('dashboard/summary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "dashboardSummary", null);
__decorate([
    (0, common_1.Get)('dashboard/expiring-buckets'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "expiringBuckets", null);
__decorate([
    (0, common_1.Get)('preview'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "cyclePreview", null);
__decorate([
    (0, common_1.Get)('dashboard/overdue-clients'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listOverdueClients", null);
__decorate([
    (0, common_1.Get)('dashboard/recent-invoices'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listRecentInvoices", null);
__decorate([
    (0, common_1.Get)('dashboard/suspended-accounts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listSuspendedAccounts", null);
__decorate([
    (0, common_1.Get)('invoices/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getInvoice", null);
__decorate([
    (0, common_1.Get)('invoices/:id/pdf'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "downloadInvoicePdf", null);
__decorate([
    (0, common_1.Patch)('invoices/:id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, invoice_mutations_dto_1.UpdateInvoiceDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updateInvoice", null);
__decorate([
    (0, common_1.Post)('invoices/:id/issue'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "issueInvoice", null);
__decorate([
    (0, common_1.Patch)('invoices/:id/status'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_invoice_status_dto_1.UpdateInvoiceStatusDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updateInvoiceStatus", null);
__decorate([
    (0, common_1.Post)('invoices/:id/lines'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_invoice_line_dto_1.CreateInvoiceLineDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "addInvoiceLine", null);
__decorate([
    (0, common_1.Patch)('invoices/:id/lines/:lineId'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, invoice_mutations_dto_1.UpdateManualInvoiceLineDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updateInvoiceLine", null);
__decorate([
    (0, common_1.Delete)('invoices/:id/lines/:lineId'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "removeInvoiceLine", null);
__decorate([
    (0, common_1.Get)('order-charges'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('referenceType')),
    __param(2, (0, common_1.Query)('referenceId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listOrderCharges", null);
__decorate([
    (0, common_1.Post)('order-charges'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_order_manual_charge_dto_1.CreateOrderManualChargeDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "createOrderCharge", null);
__decorate([
    (0, common_1.Patch)('order-charges/:id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_order_manual_charge_dto_1.UpdateOrderManualChargeDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updateOrderCharge", null);
__decorate([
    (0, common_1.Delete)('order-charges/:id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "removeOrderCharge", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_plans_service_1.BillingPlansService,
        billing_cycles_service_1.BillingCyclesService,
        billing_invoices_service_1.BillingInvoicesService,
        billing_dashboard_service_1.BillingDashboardService,
        billing_preview_service_1.BillingPreviewService,
        order_manual_charges_service_1.OrderManualChargesService,
        invoice_pdf_service_1.InvoicePdfService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map