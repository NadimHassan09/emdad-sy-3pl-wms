import type { AuthPrincipal } from '../auth/current-user.types';

/** How broadly an internal user may access client tenants. */
export type TenantScopeMode = 'all' | 'restricted';

/**
 * Server-resolved tenant context for the current request.
 * Populated in `JwtStrategy` — never trust raw headers or DTO company ids alone.
 */
export interface AuthorizedCompanyScope {
  mode: TenantScopeMode;
  /** Active tenant for this request (`null` = all-clients list mode for global roles). */
  activeCompanyId: string | null;
  /** Allowed company ids when `mode === 'restricted'`. */
  companyIds: string[];
}

export interface OwnableResource {
  companyId: string;
}

export type AuthPrincipalWithTenant = AuthPrincipal & {
  tenantScope: TenantScopeMode;
  authorizedCompanyIds: string[];
};
