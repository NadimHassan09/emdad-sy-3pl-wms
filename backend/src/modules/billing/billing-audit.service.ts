import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';

export const BILLING_AUDIT_ACTIONS = {
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
} as const;

@Injectable()
export class BillingAuditService {
  constructor(private readonly audit: AuditLogService) {}

  fromUser(
    user: AuthPrincipal,
    input: {
      action: string;
      resourceType: string;
      resourceId: string;
      companyId?: string | null;
      previousState?: unknown;
      newState?: unknown;
    },
  ): Promise<void> {
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

  system(input: {
    action: string;
    resourceType: string;
    resourceId: string;
    companyId?: string | null;
    previousState?: unknown;
    newState?: unknown;
  }): Promise<void> {
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
}
