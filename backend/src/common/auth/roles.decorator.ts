import { SetMetadata } from '@nestjs/common';

import { AuthGroup } from './auth-groups';

export const ROLES_KEY = 'roles';

/** Require at least one of the given coarse auth groups (ADMIN / OPERATOR). */
export const Roles = (...roles: AuthGroup[]) => SetMetadata(ROLES_KEY, roles);
