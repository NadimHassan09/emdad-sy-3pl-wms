import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthPrincipal } from './current-user.types';
import { IS_PUBLIC_KEY } from './public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** A viewer may still sign out and refresh the session. */
const ALLOWED_WRITE_PATHS = [/\/auth\/(logout|refresh)$/];

/** Global guard: the `viewer` role can read everything it can see but never change anything. */
@Injectable()
export class ReadOnlyRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<{ user?: AuthPrincipal; method: string; path?: string; url: string }>();
    if (req.user?.role !== 'viewer') return true;
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;
    const path = (req.path ?? req.url).split('?')[0];
    if (ALLOWED_WRITE_PATHS.some((re) => re.test(path))) return true;
    throw new ForbiddenException('This account is read only (viewer) and cannot change data.');
  }
}
