import { UserRole } from '@prisma/client';

import { AuthGroup, userRoleToAuthGroup } from './auth-groups';

/**
 * Central RBAC policy (Phase 6.3).
 *
 * - Authentication: global JwtAuthGuard (deny unauthenticated unless @Public).
 * - Coarse groups: @Roles(AuthGroup) via RolesGuard (opt-in per handler).
 * - Management: InternalAdminGuard — super_admin | wh_manager only.
 * - Tenant: CompanyAccessService on company-scoped resources.
 */

export const INTERNAL_ADMIN_ROLES: UserRole[] = [UserRole.super_admin, UserRole.wh_manager];

export const AUTH_GROUP_ADMIN_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.wh_manager,
  UserRole.finance,
];

export function isInternalAdminRole(role: string): boolean {
  return role === UserRole.super_admin || role === UserRole.wh_manager;
}

export function roleToAuthGroup(role: UserRole): AuthGroup {
  return userRoleToAuthGroup(role);
}

/** Message for list endpoints that require an active tenant in global (all-clients) mode. */
export const TENANT_SCOPE_REQUIRED_MESSAGE =
  'Select a client tenant (X-Company-Id header or companyId query parameter) to access tenant-scoped data.';
