import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { InternalAdminGuard } from './internal-admin.guard';

function contextFor(role: UserRole | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: role
          ? { id: 'u1', email: 'a@b.c', role, companyId: null, typ: 'internal' }
          : undefined,
      }),
    }),
  } as ExecutionContext;
}

describe('InternalAdminGuard', () => {
  const guard = new InternalAdminGuard();

  it('allows super admin and warehouse manager', () => {
    expect(guard.canActivate(contextFor(UserRole.super_admin))).toBe(true);
    expect(guard.canActivate(contextFor(UserRole.wh_manager))).toBe(true);
  });

  it('rejects worker, finance, and client roles', () => {
    for (const role of [UserRole.wh_operator, UserRole.finance, UserRole.client_admin, UserRole.client_staff]) {
      expect(() => guard.canActivate(contextFor(role))).toThrow(ForbiddenException);
    }
  });
});
