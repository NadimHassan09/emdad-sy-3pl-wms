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
exports.AuthService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const auth_groups_1 = require("../../common/auth/auth-groups");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const password_service_1 = require("../../common/crypto/password.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const CLIENT_ROLES = [client_1.UserRole.client_admin, client_1.UserRole.client_staff];
const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';
const DEFAULT_ACCESS_EXPIRES = '15m';
const DEFAULT_REFRESH_EXPIRES = '7d';
let AuthService = class AuthService {
    prisma;
    password;
    jwt;
    config;
    audit;
    constructor(prisma, password, jwt, config, audit) {
        this.prisma = prisma;
        this.password = password;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
    }
    async login(dto, res) {
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
        if (!user || user.status !== client_1.UserStatus.active) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('Client accounts cannot access this system.');
        }
        const valid = await this.password.verify(dto.password, user.passwordHash);
        if (!valid) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        const now = new Date();
        const loginData = {
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
        await this.audit.log(this.audit.fromPrincipal({ id: user.id, email: user.email, role: user.role, companyId: user.companyId }, {
            action: 'AUTH_LOGIN_SUCCESS',
            resourceType: 'user',
            resourceId: user.id,
            previousState: { tokenVersion: user.tokenVersion },
            newState: { lastLoginAt: now.toISOString(), lastActivityAt: now.toISOString() },
        }));
        const accessExpiresIn = this.config.get('JWT_ACCESS_EXPIRES_IN') ?? DEFAULT_ACCESS_EXPIRES;
        const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN') ?? DEFAULT_REFRESH_EXPIRES;
        const accessMaxAgeMs = this.expiresInToMs(accessExpiresIn);
        const refreshMaxAgeMs = this.expiresInToMs(refreshExpiresIn);
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            typ: 'internal',
            ver: user.tokenVersion,
        };
        const access_token = await this.jwt.signAsync(payload, {
            expiresIn: Math.max(60, Math.floor(accessMaxAgeMs / 1000)),
        });
        const refresh_token = await this.signRefreshToken(user.id, user.tokenVersion, refreshMaxAgeMs);
        if (res) {
            this.setAccessCookie(res, access_token, accessMaxAgeMs);
            this.setRefreshCookie(res, refresh_token, refreshMaxAgeMs);
        }
        return {
            access_token,
            token_type: 'Bearer',
            expires_in: Math.floor(accessMaxAgeMs / 1000),
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                authGroup: (0, auth_groups_1.userRoleToAuthGroup)(user.role),
            },
        };
    }
    async refresh(req, res) {
        const rawToken = this.readRefreshToken(req);
        if (!rawToken)
            throw new common_1.UnauthorizedException('Missing refresh token.');
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
        if (!user || user.status !== client_1.UserStatus.active) {
            throw new common_1.UnauthorizedException('Session is no longer valid.');
        }
        if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('Client accounts cannot access this system.');
        }
        if (payload.ver !== user.tokenVersion) {
            throw new common_1.UnauthorizedException('Session has been invalidated. Please log in again.');
        }
        const now = new Date();
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastActivityAt: now },
        });
        await this.audit.log(this.audit.fromPrincipal({ id: user.id, email: user.email, role: user.role, companyId: user.companyId }, {
            action: 'AUTH_REFRESH_SUCCESS',
            resourceType: 'user',
            resourceId: user.id,
            previousState: { tokenVersion: user.tokenVersion },
            newState: { lastActivityAt: now.toISOString() },
        }));
        const accessExpiresIn = this.config.get('JWT_ACCESS_EXPIRES_IN') ?? DEFAULT_ACCESS_EXPIRES;
        const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN') ?? DEFAULT_REFRESH_EXPIRES;
        const accessMaxAgeMs = this.expiresInToMs(accessExpiresIn);
        const refreshMaxAgeMs = this.expiresInToMs(refreshExpiresIn);
        const accessPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            typ: 'internal',
            ver: user.tokenVersion,
        };
        const access_token = await this.jwt.signAsync(accessPayload, {
            expiresIn: Math.max(60, Math.floor(accessMaxAgeMs / 1000)),
        });
        const refresh_token = await this.signRefreshToken(user.id, user.tokenVersion, refreshMaxAgeMs);
        if (res) {
            this.setAccessCookie(res, access_token, accessMaxAgeMs);
            this.setRefreshCookie(res, refresh_token, refreshMaxAgeMs);
        }
        return {
            access_token,
            token_type: 'Bearer',
            expires_in: Math.floor(accessMaxAgeMs / 1000),
        };
    }
    async logout(req, res) {
        const rawRefresh = this.readRefreshToken(req);
        if (rawRefresh) {
            const payload = await this.tryVerifyRefreshToken(rawRefresh);
            if (payload?.sub) {
                const prev = await this.prisma.user.findUnique({
                    where: { id: payload.sub },
                    select: { tokenVersion: true, email: true, role: true, companyId: true },
                });
                await this.prisma.user.updateMany({
                    where: { id: payload.sub },
                    data: {
                        tokenVersion: { increment: 1 },
                        lastActivityAt: new Date(),
                    },
                });
                if (prev) {
                    await this.audit.log(this.audit.fromPrincipal({ id: payload.sub, email: prev.email, role: prev.role, companyId: prev.companyId }, {
                        action: 'AUTH_LOGOUT',
                        resourceType: 'user',
                        resourceId: payload.sub,
                        previousState: { tokenVersion: prev.tokenVersion },
                        newState: { tokenVersion: prev.tokenVersion + 1 },
                    }));
                }
            }
        }
        if (res) {
            this.clearAuthCookies(res);
        }
    }
    async getProfile(user) {
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
            authGroup: (0, auth_groups_1.userRoleToAuthGroup)(user.role),
            tenantCompanyId: user.companyId,
            workerId: worker?.id ?? null,
        };
    }
    expiresInToMs(expiresIn) {
        const t = expiresIn.trim().toLowerCase();
        const m = /^(\d+)(s|m|h|d)?$/.exec(t);
        if (!m)
            return 8 * 60 * 60 * 1000;
        const n = parseInt(m[1], 10);
        const u = m[2] ?? 's';
        const mult = u === 'd' ? 86400e3 : u === 'h' ? 3600e3 : u === 'm' ? 60e3 : 1000;
        return n * mult;
    }
    isProduction() {
        return this.config.get('NODE_ENV') === 'production';
    }
    getCookieDomain() {
        const domain = this.config.get('AUTH_COOKIE_DOMAIN')?.trim();
        return domain ? domain : undefined;
    }
    buildCookieBase() {
        return {
            httpOnly: true,
            secure: this.isProduction(),
            sameSite: 'strict',
            domain: this.getCookieDomain(),
        };
    }
    setAccessCookie(res, token, maxAgeMs) {
        res.cookie(ACCESS_COOKIE_NAME, token, {
            ...this.buildCookieBase(),
            maxAge: maxAgeMs,
            path: '/',
        });
    }
    setRefreshCookie(res, token, maxAgeMs) {
        res.cookie(REFRESH_COOKIE_NAME, token, {
            ...this.buildCookieBase(),
            maxAge: maxAgeMs,
            path: '/api/auth/refresh',
        });
    }
    clearAuthCookies(res) {
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
    readRefreshToken(req) {
        const c = req?.cookies?.[REFRESH_COOKIE_NAME];
        return typeof c === 'string' && c.length > 0 ? c : null;
    }
    async signRefreshToken(userId, tokenVersion, maxAgeMs) {
        const payload = {
            sub: userId,
            typ: 'internal',
            kind: 'refresh',
            ver: tokenVersion,
            jti: (0, node_crypto_1.randomUUID)(),
        };
        return this.jwt.signAsync(payload, {
            secret: this.config.get('JWT_REFRESH_SECRET') ?? this.config.get('JWT_SECRET'),
            expiresIn: Math.max(60, Math.floor(maxAgeMs / 1000)),
        });
    }
    async verifyRefreshToken(token) {
        try {
            const payload = await this.jwt.verifyAsync(token, {
                secret: this.config.get('JWT_REFRESH_SECRET') ?? this.config.get('JWT_SECRET'),
            });
            if (payload.typ !== 'internal' || payload.kind !== 'refresh' || typeof payload.ver !== 'number') {
                throw new common_1.UnauthorizedException('Invalid refresh token.');
            }
            return payload;
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token.');
        }
    }
    async tryVerifyRefreshToken(token) {
        try {
            return await this.verifyRefreshToken(token);
        }
        catch {
            return null;
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_log_service_1.AuditLogService])
], AuthService);
//# sourceMappingURL=auth.service.js.map