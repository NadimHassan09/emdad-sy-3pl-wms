import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from './current-user.types';

/** Restricts access to super_admin only (backup mutations, download, etc.). */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const user = req.user;
    if (!user) return false;
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException('This action requires super admin access.');
    }
    return true;
  }
}
