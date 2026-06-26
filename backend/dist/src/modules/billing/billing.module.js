"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const realtime_module_1 = require("../realtime/realtime.module");
const billing_access_service_1 = require("./billing-access.service");
const billing_audit_service_1 = require("./billing-audit.service");
const billing_controller_1 = require("./billing.controller");
const billing_dashboard_service_1 = require("./billing-dashboard.service");
const billing_invoice_overdue_processor_service_1 = require("./billing-invoice-overdue-processor.service");
const billing_preview_service_1 = require("./billing-preview.service");
const billing_cycle_processor_service_1 = require("./billing-cycle-processor.service");
const billing_expiry_reminder_service_1 = require("./billing-expiry-reminder.service");
const billing_notifications_service_1 = require("./billing-notifications.service");
const billing_cycles_service_1 = require("./billing-cycles.service");
const billing_invoice_calculation_service_1 = require("./billing-invoice-calculation.service");
const billing_invoices_service_1 = require("./billing-invoices.service");
const billing_plans_service_1 = require("./billing-plans.service");
const billing_usage_processor_service_1 = require("./billing-usage-processor.service");
const billing_usage_service_1 = require("./billing-usage.service");
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, realtime_module_1.RealtimeModule],
        controllers: [billing_controller_1.BillingController],
        providers: [
            billing_audit_service_1.BillingAuditService,
            billing_access_service_1.BillingAccessService,
            billing_access_service_1.BillingVolumeCapacityService,
            billing_preview_service_1.BillingPreviewService,
            billing_invoice_overdue_processor_service_1.BillingInvoiceOverdueProcessorService,
            billing_plans_service_1.BillingPlansService,
            billing_cycles_service_1.BillingCyclesService,
            billing_invoices_service_1.BillingInvoicesService,
            billing_invoice_calculation_service_1.BillingInvoiceCalculationService,
            billing_usage_service_1.BillingUsageService,
            billing_usage_processor_service_1.BillingUsageProcessorService,
            billing_cycle_processor_service_1.BillingCycleProcessorService,
            billing_dashboard_service_1.BillingDashboardService,
            billing_notifications_service_1.BillingNotificationsService,
            billing_expiry_reminder_service_1.BillingExpiryReminderService,
        ],
        exports: [
            billing_access_service_1.BillingAccessService,
            billing_access_service_1.BillingVolumeCapacityService,
            billing_invoice_calculation_service_1.BillingInvoiceCalculationService,
            billing_plans_service_1.BillingPlansService,
            billing_cycles_service_1.BillingCyclesService,
            billing_invoices_service_1.BillingInvoicesService,
            billing_usage_service_1.BillingUsageService,
        ],
    })
], BillingModule);
//# sourceMappingURL=billing.module.js.map