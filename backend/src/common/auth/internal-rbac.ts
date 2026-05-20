import { UserRole } from '@prisma/client';

import { AuthPrincipal } from './current-user.types';

export function isWarehouseOperator(role: string): boolean {
  return role === UserRole.wh_operator;
}

export function isInternalAdmin(role: string): boolean {
  return role === UserRole.super_admin || role === UserRole.wh_manager;
}

export function canManageWarehouseUsers(role: string): boolean {
  return isInternalAdmin(role);
}
