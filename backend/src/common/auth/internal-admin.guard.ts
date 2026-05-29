import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AuthPrincipal } from './current-user.types';
import { isInternalAdminRole } from './rbac-policy';

/**
 * Restricts access to warehouse management roles (super_admin, wh_manager).
 * Finance and operators are denied even when they map to AuthGroup.ADMIN.
 */
@Injectable()
export class InternalAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const user = req.user;
    if (!user) return false;
    if (!isInternalAdminRole(user.role)) {
      throw new ForbiddenException('This action requires warehouse manager or super admin access.');
    }
    return true;
  }
}
