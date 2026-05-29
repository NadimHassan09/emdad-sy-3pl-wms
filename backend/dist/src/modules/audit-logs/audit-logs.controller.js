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
exports.AuditLogsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const roles_guard_1 = require("../../common/auth/roles.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const audit_logs_service_1 = require("./audit-logs.service");
const export_audit_logs_query_dto_1 = require("./dto/export-audit-logs-query.dto");
const list_audit_logs_query_dto_1 = require("./dto/list-audit-logs-query.dto");
let AuditLogsController = class AuditLogsController {
    auditLogs;
    constructor(auditLogs) {
        this.auditLogs = auditLogs;
    }
    getPolicy() {
        return this.auditLogs.getPolicy();
    }
    async export(user, query, res) {
        const result = await this.auditLogs.export(user, query);
        res.setHeader('Content-Type', result.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('X-Export-Row-Count', String(result.rowCount));
        res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
        return result.body;
    }
    getArchivalCandidates(user) {
        return this.auditLogs.getArchivalCandidates(user);
    }
    list(user, query) {
        return this.auditLogs.list(user, query);
    }
    findOne(user, id) {
        return this.auditLogs.findById(user, id);
    }
};
exports.AuditLogsController = AuditLogsController;
__decorate([
    (0, common_1.Get)('policy'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuditLogsController.prototype, "getPolicy", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, export_audit_logs_query_dto_1.ExportAuditLogsQueryDto, Object]),
    __metadata("design:returntype", Promise)
], AuditLogsController.prototype, "export", null);
__decorate([
    (0, common_1.Get)('archival-candidates'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuditLogsController.prototype, "getArchivalCandidates", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_audit_logs_query_dto_1.ListAuditLogsQueryDto]),
    __metadata("design:returntype", void 0)
], AuditLogsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AuditLogsController.prototype, "findOne", null);
exports.AuditLogsController = AuditLogsController = __decorate([
    (0, common_1.Controller)('audit-logs'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.ADMIN),
    __metadata("design:paramtypes", [audit_logs_service_1.AuditLogsService])
], AuditLogsController);
//# sourceMappingURL=audit-logs.controller.js.map