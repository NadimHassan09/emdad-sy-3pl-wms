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
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const client_1 = require("@prisma/client");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const user_activity_service_1 = require("../user-activity.service");
const UUID_HEADER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function companyScopeFromRequest(req) {
    const raw = req.headers['x-company-id'];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (typeof v !== 'string' || !UUID_HEADER_RE.test(v.trim()))
        return null;
    return v.trim();
}
const CLIENT_ROLES = [client_1.UserRole.client_admin, client_1.UserRole.client_staff];
function fromCookie(req) {
    const c = req?.cookies?.access_token;
    return typeof c === 'string' && c.length > 0 ? c : null;
}
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy, 'jwt') {
    prisma;
    userActivity;
    constructor(config, prisma, userActivity) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([
                passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
                fromCookie,
            ]),
            ignoreExpiration: false,
            secretOrKey: config.get('JWT_SECRET') ?? 'dev-only-change-in-production',
            passReqToCallback: true,
        });
        this.prisma = prisma;
        this.userActivity = userActivity;
    }
    async validate(req, payload) {
        if (payload.typ === 'client') {
            throw new common_1.UnauthorizedException('Use the internal WMS app with an internal account.');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, role: true, status: true, companyId: true, email: true },
        });
        if (!user || user.status !== client_1.UserStatus.active) {
            throw new common_1.UnauthorizedException('Session is no longer valid.');
        }
        if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('Client accounts are not permitted to use this application.');
        }
        this.userActivity.touch(user.id);
        return {
            id: user.id,
            role: user.role,
            companyId: companyScopeFromRequest(req),
            email: user.email,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        user_activity_service_1.UserActivityService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map