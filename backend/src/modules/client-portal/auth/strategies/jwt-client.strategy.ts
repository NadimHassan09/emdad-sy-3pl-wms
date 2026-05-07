import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ClientPrincipal } from '../../../../common/auth/client-principal.types';
import { PrismaService } from '../../../../common/prisma/prisma.service';

export interface JwtClientAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string;
  typ: 'client';
}

const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];

function fromClientCookie(req: Request): string | null {
  const c = req?.cookies?.client_access_token;
  return typeof c === 'string' && c.length > 0 ? c : null;
}

@Injectable()
export class JwtClientStrategy extends PassportStrategy(Strategy, 'jwt-client') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretOrKey =
      config.get<string>('CLIENT_JWT_SECRET') ??
      config.get<string>('JWT_SECRET') ??
      'dev-only-change-in-production';
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromClientCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: JwtClientAccessPayload): Promise<ClientPrincipal> {
    if (payload.typ !== 'client') {
      throw new UnauthorizedException('Invalid client session.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        companyId: true,
        company: { select: { name: true } },
      },
    });
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
    if (user.companyId === null || !CLIENT_ROLES.includes(user.role)) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as ClientPrincipal['role'],
      companyId: user.companyId,
      companyName: user.company?.name ?? '',
    };
  }
}
