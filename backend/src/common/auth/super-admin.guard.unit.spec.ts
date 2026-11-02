import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { SuperAdminGuard } from './super-admin.guard';

function ctxFor(role?: UserRole) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { id: 'u1', role, email: 'u@example.com' } : undefined,
      }),
    }),
  } as never;
}

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('allows super_admin', () => {
    expect(guard.canActivate(ctxFor(UserRole.super_admin))).toBe(true);
  });

  it('rejects warehouse managers from changing super-admin-only settings', () => {
    expect(() => guard.canActivate(ctxFor(UserRole.wh_manager))).toThrow(ForbiddenException);
  });
});
