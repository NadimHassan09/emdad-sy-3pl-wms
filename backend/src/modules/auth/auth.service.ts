import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import type { Response } from 'express';

import { AuthGroup, userRoleToAuthGroup } from '../../common/auth/auth-groups';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PasswordService } from '../../common/crypto/password.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import type { JwtAccessPayload } from './strategies/jwt.strategy';

const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, res?: Response) {
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
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
      throw new ForbiddenException('Client accounts cannot access this system.');
    }

    const valid = await this.password.verify(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const now = new Date();
    const loginData: { lastLoginAt: Date; lastActivityAt: Date; passwordHash?: string } = {
      lastLoginAt: now,
      lastActivityAt: now,
    };
    if (this.password.isLegacyScrypt(user.passwordHash)) {
      loginData.passwordHash = await this.password.hash(dto.password);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: loginData,
    });

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '8h';
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'internal',
    };
    const maxAgeMs = this.expiresInToMs(expiresIn);
    const access_token = await this.jwt.signAsync(payload, {
      expiresIn: Math.max(60, Math.floor(maxAgeMs / 1000)),
    });

    if (res) {
      res.cookie('access_token', access_token, {
        httpOnly: true,
        secure: this.config.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: maxAgeMs,
        path: '/',
      });
    }

    return {
      access_token,
      token_type: 'Bearer' as const,
      expires_in: Math.floor(maxAgeMs / 1000),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        authGroup: userRoleToAuthGroup(user.role),
      },
    };
  }

  getProfile(user: AuthPrincipal) {
    return {
      id: user.id,
      email: user.email ?? null,
      role: user.role,
      authGroup: userRoleToAuthGroup(user.role),
      tenantCompanyId: user.companyId,
    };
  }

  /** Parses values like `3600`, `3600s`, `15m`, `8h`, `7d` (fallback 8h). */
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
