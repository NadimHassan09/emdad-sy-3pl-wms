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
exports.JwtClientStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const client_1 = require("@prisma/client");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../../../../common/prisma/prisma.service");
const CLIENT_ROLES = [client_1.UserRole.client_admin, client_1.UserRole.client_staff];
function fromClientCookie(req) {
    const c = req?.cookies?.client_access_token;
    return typeof c === 'string' && c.length > 0 ? c : null;
}
let JwtClientStrategy = class JwtClientStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy, 'jwt-client') {
    prisma;
    constructor(config, prisma) {
        const secretOrKey = config.get('CLIENT_JWT_SECRET') ??
            config.get('JWT_SECRET') ??
            'dev-only-change-in-production';
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([
                passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
                fromClientCookie,
            ]),
            ignoreExpiration: false,
            secretOrKey,
        });
        this.prisma = prisma;
    }
    async validate(payload) {
        if (payload.typ !== 'client') {
            throw new common_1.UnauthorizedException('Invalid client session.');
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
        if (!user || user.status !== client_1.UserStatus.active) {
            throw new common_1.UnauthorizedException('Session is no longer valid.');
        }
        if (user.companyId === null || !CLIENT_ROLES.includes(user.role)) {
            throw new common_1.UnauthorizedException('Session is no longer valid.');
        }
        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            companyId: user.companyId,
            companyName: user.company?.name ?? '',
        };
    }
};
exports.JwtClientStrategy = JwtClientStrategy;
exports.JwtClientStrategy = JwtClientStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], JwtClientStrategy);
//# sourceMappingURL=jwt-client.strategy.js.map