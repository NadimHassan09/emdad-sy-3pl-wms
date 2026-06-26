"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertReportAccess = assertReportAccess;
exports.canAccessReport = canAccessReport;
const common_1 = require("@nestjs/common");
const report_registry_config_1 = require("./report-registry.config");
function assertReportAccess(user, reportId) {
    const def = (0, report_registry_config_1.getReportDefinition)(reportId);
    if (!def) {
        throw new common_1.NotFoundException(`Unknown report: ${reportId}`);
    }
    if (!def.allowedRoles.includes(user.role)) {
        throw new common_1.ForbiddenException(`Your role (${user.role}) is not permitted to access the "${def.title}" report.`);
    }
}
function canAccessReport(role, reportId) {
    const def = (0, report_registry_config_1.getReportDefinition)(reportId);
    if (!def)
        return false;
    return def.allowedRoles.includes(role);
}
//# sourceMappingURL=report-permissions.util.js.map