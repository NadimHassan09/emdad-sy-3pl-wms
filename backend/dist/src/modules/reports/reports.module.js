"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const companies_module_1 = require("../companies/companies.module");
const dashboard_module_1 = require("../dashboard/dashboard.module");
const inbound_module_1 = require("../inbound/inbound.module");
const inventory_module_1 = require("../inventory/inventory.module");
const outbound_module_1 = require("../outbound/outbound.module");
const report_export_service_1 = require("./framework/report-export.service");
const reports_framework_service_1 = require("./framework/reports-framework.service");
const reports_cache_service_1 = require("./reports-cache.service");
const reports_controller_1 = require("./reports.controller");
const reports_policy_config_1 = require("./reports-policy.config");
const finance_reports_runner_1 = require("./finance-reports.runner");
const inventory_intelligence_reports_runner_1 = require("./inventory-intelligence-reports.runner");
const operational_reports_runner_1 = require("./operational-reports.runner");
const reports_service_1 = require("./reports.service");
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            inventory_module_1.InventoryModule,
            inbound_module_1.InboundModule,
            outbound_module_1.OutboundModule,
            dashboard_module_1.DashboardModule,
            companies_module_1.CompaniesModule,
        ],
        controllers: [reports_controller_1.ReportsController],
        providers: [
            reports_service_1.ReportsService,
            reports_cache_service_1.ReportsCacheService,
            reports_policy_config_1.ReportsPolicyConfig,
            reports_framework_service_1.ReportsFrameworkService,
            report_export_service_1.ReportExportService,
            operational_reports_runner_1.OperationalReportsRunner,
            inventory_intelligence_reports_runner_1.InventoryIntelligenceReportsRunner,
            finance_reports_runner_1.FinanceReportsRunner,
        ],
        exports: [reports_service_1.ReportsService, reports_framework_service_1.ReportsFrameworkService],
    })
], ReportsModule);
//# sourceMappingURL=reports.module.js.map