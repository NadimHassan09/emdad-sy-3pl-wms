import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip JWT for this route (e.g. `POST /auth/login`). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
