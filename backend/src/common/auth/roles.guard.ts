import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { AuthGroup, userRoleToAuthGroup } from './auth-groups';
import { AuthPrincipal } from './current-user.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AuthGroup[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const user = req.user;
    if (!user) return false;

    const group = userRoleToAuthGroup(user.role as UserRole);
    return required.includes(group);
  }
}
