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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const run_report_query_dto_1 = require("./dto/run-report-query.dto");
const reports_service_1 = require("./reports.service");
let ReportsController = class ReportsController {
    reports;
    constructor(reports) {
        this.reports = reports;
    }
    getPolicy() {
        return this.reports.getPolicy();
    }
    kpis(user, reportId, query) {
        return this.reports.kpis(user, reportId, query);
    }
    aggregate(user, reportId, query) {
        return this.reports.aggregate(user, reportId, query);
    }
    async export(user, reportId, query, res) {
        const result = await this.reports.export(user, reportId, query);
        res.setHeader('Content-Type', result.format === 'xls'
            ? 'application/vnd.ms-excel; charset=utf-8'
            : 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Export-Row-Count', String(result.rowCount));
        res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
        return result.body;
    }
    run(user, reportId, query) {
        return this.reports.run(user, reportId, query);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('policy'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getPolicy", null);
__decorate([
    (0, common_1.Get)(':reportId/kpis'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('reportId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, run_report_query_dto_1.RunReportQueryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "kpis", null);
__decorate([
    (0, common_1.Get)(':reportId/aggregate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('reportId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, run_report_query_dto_1.AggregateReportQueryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "aggregate", null);
__decorate([
    (0, common_1.Get)(':reportId/export'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('reportId')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, run_report_query_dto_1.ExportReportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "export", null);
__decorate([
    (0, common_1.Get)(':reportId/run'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('reportId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, run_report_query_dto_1.RunReportQueryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "run", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('reports'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.ADMIN),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map