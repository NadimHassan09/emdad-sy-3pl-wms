import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';

export const ClientUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClientPrincipal => {
  const req = ctx.switchToHttp().getRequest<{ user?: ClientPrincipal }>();
  return req.user as ClientPrincipal;
});
