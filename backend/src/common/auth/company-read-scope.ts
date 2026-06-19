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

/**
 * Master-data catalog lists (products, etc.): explicit `companyId` filters;
 * global admins with no filter see all clients (ignore active X-Company-Id).
 */
export function readCompanyIdCatalogFilter(
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  queryCompanyId?: string,
): string | undefined {
  const explicit = queryCompanyId?.trim();
  if (explicit) {
    companyAccess.assertCompanyAccess(user, explicit);
    return explicit;
  }
  if (user.tenantScope === 'all') {
    return undefined;
  }
  return companyAccess.requireReadTenantScope(user);
}

/** Requires active tenant or explicit `companyId` — prevents cross-tenant list leaks for global admins. */
export function readCompanyIdFilterRequired(
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  queryCompanyId?: string,
): string {
  return companyAccess.requireReadTenantScope(user, queryCompanyId);
}
