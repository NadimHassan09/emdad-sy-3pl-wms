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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportExportService = void 0;
const common_1 = require("@nestjs/common");
const reports_export_util_1 = require("../reports-export.util");
const reports_policy_config_1 = require("../reports-policy.config");
const report_registry_config_1 = require("./report-registry.config");
let ReportExportService = class ReportExportService {
    policy;
    constructor(policy) {
        this.policy = policy;
    }
    async buildExport(reportId, query, format, fetchPage) {
        const def = (0, report_registry_config_1.getReportDefinition)(reportId);
        const columns = def?.exportColumns ?? [];
        const stamp = new Date().toISOString().slice(0, 10);
        const baseName = def?.exportFileName ?? reportId;
        const rows = [];
        let offset = 0;
        const pageSize = 500;
        let total = 0;
        let truncated = false;
        while (rows.length < this.policy.exportMaxRows) {
            const page = await fetchPage(offset, Math.min(pageSize, this.policy.exportMaxRows - rows.length));
            total = page.total;
            rows.push(...page.items);
            offset += page.items.length;
            if (page.items.length === 0 || rows.length >= total)
                break;
            if (rows.length >= this.policy.exportMaxRows) {
                truncated = total > this.policy.exportMaxRows;
                break;
            }
        }
        const body = format === 'xls' ? (0, reports_export_util_1.reportRowsToXls)(columns, rows) : (0, reports_export_util_1.reportRowsToCsv)(columns, rows);
        return {
            format,
            rowCount: rows.length,
            truncated,
            body,
            filename: format === 'xls' ? `${baseName}-${stamp}.xls` : `${baseName}-${stamp}.csv`,
        };
    }
};
exports.ReportExportService = ReportExportService;
exports.ReportExportService = ReportExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reports_policy_config_1.ReportsPolicyConfig])
], ReportExportService);
//# sourceMappingURL=report-export.service.js.map