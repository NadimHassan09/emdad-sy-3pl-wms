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
exports.ApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const api_credential_util_1 = require("../api-credentials/api-credential.util");
const require_api_scope_decorator_1 = require("./require-api-scope.decorator");
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LIMIT = 20;
const LAST_USED_MIN_INTERVAL_MS = 60_000;
let ApiKeyGuard = class ApiKeyGuard {
    prisma;
    reflector;
    failures = new Map();
    constructor(prisma, reflector) {
        this.prisma = prisma;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const parsed = (0, api_credential_util_1.parseApiCredentials)({
            apiKeyHeader: req.headers['x-api-key'],
            apiSecretHeader: req.headers['x-api-secret'],
            authorization: req.headers.authorization,
        });
        if (!parsed) {
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Provide X-API-Key and X-API-Secret (or Authorization: Bearer <API_KEY>:<API_SECRET>).',
            });
        }
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        const failKey = `${parsed.apiKey}::${ip}`;
        this.assertNotLocked(failKey);
        const credential = await this.prisma.apiCredential.findUnique({
            where: { apiKey: parsed.apiKey },
            include: {
                company: { select: { id: true, name: true, status: true } },
                creator: { select: { id: true, email: true, fullName: true, status: true, role: true } },
            },
        });
        const secretOk = credential ? (0, api_credential_util_1.verifyApiSecret)(parsed.apiSecret, credential.secretHash) : false;
        if (!credential || !secretOk) {
            this.recordFailure(failKey);
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Invalid API credentials.',
            });
        }
        this.failures.delete(failKey);
        if (credential.revokedAt) {
            throw new common_1.ForbiddenException({ code: 'FORBIDDEN', message: 'This API key has been revoked.' });
        }
        if (!credential.isActive) {
            throw new common_1.ForbiddenException({ code: 'FORBIDDEN', message: 'This API key is disabled.' });
        }
        if (credential.company.status !== client_1.CompanyStatus.active) {
            throw new common_1.ForbiddenException({
                code: 'FORBIDDEN',
                message: 'Company is not active for API access.',
            });
        }
        const requiredScope = this.reflector.getAllAndOverride(require_api_scope_decorator_1.API_SCOPE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (requiredScope && credential.scope !== requiredScope) {
            throw new common_1.ForbiddenException({
                code: 'FORBIDDEN',
                message: `This API key is scoped to ${credential.scope} and cannot call ${requiredScope} endpoints.`,
            });
        }
        let actor = credential.creator;
        if (!actor || actor.status !== client_1.UserStatus.active) {
            actor = await this.prisma.user.findFirst({
                where: {
                    companyId: credential.companyId,
                    status: client_1.UserStatus.active,
                    role: { in: ['client_admin', 'client_staff'] },
                },
                select: { id: true, email: true, fullName: true, status: true, role: true },
            });
        }
        if (!actor) {
            throw new common_1.ForbiddenException({
                code: 'FORBIDDEN',
                message: 'No active client user is available to own API-created orders.',
            });
        }
        const role = actor.role === 'client_staff' ? 'client_staff' : 'client_admin';
        req.user = {
            id: actor.id,
            email: actor.email,
            fullName: actor.fullName,
            role,
            companyId: credential.companyId,
            companyName: credential.company.name,
            tenantScope: 'restricted',
            authorizedCompanyIds: [credential.companyId],
        };
        req.apiCredential = {
            id: credential.id,
            scope: credential.scope,
            companyId: credential.companyId,
        };
        void this.touchLastUsed(credential.id, credential.lastUsedAt);
        return true;
    }
    assertNotLocked(failKey) {
        const row = this.failures.get(failKey);
        if (!row)
            return;
        if (Date.now() > row.resetAt) {
            this.failures.delete(failKey);
            return;
        }
        if (row.count >= FAIL_LIMIT) {
            throw new common_1.HttpException({
                code: 'TOO_MANY_REQUESTS',
                message: 'Too many invalid API credential attempts. Try again later.',
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    recordFailure(failKey) {
        const now = Date.now();
        const row = this.failures.get(failKey);
        if (!row || now > row.resetAt) {
            this.failures.set(failKey, { count: 1, resetAt: now + FAIL_WINDOW_MS });
            return;
        }
        row.count += 1;
    }
    async touchLastUsed(id, lastUsedAt) {
        if (lastUsedAt && Date.now() - lastUsedAt.getTime() < LAST_USED_MIN_INTERVAL_MS)
            return;
        try {
            await this.prisma.apiCredential.update({
                where: { id },
                data: { lastUsedAt: new Date() },
            });
        }
        catch {
        }
    }
};
exports.ApiKeyGuard = ApiKeyGuard;
exports.ApiKeyGuard = ApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.Reflector])
], ApiKeyGuard);
//# sourceMappingURL=api-key.guard.js.map