import { UserRole } from '@prisma/client';

import {
  canCreateTargetRole,
  canEditExistingUsers,
  canManageTargetRole,
  canSetOtherUserPassword,
} from './rbac-policy';

describe('RBAC user hierarchy', () => {
  it('prevents lower roles from managing higher or equal roles', () => {
    expect(canManageTargetRole(UserRole.wh_operator, UserRole.wh_manager)).toBe(false);
    expect(canManageTargetRole(UserRole.wh_manager, UserRole.super_admin)).toBe(false);
    expect(canManageTargetRole(UserRole.wh_manager, UserRole.wh_manager)).toBe(false);
    expect(canManageTargetRole(UserRole.super_admin, UserRole.super_admin)).toBe(false);
  });

  it('allows higher roles to manage strictly lower roles', () => {
    expect(canManageTargetRole(UserRole.super_admin, UserRole.wh_manager)).toBe(true);
    expect(canManageTargetRole(UserRole.wh_manager, UserRole.wh_operator)).toBe(true);
    expect(canManageTargetRole(UserRole.wh_manager, UserRole.client_admin)).toBe(true);
  });

  it('lets super_admin create another super_admin but not manage peers', () => {
    expect(canCreateTargetRole(UserRole.super_admin, UserRole.super_admin)).toBe(true);
    expect(canCreateTargetRole(UserRole.wh_manager, UserRole.super_admin)).toBe(false);
    expect(canCreateTargetRole(UserRole.wh_manager, UserRole.wh_manager)).toBe(false);
    expect(canCreateTargetRole(UserRole.wh_manager, UserRole.wh_operator)).toBe(true);
  });

  it('restricts edit-existing and password reset to super_admin', () => {
    expect(canEditExistingUsers(UserRole.super_admin)).toBe(true);
    expect(canEditExistingUsers(UserRole.wh_manager)).toBe(false);
    expect(canSetOtherUserPassword(UserRole.super_admin)).toBe(true);
    expect(canSetOtherUserPassword(UserRole.wh_manager)).toBe(false);
  });
});
