import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CompanyStatus, UserRole, UserStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PasswordService } from '../../../common/crypto/password.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LoginBruteForceService } from '../../../common/security/login-brute-force.service';
import { getClientIp } from '../../../common/security/request-ip.util';
import { ClientLoginDto } from './dto/client-login.dto';
import type { JwtClientAccessPayload } from './strategies/jwt-client.strategy';

const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly loginBruteForce: LoginBruteForceService,
  ) {}

  async login(dto: ClientLoginDto, req?: Request, res?: Response) {
    const ip = getClientIp(req);
    this.loginBruteForce.assertAllowed('client', ip);
    const attemptCtx = {
      ipAddress: ip,
      email: dto.email,
      userAgent: req?.headers['user-agent'] ?? null,
    };

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        companyId: true,
        fullName: true,
      },
    });

    if (!user || user.status !== UserStatus.active) {
      this.loginBruteForce.recordFailure('client', attemptCtx);
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.companyId === null || !CLIENT_ROLES.includes(user.role)) {
      this.loginBruteForce.recordFailure('client', attemptCtx);
      throw new ForbiddenException(
        'This portal is only for client users. Internal staff must use the WMS application.',
      );
    }

    const valid = await this.password.verify(dto.password, user.passwordHash);
    if (!valid) {
      this.loginBruteForce.recordFailure('client', attemptCtx);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { status: true, name: true },
    });
    if (!company || company.status !== CompanyStatus.active) {
      throw new ForbiddenException(
        'Your account is currently inactive. Please contact support for assistance.',
      );
    }

    if (this.password.isLegacyScrypt(user.passwordHash)) {
      const passwordHash = await this.password.hash(dto.password);
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    }

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now, lastActivityAt: now },
    });

    const expiresIn = this.config.get<string>('CLIENT_JWT_EXPIRES_IN') ?? this.config.get<string>('JWT_EXPIRES_IN') ?? '8h';
    const maxAgeMs = this.expiresInToMs(expiresIn);
    const payload: JwtClientAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      typ: 'client',
    };
    const access_token = await this.jwt.signAsync(payload, {
      expiresIn: Math.max(60, Math.floor(maxAgeMs / 1000)),
    });

    if (res) {
      res.cookie('client_access_token', access_token, {
        httpOnly: true,
        secure: this.config.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: maxAgeMs,
        path: '/',
      });
    }

    this.loginBruteForce.recordSuccess('client', ip);

    return {
      access_token,
      token_type: 'Bearer' as const,
      expires_in: Math.floor(maxAgeMs / 1000),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: company?.name ?? null,
      },
    };
  }

  async getMe(user: ClientPrincipal): Promise<ClientPrincipal> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        companyId: true,
        company: { select: { name: true } },
      },
    });
    if (!row || row.companyId === null || !CLIENT_ROLES.includes(row.role)) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      role: row.role as ClientPrincipal['role'],
      companyId: row.companyId,
      companyName: row.company?.name ?? '',
    };
  }

  private expiresInToMs(expiresIn: string): number {
    const t = expiresIn.trim().toLowerCase();
    const m = /^(\d+)(s|m|h|d)?$/.exec(t);
    if (!m) return 8 * 60 * 60 * 1000;
    const n = parseInt(m[1], 10);
    const u = m[2] ?? 's';
    const mult = u === 'd' ? 86400e3 : u === 'h' ? 3600e3 : u === 'm' ? 60e3 : 1000;
    return n * mult;
  }
}
