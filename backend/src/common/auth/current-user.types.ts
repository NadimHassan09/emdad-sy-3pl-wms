/**
 * Authenticated request principal (`JwtAuthGuard` / `JwtStrategy`).
 *
 * `companyId` is optional **request-scoped** tenant (from `X-Company-Id`), not
 * the user row: internal system users always have `users.company_id` null.
 */
export interface AuthPrincipal {
  id: string;
  companyId: string | null;
  role: 'super_admin' | 'wh_manager' | 'wh_operator' | 'finance' | 'client_admin' | 'client_staff';
  /** Present when resolved from JWT / DB. */
  email?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPrincipal;
  }
}
