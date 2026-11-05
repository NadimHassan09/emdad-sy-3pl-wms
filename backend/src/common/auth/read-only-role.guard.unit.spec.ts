import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ReadOnlyRoleGuard } from './read-only-role.guard';

function ctx(role: string, method: string, url: string): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user: { role }, method, url }) }),
  } as unknown as ExecutionContext;
}

describe('ReadOnlyRoleGuard', () => {
  const guard = new ReadOnlyRoleGuard(new Reflector());

  it('lets a viewer read', () => {
    expect(guard.canActivate(ctx('viewer', 'GET', '/api/orders'))).toBe(true);
  });

  it('refuses a viewer on every write method', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() => guard.canActivate(ctx('viewer', method, '/api/orders'))).toThrow(ForbiddenException);
    }
  });

  it('lets a viewer sign out and refresh', () => {
    expect(guard.canActivate(ctx('viewer', 'POST', '/api/auth/logout'))).toBe(true);
    expect(guard.canActivate(ctx('viewer', 'POST', '/api/auth/refresh'))).toBe(true);
  });

  it('does not affect other roles', () => {
    expect(guard.canActivate(ctx('wh_manager', 'POST', '/api/orders'))).toBe(true);
  });
});
