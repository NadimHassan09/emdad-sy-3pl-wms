import type { TenantScopeMode } from '../company-access/company-access.types';

/**
 * Authenticated request principal (`JwtAuthGuard` / `JwtStrategy`).
 *
 * `companyId` is the **server-validated** active tenant for this request (never a raw header).
 * `authorizedCompanyIds` + `tenantScope` come from `CompanyAccessService` memberships.
 */
export interface AuthPrincipal {
  id: string;
  companyId: string | null;
  role: 'super_admin' | 'wh_manager' | 'wh_operator' | 'finance' | 'client_admin' | 'client_staff';
  /** Present when resolved from JWT / DB. */
  email?: string;
  tenantScope: TenantScopeMode;
  authorizedCompanyIds: string[];
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPrincipal;
  }
}
