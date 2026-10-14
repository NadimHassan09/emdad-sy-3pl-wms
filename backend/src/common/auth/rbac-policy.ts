import { UserRole } from '@prisma/client';

import { AuthGroup, userRoleToAuthGroup } from './auth-groups';

/**
 * Central RBAC policy (Phase 6.3).
 *
 * - Authentication: global JwtAuthGuard (deny unauthenticated unless @Public).
 * - Coarse groups: @Roles(AuthGroup) via RolesGuard (opt-in per handler).
 * - Management: InternalAdminGuard — super_admin | wh_manager only.
 * - User hierarchy: actors may only manage strictly lower-ranked roles.
 * - Tenant: CompanyAccessService on company-scoped resources.
 */

export const INTERNAL_ADMIN_ROLES: UserRole[] = [UserRole.super_admin, UserRole.wh_manager];

export const AUTH_GROUP_ADMIN_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.wh_manager,
  UserRole.finance,
];

/** Higher number = more privileged. Peers cannot manage each other. */
export const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.super_admin]: 100,
  [UserRole.wh_manager]: 80,
  [UserRole.finance]: 60,
  [UserRole.wh_operator]: 40,
  [UserRole.client_admin]: 30,
  [UserRole.client_staff]: 20,
};

export function isInternalAdminRole(role: string): boolean {
  return role === UserRole.super_admin || role === UserRole.wh_manager;
}

export function roleRank(role: string): number {
  if (role in ROLE_RANK) {
    return ROLE_RANK[role as UserRole];
  }
  return 0;
}

/** True when actor may delete / suspend / edit an existing account of this role. */
export function canManageTargetRole(actorRole: string, targetRole: string): boolean {
  return roleRank(actorRole) > roleRank(targetRole);
}

/**
 * True when actor may create a user with this role.
 * Strictly lower ranks only — except super_admin may also create another super_admin.
 */
export function canCreateTargetRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === UserRole.super_admin && targetRole === UserRole.super_admin) {
    return true;
  }
  return canManageTargetRole(actorRole, targetRole);
}

/** Only super_admin may edit existing user accounts (profile, role, status via edit form). */
export function canEditExistingUsers(actorRole: string): boolean {
  return actorRole === UserRole.super_admin;
}

/** Only super_admin may set / reset passwords on other accounts. */
export function canSetOtherUserPassword(actorRole: string): boolean {
  return actorRole === UserRole.super_admin;
}

export function roleToAuthGroup(role: UserRole): AuthGroup {
  return userRoleToAuthGroup(role);
}

/** Message for list endpoints that require an active tenant in global (all-clients) mode. */
export const TENANT_SCOPE_REQUIRED_MESSAGE =
  'Select a client tenant (X-Company-Id header or companyId query parameter) to access tenant-scoped data.';
