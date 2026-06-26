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
exports.BillingAuditService = exports.BILLING_AUDIT_ACTIONS = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
exports.BILLING_AUDIT_ACTIONS = {
    PLAN_CREATED: 'billing.plan.created',
    PLAN_UPDATED: 'billing.plan.updated',
    PLAN_RENEWED: 'billing.plan.renewed',
    PLAN_SUSPENDED: 'billing.plan.suspended',
    INVOICE_GENERATED: 'billing.invoice.generated',
    INVOICE_OVERDUE: 'billing.invoice.overdue',
    INVOICE_CANCELLED: 'billing.invoice.cancelled',
    INVOICE_PAID: 'billing.invoice.paid',
    USAGE_CALCULATED: 'billing.usage.calculated',
    CAPACITY_EXCEEDED: 'billing.capacity.exceeded',
};
let BillingAuditService = class BillingAuditService {
    audit;
    constructor(audit) {
        this.audit = audit;
    }
    fromUser(user, input) {
        const email = user.email ?? 'unknown@local';
        return this.audit.logBestEffort({
            actorId: user.id,
            actorEmail: email,
            actorName: email,
            actorRole: user.role,
            companyId: input.companyId ?? null,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            previousState: input.previousState,
            newState: input.newState,
        });
    }
    system(input) {
        return this.audit.logBestEffort({
            actorId: null,
            actorEmail: 'billing-engine@system.local',
            actorName: 'Billing Engine',
            actorRole: 'system',
            companyId: input.companyId ?? null,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            previousState: input.previousState,
            newState: input.newState,
        });
    }
};
exports.BillingAuditService = BillingAuditService;
exports.BillingAuditService = BillingAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], BillingAuditService);
//# sourceMappingURL=billing-audit.service.js.map