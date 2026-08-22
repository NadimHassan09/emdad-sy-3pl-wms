import { SetMetadata } from '@nestjs/common';
import { ApiCredentialScope } from '@prisma/client';

export const API_SCOPE_KEY = 'apiCredentialScope';

export const RequireApiScope = (scope: ApiCredentialScope) =>
  SetMetadata(API_SCOPE_KEY, scope);
