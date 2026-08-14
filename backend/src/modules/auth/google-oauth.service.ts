import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { google } from 'googleapis';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginBruteForceService } from '../../common/security/login-brute-force.service';
import { getClientIp } from '../../common/security/request-ip.util';
import { AuthService } from './auth.service';

const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];
const OPENID_SCOPES = ['openid', 'email', 'profile'].join(' ');

type GoogleOAuthPurpose = 'login' | 'link';

type GoogleOAuthState = {
  purpose: GoogleOAuthPurpose;
  userId?: string;
  rememberMe?: boolean;
  nonce: string;
  exp: number;
};

type GoogleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
};

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly auth: AuthService,
    private readonly loginBruteForce: LoginBruteForceService,
  ) {}

  isConfigured(): boolean {
    if (!this.envBool(this.config.get('GOOGLE_OAUTH_ENABLED'))) return false;
    return Boolean(
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim() &&
        this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')?.trim() &&
        this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI')?.trim(),
    );
  }

  getStatus(): { enabled: boolean } {
    return { enabled: this.isConfigured() };
  }

  buildLoginUrl(options?: { rememberMe?: boolean }): string {
    this.assertConfigured();
    const state = this.signState({
      purpose: 'login',
      rememberMe: Boolean(options?.rememberMe),
      nonce: randomBytes(16).toString('base64url'),
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    return this.buildGoogleAuthUrl(state);
  }

  buildLinkUrl(user: AuthPrincipal): string {
    this.assertConfigured();
    const state = this.signState({
      purpose: 'link',
      userId: user.id,
      nonce: randomBytes(16).toString('base64url'),
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    return this.buildGoogleAuthUrl(state);
  }

  async handleCallback(
    query: { code?: string; state?: string; error?: string },
    req: Request,
    res: Response,
  ): Promise<void> {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] ?? null;

    if (query.error) {
      await this.auditAnonymous({
        action: 'AUTH_GOOGLE_LOGIN_FAILED',
        resourceId: 'google_oauth',
        newState: { reason: 'oauth_error', error: query.error, ip },
        ipAddress: ip,
        userAgent,
      });
      return this.redirectFailure(res, 'google_denied');
    }

    if (!query.code?.trim() || !query.state?.trim()) {
      await this.auditAnonymous({
        action: 'AUTH_GOOGLE_LOGIN_FAILED',
        resourceId: 'google_oauth',
        newState: { reason: 'missing_code_or_state', ip },
        ipAddress: ip,
        userAgent,
      });
      return this.redirectFailure(res, 'google_invalid');
    }

    let state: GoogleOAuthState;
    try {
      state = this.verifyState(query.state.trim());
    } catch {
      await this.auditAnonymous({
        action: 'AUTH_GOOGLE_LOGIN_FAILED',
        resourceId: 'google_oauth',
        newState: { reason: 'invalid_state', ip },
        ipAddress: ip,
        userAgent,
      });
      return this.redirectFailure(res, 'google_invalid');
    }

    try {
      const identity = await this.exchangeCodeForIdentity(query.code.trim());
      if (state.purpose === 'link') {
        await this.completeLink(state, identity, ip, userAgent, res);
        return;
      }
      await this.completeLogin(state, identity, ip, userAgent, req, res);
    } catch (err) {
      const code = this.mapErrorToQuery(err);
      if (state.purpose === 'link') {
        return this.redirectLinkFailure(res, code);
      }
      return this.redirectFailure(res, code);
    }
  }

  async unlink(user: AuthPrincipal): Promise<{ unlinked: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        googleSub: true,
        googleEmail: true,
      },
    });
    if (!existing?.googleSub) {
      return { unlinked: false };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        googleSub: null,
        googleEmail: null,
        googleLinkedAt: null,
      },
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'AUTH_GOOGLE_UNLINKED',
        resourceType: 'user',
        resourceId: user.id,
        previousState: {
          googleSub: existing.googleSub,
          googleEmail: existing.googleEmail,
        },
        newState: { googleSub: null, googleEmail: null },
      }),
    );

    return { unlinked: true };
  }

  private async completeLogin(
    state: GoogleOAuthState,
    identity: GoogleIdentity,
    ip: string | null,
    userAgent: string | null,
    req: Request,
    res: Response,
  ): Promise<void> {
    this.loginBruteForce.assertAllowed('internal', ip ?? 'unknown');
    const attemptCtx = {
      ipAddress: ip ?? 'unknown',
      email: identity.email ?? `google:${identity.sub}`,
      userAgent,
    };

    const user = await this.prisma.user.findUnique({
      where: { googleSub: identity.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        companyId: true,
        tokenVersion: true,
        googleEmail: true,
      },
    });

    if (!user) {
      this.loginBruteForce.recordFailure('internal', attemptCtx);
      await this.auditAnonymous({
        action: 'AUTH_GOOGLE_LOGIN_REJECTED_NOT_LINKED',
        resourceId: identity.sub,
        newState: {
          message:
            'This Google account is not linked to an existing account. Please contact your administrator.',
          googleSub: identity.sub,
          googleEmail: identity.email,
          ip,
        },
        ipAddress: ip,
        userAgent,
        actorEmail: identity.email ?? `google:${identity.sub}@accounts.google.com`,
      });
      return this.redirectFailure(res, 'google_not_linked');
    }

    if (user.status !== UserStatus.active) {
      this.loginBruteForce.recordFailure('internal', attemptCtx);
      await this.audit.log(
        this.audit.fromPrincipal(
          { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
          {
            action: 'AUTH_GOOGLE_LOGIN_FAILED',
            resourceType: 'user',
            resourceId: user.id,
            newState: { reason: 'inactive', googleSub: identity.sub, ip },
            ipAddress: ip,
            userAgent,
          },
        ),
      );
      return this.redirectFailure(res, 'google_inactive');
    }

    if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
      this.loginBruteForce.recordFailure('internal', attemptCtx);
      await this.audit.log(
        this.audit.fromPrincipal(
          { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
          {
            action: 'AUTH_GOOGLE_LOGIN_FAILED',
            resourceType: 'user',
            resourceId: user.id,
            newState: { reason: 'client_account', googleSub: identity.sub, ip },
            ipAddress: ip,
            userAgent,
          },
        ),
      );
      return this.redirectFailure(res, 'google_forbidden');
    }

    // Keep stored Google email in sync when Google returns a verified address.
    if (identity.email && identity.email !== user.googleEmail) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleEmail: identity.email },
      });
    }

    await this.auth.issueInternalSession(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        tokenVersion: user.tokenVersion,
      },
      {
        rememberMe: Boolean(state.rememberMe),
        req,
        res,
        auditAction: 'AUTH_GOOGLE_LOGIN_SUCCESS',
        auditNewState: {
          method: 'google',
          googleSub: identity.sub,
          googleEmail: identity.email,
        },
      },
    );

    this.loginBruteForce.recordSuccess('internal', ip ?? 'unknown');
    const success = new URL(this.successUrl());
    success.searchParams.set('google_auth', 'success');
    if (state.rememberMe) success.searchParams.set('persist', '1');
    res.redirect(success.toString());
  }

  private async completeLink(
    state: GoogleOAuthState,
    identity: GoogleIdentity,
    ip: string | null,
    userAgent: string | null,
    res: Response,
  ): Promise<void> {
    if (!state.userId) {
      throw new BadRequestException('Invalid link state.');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: state.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        companyId: true,
        googleSub: true,
        googleEmail: true,
      },
    });

    if (!actor || actor.status !== UserStatus.active) {
      await this.auditAnonymous({
        action: 'AUTH_GOOGLE_LINK_FAILED',
        resourceId: state.userId,
        newState: { reason: 'user_unavailable', googleSub: identity.sub, ip },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Session is no longer valid.');
    }

    if (actor.companyId !== null || CLIENT_ROLES.includes(actor.role)) {
      await this.audit.log(
        this.audit.fromPrincipal(
          { id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId },
          {
            action: 'AUTH_GOOGLE_LINK_FAILED',
            resourceType: 'user',
            resourceId: actor.id,
            newState: { reason: 'client_account', googleSub: identity.sub, ip },
            ipAddress: ip,
            userAgent,
          },
        ),
      );
      throw new ForbiddenException('Client accounts cannot link Google Sign-In here.');
    }

    if (actor.googleSub && actor.googleSub !== identity.sub) {
      await this.audit.log(
        this.audit.fromPrincipal(
          { id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId },
          {
            action: 'AUTH_GOOGLE_LINK_FAILED',
            resourceType: 'user',
            resourceId: actor.id,
            newState: {
              reason: 'already_linked_other',
              existingGoogleSub: actor.googleSub,
              attemptedGoogleSub: identity.sub,
              ip,
            },
            ipAddress: ip,
            userAgent,
          },
        ),
      );
      throw new ConflictException(
        'This account already has a Google account linked. Unlink it first.',
      );
    }

    const taken = await this.prisma.user.findUnique({
      where: { googleSub: identity.sub },
      select: { id: true, email: true },
    });
    if (taken && taken.id !== actor.id) {
      await this.audit.log(
        this.audit.fromPrincipal(
          { id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId },
          {
            action: 'AUTH_GOOGLE_LINK_FAILED',
            resourceType: 'user',
            resourceId: actor.id,
            newState: {
              reason: 'google_already_linked_elsewhere',
              googleSub: identity.sub,
              ip,
            },
            ipAddress: ip,
            userAgent,
          },
        ),
      );
      throw new ConflictException(
        'This Google account is already linked to another user.',
      );
    }

    const now = new Date();
    await this.prisma.user.update({
      where: { id: actor.id },
      data: {
        googleSub: identity.sub,
        googleEmail: identity.email,
        googleLinkedAt: now,
      },
    });

    await this.audit.log(
      this.audit.fromPrincipal(
        { id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId },
        {
          action: 'AUTH_GOOGLE_LINKED',
          resourceType: 'user',
          resourceId: actor.id,
          previousState: {
            googleSub: actor.googleSub,
            googleEmail: actor.googleEmail,
          },
          newState: {
            googleSub: identity.sub,
            googleEmail: identity.email,
            googleLinkedAt: now.toISOString(),
            ip,
          },
          ipAddress: ip,
          userAgent,
        },
      ),
    );

    const success = new URL(this.linkSuccessUrl());
    success.searchParams.set('google_link', 'success');
    res.redirect(success.toString());
  }

  private async exchangeCodeForIdentity(code: string): Promise<GoogleIdentity> {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new BadRequestException('Google did not return an ID token.');
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')!.trim(),
    });
    const payload = ticket.getPayload();
    const sub = payload?.sub?.trim();
    if (!sub) {
      throw new BadRequestException('Google identity is missing subject.');
    }

    return {
      sub,
      email: payload?.email?.trim().toLowerCase() || null,
      emailVerified: Boolean(payload?.email_verified),
    };
  }

  private createOAuthClient() {
    this.assertConfigured();
    return new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')!.trim(),
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')!.trim(),
      this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI')!.trim(),
    );
  }

  private buildGoogleAuthUrl(state: string): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: OPENID_SCOPES,
      state,
      include_granted_scopes: true,
    });
  }

  private signState(payload: GoogleOAuthState): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.signingSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): GoogleOAuthState {
    const parts = state.split('.');
    if (parts.length !== 2) throw new BadRequestException('Invalid OAuth state.');
    const [body, sig] = parts;
    const expected = createHmac('sha256', this.signingSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid OAuth state signature.');
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as GoogleOAuthState;
    if (parsed.purpose !== 'login' && parsed.purpose !== 'link') {
      throw new BadRequestException('Invalid OAuth state purpose.');
    }
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('OAuth state expired.');
    }
    return parsed;
  }

  private signingSecret(): string {
    return (
      this.config.get<string>('GOOGLE_OAUTH_STATE_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET') ||
      'dev-only-change-in-production'
    );
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Google Sign-In is not configured.');
    }
  }

  private frontendOrigin(): string {
    const explicit = this.config.get<string>('GOOGLE_OAUTH_FRONTEND_ORIGIN')?.trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const cors = this.config.get<string>('CORS_ORIGINS')?.split(',')[0]?.trim();
    if (cors) return cors.replace(/\/$/, '');
    return 'http://localhost:5173';
  }

  private successUrl(): string {
    return (
      this.config.get<string>('GOOGLE_OAUTH_SUCCESS_URL')?.trim() ||
      `${this.frontendOrigin()}/login`
    );
  }

  private failureUrl(): string {
    return (
      this.config.get<string>('GOOGLE_OAUTH_FAILURE_URL')?.trim() ||
      `${this.frontendOrigin()}/login`
    );
  }

  private linkSuccessUrl(): string {
    return (
      this.config.get<string>('GOOGLE_OAUTH_LINK_SUCCESS_URL')?.trim() ||
      `${this.frontendOrigin()}/profile`
    );
  }

  private redirectFailure(res: Response, code: string): void {
    const url = new URL(this.failureUrl());
    url.searchParams.set('google_error', code);
    res.redirect(url.toString());
  }

  private redirectLinkFailure(res: Response, code: string): void {
    const url = new URL(this.linkSuccessUrl());
    url.searchParams.set('google_link', 'error');
    url.searchParams.set('google_error', code);
    res.redirect(url.toString());
  }

  private mapErrorToQuery(err: unknown): string {
    if (err instanceof ConflictException) return 'google_conflict';
    if (err instanceof ForbiddenException) return 'google_forbidden';
    if (err instanceof UnauthorizedException) return 'google_unauthorized';
    if (err instanceof BadRequestException) return 'google_invalid';
    if (err instanceof ServiceUnavailableException) return 'google_unavailable';
    return 'google_failed';
  }

  private async auditAnonymous(input: {
    action: string;
    resourceId: string;
    newState?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
    actorEmail?: string;
  }): Promise<void> {
    await this.audit.logBestEffort({
      actorId: null,
      actorEmail: input.actorEmail ?? 'google-oauth@system.local',
      actorName: 'Google OAuth',
      actorRole: 'anonymous',
      companyId: null,
      action: input.action,
      resourceType: 'user',
      resourceId: input.resourceId,
      newState: input.newState,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  }

  private envBool(raw: unknown): boolean {
    if (raw === undefined || raw === null || raw === '') return false;
    const v = String(raw).trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(v);
  }
}
