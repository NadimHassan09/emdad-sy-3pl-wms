import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from './current-user.types';
import { isInternalAdminRole } from './rbac-policy';

export function isWarehouseOperator(role: string): boolean {
  return role === UserRole.wh_operator;
}

export function isInternalAdmin(role: string): boolean {
  return isInternalAdminRole(role);
}

export function canManageWarehouseUsers(role: string): boolean {
  return isInternalAdmin(role);
}

export function assertInternalAdmin(actor: AuthPrincipal, message?: string): void {
  if (!isInternalAdmin(actor.role)) {
    throw new ForbiddenException(
      message ?? 'This action requires warehouse manager or super admin access.',
    );
  }
}
