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
exports.SlaAuditService = exports.SLA_AUDIT_ACTIONS = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
exports.SLA_AUDIT_ACTIONS = {
    TASK_ESCALATED: 'sla.task.escalated',
    TASK_BREACHED: 'sla.task.breached',
};
let SlaAuditService = class SlaAuditService {
    audit;
    constructor(audit) {
        this.audit = audit;
    }
    escalated(input) {
        return this.audit.logBestEffort({
            actorId: null,
            actorEmail: 'sla-monitor@system.local',
            actorName: 'SLA Monitor',
            actorRole: 'system',
            companyId: input.companyId,
            action: exports.SLA_AUDIT_ACTIONS.TASK_ESCALATED,
            resourceType: 'warehouse_task',
            resourceId: input.taskId,
            previousState: {
                escalationLevel: input.previousLevel,
            },
            newState: {
                escalationLevel: input.escalationLevel,
                slaMinutes: input.slaMinutes,
                breachedAt: input.breachedAt.toISOString(),
                notifiedManagers: input.notifiedManagers,
                workflowInstanceId: input.workflowInstanceId ?? null,
            },
        });
    }
};
exports.SlaAuditService = SlaAuditService;
exports.SlaAuditService = SlaAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], SlaAuditService);
//# sourceMappingURL=sla-audit.service.js.map