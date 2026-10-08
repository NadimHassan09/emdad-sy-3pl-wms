import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from './current-user.types';
import {
  canCreateTargetRole,
  canEditExistingUsers,
  canManageTargetRole,
  canSetOtherUserPassword,
  isInternalAdminRole,
} from './rbac-policy';

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

export function assertCanManageTargetRole(
  actor: AuthPrincipal,
  targetRole: string,
  message?: string,
): void {
  assertInternalAdmin(actor);
  if (!canManageTargetRole(actor.role, targetRole)) {
    throw new ForbiddenException(
      message ?? 'You cannot manage an account with an equal or higher role.',
    );
  }
}

export function assertCanCreateTargetRole(
  actor: AuthPrincipal,
  targetRole: string,
  message?: string,
): void {
  assertInternalAdmin(actor);
  if (!canCreateTargetRole(actor.role, targetRole)) {
    throw new ForbiddenException(
      message ?? 'You cannot create an account with an equal or higher role.',
    );
  }
}

export function assertCanEditExistingUser(actor: AuthPrincipal): void {
  assertInternalAdmin(actor);
  if (!canEditExistingUsers(actor.role)) {
    throw new ForbiddenException(
      'Only a super admin can edit an existing user account. Admins may create users only.',
    );
  }
}

export function assertCanSetOtherUserPassword(actor: AuthPrincipal): void {
  assertInternalAdmin(actor);
  if (!canSetOtherUserPassword(actor.role)) {
    throw new ForbiddenException('Only a super admin can change another user’s password.');
  }
}
