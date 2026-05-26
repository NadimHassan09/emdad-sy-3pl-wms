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
exports.CompanyAccessService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GLOBAL_TENANT_ROLES = new Set([
    client_1.UserRole.super_admin,
    client_1.UserRole.wh_manager,
    client_1.UserRole.finance,
]);
let CompanyAccessService = class CompanyAccessService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolvePrincipalTenant(userId, role, requestedCompanyId) {
        const membership = await this.loadMembership(userId, role);
        const requested = this.normalizeCompanyId(requestedCompanyId);
        if (requested) {
            await this.assertCompanyExists(requested);
            this.assertMembershipIncludes(membership, requested);
            return {
                ...membership,
                activeCompanyId: requested,
            };
        }
        if (membership.mode === 'restricted' && membership.companyIds.length === 1) {
            return {
                ...membership,
                activeCompanyId: membership.companyIds[0],
            };
        }
        return { ...membership, activeCompanyId: null };
    }
    enrichPrincipal(base, scope) {
        return {
            ...base,
            companyId: scope.activeCompanyId,
            tenantScope: scope.mode,
            authorizedCompanyIds: scope.companyIds,
        };
    }
    getAuthorizedCompanyScope(user) {
        return {
            mode: user.tenantScope,
            activeCompanyId: user.companyId,
            companyIds: [...user.authorizedCompanyIds],
        };
    }
    assertCompanyAccess(user, companyId) {
        const id = this.normalizeCompanyId(companyId);
        if (!id) {
            throw new common_1.BadRequestException('companyId is required.');
        }
        if (user.tenantScope === 'all') {
            return;
        }
        if (!user.authorizedCompanyIds.includes(id)) {
            throw new common_1.NotFoundException('Resource not found.');
        }
    }
    assertSameCompany(user, resourceCompanyId) {
        this.assertCompanyAccess(user, resourceCompanyId);
        if (user.companyId && resourceCompanyId !== user.companyId) {
            throw new common_1.NotFoundException('Resource not found.');
        }
    }
    validateResourceOwnership(user, resource) {
        this.assertSameCompany(user, resource.companyId);
    }
    resolveWriteCompanyId(user, bodyCompanyId) {
        const requested = this.normalizeCompanyId(bodyCompanyId);
        const effective = requested ?? user.companyId;
        if (!effective) {
            throw new common_1.BadRequestException('companyId is required (select an authorized client tenant for this session).');
        }
        this.assertCompanyAccess(user, effective);
        if (requested && user.companyId && requested !== user.companyId) {
            throw new common_1.ForbiddenException('companyId does not match the active tenant for this session.');
        }
        return effective;
    }
    getReadFilterCompanyId(user, queryCompanyId) {
        const q = this.normalizeCompanyId(queryCompanyId);
        if (q) {
            this.assertCompanyAccess(user, q);
            return q;
        }
        if (user.tenantScope === 'all') {
            return undefined;
        }
        return user.companyId ?? undefined;
    }
    requireActiveTenant(user, message) {
        if (!user.companyId) {
            throw new common_1.BadRequestException(message ?? 'An active client tenant is required for this operation.');
        }
        this.assertCompanyAccess(user, user.companyId);
        return user.companyId;
    }
    async loadMembership(userId, role) {
        if (GLOBAL_TENANT_ROLES.has(role)) {
            return { mode: 'all', companyIds: [] };
        }
        if (role === client_1.UserRole.wh_operator) {
            const [grants, worker] = await Promise.all([
                this.prisma.userCompanyAccess.findMany({
                    where: { userId },
                    select: { companyId: true },
                }),
                this.prisma.worker.findUnique({
                    where: { userId },
                    select: { companyId: true, status: true },
                }),
            ]);
            const companyIds = new Set(grants.map((g) => g.companyId));
            if (worker?.status === 'active' && worker.companyId) {
                companyIds.add(worker.companyId);
            }
            return {
                mode: 'restricted',
                companyIds: [...companyIds],
            };
        }
        return { mode: 'restricted', companyIds: [] };
    }
    assertMembershipIncludes(membership, companyId) {
        if (membership.mode === 'all') {
            return;
        }
        if (!membership.companyIds.includes(companyId)) {
            throw new common_1.ForbiddenException('You do not have access to this company.');
        }
    }
    async assertCompanyExists(companyId) {
        const exists = await this.prisma.company.count({
            where: { id: companyId, status: 'active' },
        });
        if (!exists) {
            throw new common_1.NotFoundException('Company not found.');
        }
    }
    normalizeCompanyId(value) {
        if (value == null)
            return undefined;
        const v = value.trim();
        if (!v)
            return undefined;
        if (!UUID_RE.test(v)) {
            throw new common_1.BadRequestException('companyId must be a valid UUID.');
        }
        return v.toLowerCase();
    }
};
exports.CompanyAccessService = CompanyAccessService;
exports.CompanyAccessService = CompanyAccessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompanyAccessService);
//# sourceMappingURL=company-access.service.js.map