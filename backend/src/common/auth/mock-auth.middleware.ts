import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

import { AuthPrincipal } from './current-user.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

/**
 * Mock auth — Phase 1 stand-in for the real JwtAuthGuard (final_blueprint.md §1.4).
 * The frontend always sends `X-User-Id` and `X-Company-Id` headers; this
 * middleware reads them, falls back to `MOCK_USER_ID` / `MOCK_COMPANY_ID`
 * from .env, and attaches `req.user`. Role is hardcoded to `wh_manager` so
 * Phase 1 endpoints have unrestricted access.
 *
 * Phase 2 swaps this for JWT validation + RLS context middleware. The
 * AuthPrincipal contract (@CurrentUser) stays identical.
 */
@Injectable()
export class MockAuthMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const headerUserId = req.header('X-User-Id');
    const headerCompanyId = req.header('X-Company-Id');

    const userId = isUuid(headerUserId) ? headerUserId : this.config.get<string>('MOCK_USER_ID');
    const companyIdRaw = isUuid(headerCompanyId)
      ? headerCompanyId
      : this.config.get<string>('MOCK_COMPANY_ID');

    if (!userId || !isUuid(userId)) {
      // Don't block — health checks etc. should still respond. Endpoints that
      // need a user will assert it themselves via @CurrentUser().
      return next();
    }

    const principal: AuthPrincipal = {
      id: userId,
      companyId: isUuid(companyIdRaw) ? (companyIdRaw as string) : null,
      role: 'wh_manager',
    };
    req.user = principal;
    next();
  }
}
