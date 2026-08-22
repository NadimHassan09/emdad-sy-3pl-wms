"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleOAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const googleapis_1 = require("googleapis");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const login_brute_force_service_1 = require("../../common/security/login-brute-force.service");
const request_ip_util_1 = require("../../common/security/request-ip.util");
const auth_service_1 = require("./auth.service");
const CLIENT_ROLES = [client_1.UserRole.client_admin, client_1.UserRole.client_staff];
const OPENID_SCOPES = ['openid', 'email', 'profile'].join(' ');
let GoogleOAuthService = class GoogleOAuthService {
    config;
    prisma;
    audit;
    auth;
    loginBruteForce;
    constructor(config, prisma, audit, auth, loginBruteForce) {
        this.config = config;
        this.prisma = prisma;
        this.audit = audit;
        this.auth = auth;
        this.loginBruteForce = loginBruteForce;
    }
    isConfigured() {
        if (!this.envBool(this.config.get('GOOGLE_OAUTH_ENABLED')))
            return false;
        return Boolean(this.config.get('GOOGLE_OAUTH_CLIENT_ID')?.trim() &&
            this.config.get('GOOGLE_OAUTH_CLIENT_SECRET')?.trim() &&
            this.config.get('GOOGLE_OAUTH_REDIRECT_URI')?.trim());
    }
    getStatus() {
        return { enabled: this.isConfigured() };
    }
    buildLoginUrl(options) {
        this.assertConfigured();
        const state = this.signState({
            purpose: 'login',
            rememberMe: Boolean(options?.rememberMe),
            nonce: (0, node_crypto_1.randomBytes)(16).toString('base64url'),
            exp: Math.floor(Date.now() / 1000) + 600,
        });
        return this.buildGoogleAuthUrl(state);
    }
    buildLinkUrl(user) {
        this.assertConfigured();
        const state = this.signState({
            purpose: 'link',
            userId: user.id,
            nonce: (0, node_crypto_1.randomBytes)(16).toString('base64url'),
            exp: Math.floor(Date.now() / 1000) + 600,
        });
        return this.buildGoogleAuthUrl(state);
    }
    async handleCallback(query, req, res) {
        const ip = (0, request_ip_util_1.getClientIp)(req);
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
        let state;
        try {
            state = this.verifyState(query.state.trim());
        }
        catch {
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
        }
        catch (err) {
            const code = this.mapErrorToQuery(err);
            if (state.purpose === 'link') {
                return this.redirectLinkFailure(res, code);
            }
            return this.redirectFailure(res, code);
        }
    }
    async unlink(user) {
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
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'AUTH_GOOGLE_UNLINKED',
            resourceType: 'user',
            resourceId: user.id,
            previousState: {
                googleSub: existing.googleSub,
                googleEmail: existing.googleEmail,
            },
            newState: { googleSub: null, googleEmail: null },
        }));
        return { unlinked: true };
    }
    async completeLogin(state, identity, ip, userAgent, req, res) {
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
                    message: 'This Google account is not linked to an existing account. Please contact your administrator.',
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
        if (user.status !== client_1.UserStatus.active) {
            this.loginBruteForce.recordFailure('internal', attemptCtx);
            await this.audit.log(this.audit.fromPrincipal({ id: user.id, email: user.email, role: user.role, companyId: user.companyId }, {
                action: 'AUTH_GOOGLE_LOGIN_FAILED',
                resourceType: 'user',
                resourceId: user.id,
                newState: { reason: 'inactive', googleSub: identity.sub, ip },
                ipAddress: ip,
                userAgent,
            }));
            return this.redirectFailure(res, 'google_inactive');
        }
        if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
            this.loginBruteForce.recordFailure('internal', attemptCtx);
            await this.audit.log(this.audit.fromPrincipal({ id: user.id, email: user.email, role: user.role, companyId: user.companyId }, {
                action: 'AUTH_GOOGLE_LOGIN_FAILED',
                resourceType: 'user',
                resourceId: user.id,
                newState: { reason: 'client_account', googleSub: identity.sub, ip },
                ipAddress: ip,
                userAgent,
            }));
            return this.redirectFailure(res, 'google_forbidden');
        }
        if (identity.email && identity.email !== user.googleEmail) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { googleEmail: identity.email },
            });
        }
        await this.auth.issueInternalSession({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            companyId: user.companyId,
            tokenVersion: user.tokenVersion,
        }, {
            rememberMe: Boolean(state.rememberMe),
            req,
            res,
            auditAction: 'AUTH_GOOGLE_LOGIN_SUCCESS',
            auditNewState: {
                method: 'google',
                googleSub: identity.sub,
                googleEmail: identity.email,
            },
        });
        this.loginBruteForce.recordSuccess('internal', ip ?? 'unknown');
        const success = new URL(this.successUrl());
        success.searchParams.set('google_auth', 'success');
        if (state.rememberMe)
            success.searchParams.set('persist', '1');
        res.redirect(success.toString());
    }
    async completeLink(state, identity, ip, userAgent, res) {
        if (!state.userId) {
            throw new common_1.BadRequestException('Invalid link state.');
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
        if (!actor || actor.status !== client_1.UserStatus.active) {
            await this.auditAnonymous({
                action: 'AUTH_GOOGLE_LINK_FAILED',
                resourceId: state.userId,
                newState: { reason: 'user_unavailable', googleSub: identity.sub, ip },
                ipAddress: ip,
                userAgent,
            });
            throw new common_1.UnauthorizedException('Session is no longer valid.');
        }
        if (actor.companyId !== null || CLIENT_ROLES.includes(actor.role)) {
            await this.audit.log(this.audit.fromPrincipal({ id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId }, {
                action: 'AUTH_GOOGLE_LINK_FAILED',
                resourceType: 'user',
                resourceId: actor.id,
                newState: { reason: 'client_account', googleSub: identity.sub, ip },
                ipAddress: ip,
                userAgent,
            }));
            throw new common_1.ForbiddenException('Client accounts cannot link Google Sign-In here.');
        }
        if (actor.googleSub && actor.googleSub !== identity.sub) {
            await this.audit.log(this.audit.fromPrincipal({ id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId }, {
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
            }));
            throw new common_1.ConflictException('This account already has a Google account linked. Unlink it first.');
        }
        const taken = await this.prisma.user.findUnique({
            where: { googleSub: identity.sub },
            select: { id: true, email: true },
        });
        if (taken && taken.id !== actor.id) {
            await this.audit.log(this.audit.fromPrincipal({ id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId }, {
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
            }));
            throw new common_1.ConflictException('This Google account is already linked to another user.');
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
        await this.audit.log(this.audit.fromPrincipal({ id: actor.id, email: actor.email, role: actor.role, companyId: actor.companyId }, {
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
        }));
        const success = new URL(this.linkSuccessUrl());
        success.searchParams.set('google_link', 'success');
        res.redirect(success.toString());
    }
    async exchangeCodeForIdentity(code) {
        const client = this.createOAuthClient();
        const { tokens } = await client.getToken(code);
        if (!tokens.id_token) {
            throw new common_1.BadRequestException('Google did not return an ID token.');
        }
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: this.config.get('GOOGLE_OAUTH_CLIENT_ID').trim(),
        });
        const payload = ticket.getPayload();
        const sub = payload?.sub?.trim();
        if (!sub) {
            throw new common_1.BadRequestException('Google identity is missing subject.');
        }
        return {
            sub,
            email: payload?.email?.trim().toLowerCase() || null,
            emailVerified: Boolean(payload?.email_verified),
        };
    }
    createOAuthClient() {
        this.assertConfigured();
        return new googleapis_1.google.auth.OAuth2(this.config.get('GOOGLE_OAUTH_CLIENT_ID').trim(), this.config.get('GOOGLE_OAUTH_CLIENT_SECRET').trim(), this.config.get('GOOGLE_OAUTH_REDIRECT_URI').trim());
    }
    buildGoogleAuthUrl(state) {
        const client = this.createOAuthClient();
        return client.generateAuthUrl({
            access_type: 'online',
            prompt: 'select_account',
            scope: OPENID_SCOPES,
            state,
            include_granted_scopes: true,
        });
    }
    signState(payload) {
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = (0, node_crypto_1.createHmac)('sha256', this.signingSecret()).update(body).digest('base64url');
        return `${body}.${sig}`;
    }
    verifyState(state) {
        const parts = state.split('.');
        if (parts.length !== 2)
            throw new common_1.BadRequestException('Invalid OAuth state.');
        const [body, sig] = parts;
        const expected = (0, node_crypto_1.createHmac)('sha256', this.signingSecret()).update(body).digest('base64url');
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !(0, node_crypto_1.timingSafeEqual)(a, b)) {
            throw new common_1.BadRequestException('Invalid OAuth state signature.');
        }
        const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (parsed.purpose !== 'login' && parsed.purpose !== 'link') {
            throw new common_1.BadRequestException('Invalid OAuth state purpose.');
        }
        if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
            throw new common_1.BadRequestException('OAuth state expired.');
        }
        return parsed;
    }
    signingSecret() {
        return (this.config.get('GOOGLE_OAUTH_STATE_SECRET')?.trim() ||
            this.config.get('JWT_SECRET') ||
            'dev-only-change-in-production');
    }
    assertConfigured() {
        if (!this.isConfigured()) {
            throw new common_1.ServiceUnavailableException('Google Sign-In is not configured.');
        }
    }
    frontendOrigin() {
        const explicit = this.config.get('GOOGLE_OAUTH_FRONTEND_ORIGIN')?.trim();
        if (explicit)
            return explicit.replace(/\/$/, '');
        const cors = this.config.get('CORS_ORIGINS')?.split(',')[0]?.trim();
        if (cors)
            return cors.replace(/\/$/, '');
        return 'http://localhost:5173';
    }
    successUrl() {
        return (this.config.get('GOOGLE_OAUTH_SUCCESS_URL')?.trim() ||
            `${this.frontendOrigin()}/login`);
    }
    failureUrl() {
        return (this.config.get('GOOGLE_OAUTH_FAILURE_URL')?.trim() ||
            `${this.frontendOrigin()}/login`);
    }
    linkSuccessUrl() {
        return (this.config.get('GOOGLE_OAUTH_LINK_SUCCESS_URL')?.trim() ||
            `${this.frontendOrigin()}/profile`);
    }
    redirectFailure(res, code) {
        const url = new URL(this.failureUrl());
        url.searchParams.set('google_error', code);
        res.redirect(url.toString());
    }
    redirectLinkFailure(res, code) {
        const url = new URL(this.linkSuccessUrl());
        url.searchParams.set('google_link', 'error');
        url.searchParams.set('google_error', code);
        res.redirect(url.toString());
    }
    mapErrorToQuery(err) {
        if (err instanceof common_1.ConflictException)
            return 'google_conflict';
        if (err instanceof common_1.ForbiddenException)
            return 'google_forbidden';
        if (err instanceof common_1.UnauthorizedException)
            return 'google_unauthorized';
        if (err instanceof common_1.BadRequestException)
            return 'google_invalid';
        if (err instanceof common_1.ServiceUnavailableException)
            return 'google_unavailable';
        return 'google_failed';
    }
    async auditAnonymous(input) {
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
    envBool(raw) {
        if (raw === undefined || raw === null || raw === '')
            return false;
        const v = String(raw).trim().toLowerCase();
        return ['true', '1', 'yes', 'on'].includes(v);
    }
};
exports.GoogleOAuthService = GoogleOAuthService;
exports.GoogleOAuthService = GoogleOAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        auth_service_1.AuthService,
        login_brute_force_service_1.LoginBruteForceService])
], GoogleOAuthService);
//# sourceMappingURL=google-oauth.service.js.map