import { ForbiddenException } from '@nestjs/common';
import { CompanyStatus } from '@prisma/client';

/** Account statuses that may use the Client Portal (subject to billing read-only). */
export const CLIENT_PORTAL_LOGIN_ALLOWED: CompanyStatus[] = [
  CompanyStatus.active,
  /** Legacy billing lock — treated as Active account + Billed plan until healed. */
  CompanyStatus.restricted,
];

export type ClientPortalAccountStatus = 'active' | 'suspended' | 'inactive';

export type ClientBillingPlanStatus =
  | 'active'
  | 'expiring'
  | 'billed'
  | 'no_plan'
  | 'inactive';

export function mapCompanyToAccountStatus(
  status: CompanyStatus | string,
): ClientPortalAccountStatus {
  if (status === CompanyStatus.active || status === CompanyStatus.restricted) {
    return 'active';
  }
  if (status === CompanyStatus.suspended) {
    return 'suspended';
  }
  return 'inactive';
}

/**
 * Throws if the company account status blocks Client Portal login entirely.
 * Billing expiry must NOT use this path — that is read-only (billed), not lockout.
 */
export function assertClientPortalAccountAccess(status: CompanyStatus | string | null | undefined): void {
  if (!status) {
    throw new ForbiddenException(
      'Your account is currently inactive. Please contact support for assistance.',
    );
  }
  if (status === CompanyStatus.active || status === CompanyStatus.restricted) {
    return;
  }
  if (status === CompanyStatus.suspended) {
    throw new ForbiddenException(
      'Your account is currently suspended. Please contact support.',
    );
  }
  throw new ForbiddenException(
    'Your account is currently inactive. Please contact support for assistance.',
  );
}
