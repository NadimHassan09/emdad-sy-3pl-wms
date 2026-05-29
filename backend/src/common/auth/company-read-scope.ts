import { CompanyAccessService } from '../company-access/company-access.service';
import { AuthPrincipal } from './current-user.types';

/** List/read filter via centralized tenant validation. */
export function readCompanyIdFilter(
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  queryCompanyId?: string,
): string | undefined {
  return companyAccess.getReadFilterCompanyId(user, queryCompanyId);
}

/** Requires active tenant or explicit `companyId` — prevents cross-tenant list leaks for global admins. */
export function readCompanyIdFilterRequired(
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  queryCompanyId?: string,
): string {
  return companyAccess.requireReadTenantScope(user, queryCompanyId);
}
