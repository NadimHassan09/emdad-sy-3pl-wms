import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { AuthGroup, userRoleToAuthGroup } from '../../common/auth/auth-groups';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PasswordService } from '../../common/crypto/password.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginBruteForceService } from '../../common/security/login-brute-force.service';
import { getClientIp } from '../../common/security/request-ip.util';
import { RealtimeService } from '../realtime/realtime.service';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionService } from './refresh-session.service';
import type { JwtAccessPayload } from './strategies/jwt.strategy';

const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];
const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';
const DEFAULT_ACCESS_EXPIRES = '15m';
const DEFAULT_REFRESH_EXPIRES = '7d';

type JwtRefreshPayload = {
  sub: string;
  typ: 'internal';
  kind: 'refresh';
  ver: number;
  fid: string;
  jti: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly refreshSessions: RefreshSessionService,
    private readonly realtime: RealtimeService,
    private readonly loginBruteForce: LoginBruteForceService,
  ) {}

  async login(dto: LoginDto, req?: Request, res?: Response) {
    const ip = getClientIp(req);
    this.loginBruteForce.assertAllowed('internal', ip);
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
        tokenVersion: true,
      },
    });

    if (!user || user.status !== UserStatus.active) {
      this.loginBruteForce.recordFailure('internal', attemptCtx);
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
      this.loginBruteForce.recordFailure('internal', attemptCtx);
      throw new ForbiddenException('Client accounts cannot access this system.');
    }

    const valid = await this.password.verify(dto.password, user.passwordHash);
    if (!valid) {
      this.loginBruteForce.recordFailure('internal', attemptCtx);
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
    await this.audit.log(
      this.audit.fromPrincipal(
        { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
        {
          action: 'AUTH_LOGIN_SUCCESS',
          resourceType: 'user',
          resourceId: user.id,
          previousState: { tokenVersion: user.tokenVersion },
          newState: { lastLoginAt: now.toISOString(), lastActivityAt: now.toISOString() },
        },
      ),
    );

    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? DEFAULT_ACCESS_EXPIRES;
    const refreshExpiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? DEFAULT_REFRESH_EXPIRES;
    const accessMaxAgeMs = this.expiresInToMs(accessExpiresIn);
    const refreshMaxAgeMs = this.expiresInToMs(refreshExpiresIn);
    const refreshExpiresAt = new Date(Date.now() + refreshMaxAgeMs);

    const session = await this.refreshSessions.createSession(
      user.id,
      user.tokenVersion,
      refreshExpiresAt,
    );

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'internal',
      ver: user.tokenVersion,
    };
    const access_token = await this.jwt.signAsync(accessPayload, {
      expiresIn: Math.max(60, Math.floor(accessMaxAgeMs / 1000)),
    });
    const refresh_token = await this.signRefreshToken(
      user.id,
      user.tokenVersion,
      session.familyId,
      session.jti,
      refreshMaxAgeMs,
    );

    if (res) {
      this.setAccessCookie(res, access_token, accessMaxAgeMs);
      this.setRefreshCookie(res, refresh_token, refreshMaxAgeMs);
    }

    this.loginBruteForce.recordSuccess('internal', ip);
    this.realtime.emitAuthSessionChanged(user.id, { type: 'login', userId: user.id });

    return {
      access_token,
      token_type: 'Bearer' as const,
      expires_in: Math.floor(accessMaxAgeMs / 1000),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        authGroup: userRoleToAuthGroup(user.role),
      },
    };
  }

  async refresh(req: Request, res?: Response) {
    const rawToken = this.readRefreshToken(req);
    if (!rawToken) throw new UnauthorizedException('Missing refresh token.');

    const payload = await this.verifyRefreshToken(rawToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        companyId: true,
        fullName: true,
        tokenVersion: true,
      },
    });
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
    if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
      throw new ForbiddenException('Client accounts cannot access this system.');
    }
    if (payload.ver !== user.tokenVersion) {
      this.realtime.emitAuthSessionChanged(user.id, {
        type: 'expired',
        userId: user.id,
        reason: 'token_version_mismatch',
      });
      throw new UnauthorizedException('Session has been invalidated. Please log in again.');
    }

    let rotation;
    try {
      rotation = await this.refreshSessions.rotateSession(
        user.id,
        user.tokenVersion,
        payload.fid,
        payload.jti,
      );
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        await this.audit.log(
          this.audit.fromPrincipal(
            { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
            {
              action: 'AUTH_REFRESH_REPLAY_DETECTED',
              resourceType: 'user',
              resourceId: user.id,
              previousState: { familyId: payload.fid, presentedJti: payload.jti },
              newState: { message: err.message },
            },
          ),
        );
        this.realtime.emitAuthSessionChanged(user.id, {
          type: 'forced_logout',
          userId: user.id,
          reason: 'refresh_replay',
        });
      }
      throw err;
    }

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActivityAt: now },
    });
    await this.audit.log(
      this.audit.fromPrincipal(
        { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
        {
          action: rotation.idempotent ? 'AUTH_REFRESH_REPLAY_IDEMPOTENT' : 'AUTH_REFRESH_SUCCESS',
          resourceType: 'user',
          resourceId: user.id,
          previousState: { familyId: payload.fid, jti: payload.jti },
          newState: { familyId: rotation.familyId, jti: rotation.jti, lastActivityAt: now.toISOString() },
        },
      ),
    );

    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? DEFAULT_ACCESS_EXPIRES;
    const refreshExpiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? DEFAULT_REFRESH_EXPIRES;
    const accessMaxAgeMs = this.expiresInToMs(accessExpiresIn);
    const refreshMaxAgeMs = this.expiresInToMs(refreshExpiresIn);

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'internal',
      ver: user.tokenVersion,
    };
    const access_token = await this.jwt.signAsync(accessPayload, {
      expiresIn: Math.max(60, Math.floor(accessMaxAgeMs / 1000)),
    });
    const refresh_token = await this.signRefreshToken(
      user.id,
      user.tokenVersion,
      rotation.familyId,
      rotation.jti,
      refreshMaxAgeMs,
    );

    if (res) {
      this.setAccessCookie(res, access_token, accessMaxAgeMs);
      this.setRefreshCookie(res, refresh_token, refreshMaxAgeMs);
    }

    this.realtime.emitAuthSessionChanged(user.id, { type: 'refresh', userId: user.id });

    return {
      access_token,
      token_type: 'Bearer' as const,
      expires_in: Math.floor(accessMaxAgeMs / 1000),
    };
  }

  async logout(req: Request, res?: Response) {
    const rawRefresh = this.readRefreshToken(req);
    if (rawRefresh) {
      const payload = await this.tryVerifyRefreshToken(rawRefresh);
      if (payload?.sub) {
        const prev = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { tokenVersion: true, email: true, role: true, companyId: true },
        });
        const nextVersion = await this.refreshSessions.invalidateUserSessions(payload.sub);
        if (prev) {
          await this.audit.log(
            this.audit.fromPrincipal(
              { id: payload.sub, email: prev.email, role: prev.role, companyId: prev.companyId },
              {
                action: 'AUTH_LOGOUT',
                resourceType: 'user',
                resourceId: payload.sub,
                previousState: { tokenVersion: prev.tokenVersion, familyId: payload.fid },
                newState: { tokenVersion: nextVersion },
              },
            ),
          );
          this.realtime.emitAuthSessionChanged(payload.sub, {
            type: 'logout',
            userId: payload.sub,
          });
        }
      }
    }

    if (res) {
      this.clearAuthCookies(res);
    }
  }

  async getProfile(user: AuthPrincipal) {
    const [dbUser, worker] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true },
      }),
      this.prisma.worker.findUnique({
        where: { userId: user.id },
        select: { id: true },
      }),
    ]);
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: dbUser?.fullName ?? null,
      role: user.role,
      authGroup: userRoleToAuthGroup(user.role),
      tenantCompanyId: user.companyId,
      workerId: worker?.id ?? null,
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

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private getCookieDomain(): string | undefined {
    const domain = this.config.get<string>('AUTH_COOKIE_DOMAIN')?.trim();
    return domain ? domain : undefined;
  }

  private buildCookieBase() {
    return {
      httpOnly: true as const,
      secure: this.isProduction(),
      sameSite: 'strict' as const,
      domain: this.getCookieDomain(),
    };
  }

  private setAccessCookie(res: Response, token: string, maxAgeMs: number): void {
    res.cookie(ACCESS_COOKIE_NAME, token, {
      ...this.buildCookieBase(),
      maxAge: maxAgeMs,
      path: '/',
    });
  }

  private setRefreshCookie(res: Response, token: string, maxAgeMs: number): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      ...this.buildCookieBase(),
      maxAge: maxAgeMs,
      path: '/api/auth/refresh',
    });
  }

  private clearAuthCookies(res: Response): void {
    const base = this.buildCookieBase();
    res.clearCookie(ACCESS_COOKIE_NAME, {
      ...base,
      path: '/',
    });
    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...base,
      path: '/api/auth/refresh',
    });
  }

  private readRefreshToken(req: Request): string | null {
    const c = req?.cookies?.[REFRESH_COOKIE_NAME];
    return typeof c === 'string' && c.length > 0 ? c : null;
  }

  private async signRefreshToken(
    userId: string,
    tokenVersion: number,
    familyId: string,
    jti: string,
    maxAgeMs: number,
  ): Promise<string> {
    const payload: JwtRefreshPayload = {
      sub: userId,
      typ: 'internal',
      kind: 'refresh',
      ver: tokenVersion,
      fid: familyId,
      jti,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET') ?? this.config.get<string>('JWT_SECRET'),
      expiresIn: Math.max(60, Math.floor(maxAgeMs / 1000)),
    });
  }

  private async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<JwtRefreshPayload>(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET') ?? this.config.get<string>('JWT_SECRET'),
      });
      if (
        payload.typ !== 'internal' ||
        payload.kind !== 'refresh' ||
        typeof payload.ver !== 'number' ||
        typeof payload.fid !== 'string' ||
        typeof payload.jti !== 'string'
      ) {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      return payload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  private async tryVerifyRefreshToken(token: string): Promise<JwtRefreshPayload | null> {
    try {
      return await this.verifyRefreshToken(token);
    } catch {
      return null;
    }
  }
}
