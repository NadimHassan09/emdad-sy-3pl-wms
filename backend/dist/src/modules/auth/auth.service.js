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
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const auth_groups_1 = require("../../common/auth/auth-groups");
const password_service_1 = require("../../common/crypto/password.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const CLIENT_ROLES = [client_1.UserRole.client_admin, client_1.UserRole.client_staff];
let AuthService = class AuthService {
    prisma;
    password;
    jwt;
    config;
    constructor(prisma, password, jwt, config) {
        this.prisma = prisma;
        this.password = password;
        this.jwt = jwt;
        this.config = config;
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
        const expiresIn = this.config.get('JWT_EXPIRES_IN') ?? '8h';
        const payload = {
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
                secure: this.config.get('NODE_ENV') === 'production',
                sameSite: 'lax',
                maxAge: maxAgeMs,
                path: '/',
            });
        }
        return {
            access_token,
            token_type: 'Bearer',
            expires_in: Math.floor(maxAgeMs / 1000),
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                authGroup: (0, auth_groups_1.userRoleToAuthGroup)(user.role),
            },
        };
    }
    getProfile(user) {
        return {
            id: user.id,
            email: user.email ?? null,
            role: user.role,
            authGroup: (0, auth_groups_1.userRoleToAuthGroup)(user.role),
            tenantCompanyId: user.companyId,
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map