import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { UserActivityService } from '../user-activity.service';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Internal WMS tokens use `internal`; client portal uses `client` (rejected here). */
  typ?: 'internal' | 'client';
}

const UUID_HEADER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function companyScopeFromRequest(req: Request): string | null {
  const raw = req.headers['x-company-id'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string' || !UUID_HEADER_RE.test(v.trim())) return null;
  return v.trim();
}

const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];

function fromCookie(req: Request): string | null {
  const c = req?.cookies?.access_token;
  return typeof c === 'string' && c.length > 0 ? c : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly userActivity: UserActivityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-only-change-in-production',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtAccessPayload): Promise<AuthPrincipal> {
    if (payload.typ === 'client') {
      throw new UnauthorizedException('Use the internal WMS app with an internal account.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true, companyId: true, email: true },
    });
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
    if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
      throw new ForbiddenException('Client accounts are not permitted to use this application.');
    }
    this.userActivity.touch(user.id);
    return {
      id: user.id,
      role: user.role as AuthPrincipal['role'],
      /** Request-scoped tenant (optional). System users always have `users.company_id` null. */
      companyId: companyScopeFromRequest(req),
      email: user.email,
    };
  }
}
