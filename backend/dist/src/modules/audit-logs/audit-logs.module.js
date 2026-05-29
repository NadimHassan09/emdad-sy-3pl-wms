"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const audit_log_policy_config_1 = require("./audit-log-policy.config");
const audit_logs_controller_1 = require("./audit-logs.controller");
const audit_logs_service_1 = require("./audit-logs.service");
let AuditLogsModule = class AuditLogsModule {
};
exports.AuditLogsModule = AuditLogsModule;
exports.AuditLogsModule = AuditLogsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [audit_logs_controller_1.AuditLogsController],
        providers: [audit_logs_service_1.AuditLogsService, audit_log_policy_config_1.AuditLogPolicyConfig],
    })
], AuditLogsModule);
//# sourceMappingURL=audit-logs.module.js.map