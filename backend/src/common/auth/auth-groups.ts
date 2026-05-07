import { UserRole } from '@prisma/client';

/** UI / coarse RBAC layer on top of Prisma `UserRole`. */
export enum AuthGroup {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
}

export function userRoleToAuthGroup(role: UserRole): AuthGroup {
  if (role === UserRole.wh_operator) return AuthGroup.OPERATOR;
  /** super_admin, wh_manager, finance → ADMIN */
  return AuthGroup.ADMIN;
}
