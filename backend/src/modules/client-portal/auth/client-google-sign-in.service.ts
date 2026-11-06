import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { google } from 'googleapis';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { JwtClientAccessPayload } from './strategies/jwt-client.strategy';

const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];
const OPENID_SCOPES = 'openid email profile';
const STATE_TTL_SECONDS = 600;

@Injectable()
export class ClientGoogleSignInService {
  private readonly logger = new Logger(ClientGoogleSignInService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  isConfigured(): boolean {
    const enabled = this.config.get<string>('GOOGLE_OAUTH_ENABLED');
    if (enabled && enabled !== 'true' && enabled !== '1') return false;
    return Boolean(
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim() &&
        this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')?.trim() &&
        this.clientRedirectUri(),
    );
  }

  getStatus(): { enabled: boolean } {
    return { enabled: this.isConfigured() };
  }

  buildLoginUrl(options?: { rememberMe?: boolean }): string {
    this.assertConfigured();
    const state = this.signState({
      rememberMe: Boolean(options?.rememberMe),
      nonce: randomBytes(16).toString('base64url'),
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    });
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: OPENID_SCOPES,
      state,
      include_granted_scopes: true,
    });
  }

  async handleCallback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    res: Response,
  ): Promise<void> {
    const failUrl = (code: string) => {
      const base = this.clientFrontendUrl();
      return `${base}/login?google_error=${encodeURIComponent(code)}`;
    };

    if (error || !code || !state) {
      return void res.redirect(failUrl('google_denied'));
    }

    let statePayload: { rememberMe?: boolean; nonce: string; exp: number };
    try {
      statePayload = this.verifyState(state);
    } catch {
      return void res.redirect(failUrl('google_invalid'));
    }

    let googleSub: string;
    let googleEmail: string | null;
    try {
      const identity = await this.verifyGoogleCode(code);
      googleSub = identity.sub;
      googleEmail = identity.email;
    } catch (err) {
      this.logger.warn(`Google identity verification failed: ${String(err)}`);
      return void res.redirect(failUrl('google_invalid'));
    }

    // Find client user by googleSub OR by email fallback
    let user = await this.prisma.user.findFirst({
      where: { googleSub },
      select: {
        id: true, email: true, fullName: true, role: true, companyId: true,
        status: true, tokenVersion: true,
      },
    });

    if (!user && googleEmail) {
      // Email-based fallback: auto-link if the user has the same email and no existing googleSub
      user = await this.prisma.user.findFirst({
        where: { email: googleEmail, googleSub: null },
        select: {
          id: true, email: true, fullName: true, role: true, companyId: true,
          status: true, tokenVersion: true,
        },
      });
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { googleSub, googleEmail, googleLinkedAt: new Date() },
        });
      }
    }

    if (!user) return void res.redirect(failUrl('google_not_linked'));
    if (!CLIENT_ROLES.includes(user.role)) return void res.redirect(failUrl('google_forbidden'));
    if (user.status !== UserStatus.active) return void res.redirect(failUrl('google_inactive'));
    if (!user.companyId) return void res.redirect(failUrl('google_forbidden'));

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now, lastActivityAt: now },
    });

    const expiresIn = statePayload.rememberMe ? '30d' : '8h';
    const maxAgeMs = statePayload.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;

    const payload: JwtClientAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId!,
      typ: 'client',
    };
    const access_token = await this.jwt.signAsync(payload, { expiresIn });

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie('client_access_token', access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });

    res.redirect(`${this.clientFrontendUrl()}/dashboard?google_auth=success`);
  }

  async linkGoogle(userId: string): Promise<string> {
    this.assertConfigured();
    const state = this.signState({
      userId,
      nonce: randomBytes(16).toString('base64url'),
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    });
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account consent',
      scope: OPENID_SCOPES,
      state,
      include_granted_scopes: true,
    });
  }

  async handleLinkCallback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    res: Response,
  ): Promise<void> {
    const profileUrl = `${this.clientFrontendUrl()}/profile`;
    const failUrl = (code: string) => `${profileUrl}?google_error=${encodeURIComponent(code)}`;

    if (error || !code || !state) {
      return void res.redirect(failUrl('google_denied'));
    }

    let statePayload: { userId?: string; nonce: string; exp: number };
    try {
      statePayload = this.verifyState(state);
    } catch {
      return void res.redirect(failUrl('google_invalid'));
    }

    if (!statePayload.userId) return void res.redirect(failUrl('google_invalid'));

    let googleSub: string;
    let googleEmail: string | null;
    try {
      const identity = await this.verifyGoogleCode(code);
      googleSub = identity.sub;
      googleEmail = identity.email;
    } catch {
      return void res.redirect(failUrl('google_invalid'));
    }

    // Check if googleSub already claimed by another user
    const existing = await this.prisma.user.findFirst({ where: { googleSub } });
    if (existing && existing.id !== statePayload.userId) {
      return void res.redirect(failUrl('google_conflict'));
    }

    await this.prisma.user.update({
      where: { id: statePayload.userId },
      data: { googleSub, googleEmail, googleLinkedAt: new Date() },
    });

    res.redirect(`${profileUrl}?google_linked=1`);
  }

  async unlink(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { googleSub: null, googleEmail: null, googleLinkedAt: null },
    });
  }

  private async verifyGoogleCode(code: string): Promise<{ sub: string; email: string | null }> {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new UnauthorizedException('No ID token from Google.');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')!.trim(),
    });
    const payload = ticket.getPayload();
    const sub = payload?.sub?.trim();
    if (!sub) throw new UnauthorizedException('Missing Google sub.');
    return { sub, email: payload?.email?.trim().toLowerCase() ?? null };
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')!.trim(),
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')!.trim(),
      this.clientRedirectUri()!,
    );
  }

  private clientRedirectUri(): string | undefined {
    return (
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_REDIRECT_URI')?.trim() ||
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_LOGIN_REDIRECT_URI')?.trim()
    );
  }

  private clientFrontendUrl(): string {
    const explicit = this.config.get<string>('CLIENT_PORTAL_ORIGIN')?.trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const cors = this.config.get<string>('CORS_ORIGINS')?.split(',');
    // The second CORS origin is typically the client portal
    const second = cors?.[1]?.trim();
    if (second) return second.replace(/\/$/, '');
    return 'http://localhost:5174';
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Google Sign-In is not configured for the client portal.');
    }
  }

  private signState(payload: Record<string, unknown>): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.signingSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): { userId?: string; rememberMe?: boolean; nonce: string; exp: number } {
    const parts = state.split('.');
    if (parts.length !== 2) throw new Error('Invalid state format.');
    const [body, sig] = parts;
    const expected = createHmac('sha256', this.signingSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid state signature.');
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) throw new Error('State expired.');
    return parsed;
  }

  private signingSecret(): string {
    return (
      this.config.get<string>('GOOGLE_OAUTH_STATE_SECRET')?.trim() ||
      this.config.get<string>('CLIENT_JWT_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET') ||
      'dev-only-change-in-production'
    );
  }
}
