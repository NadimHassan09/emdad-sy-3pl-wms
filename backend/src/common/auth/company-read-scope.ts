import { AuthPrincipal } from './current-user.types';

const INTERNAL_WMS_ROLES = new Set<AuthPrincipal['role']>([
  'super_admin',
  'wh_manager',
  'wh_operator',
  'finance',
]);

/**
 * For list/read APIs with an optional `companyId` query param.
 * Internal WMS users must not fall back to request-scoped `X-Company-Id` (JWT
 * `user.companyId`); otherwise "All clients" in the UI still scopes to one tenant.
 */
export function readCompanyIdFilter(user: AuthPrincipal, queryCompanyId?: string): string | undefined {
  const q = queryCompanyId?.trim();
  if (q) return q;
  if (INTERNAL_WMS_ROLES.has(user.role)) return undefined;
  return user.companyId ?? undefined;
}
