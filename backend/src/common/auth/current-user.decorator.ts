import { ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

import { AuthPrincipal } from './current-user.types';

/**
 * Resolves the mock-auth principal attached by MockAuthMiddleware.
 * Throws 401 when neither header nor MOCK_USER_ID env fallback was usable.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new UnauthorizedException(
        'No authenticated user. Set X-User-Id header or MOCK_USER_ID env var.',
      );
    }
    return req.user;
  },
);
