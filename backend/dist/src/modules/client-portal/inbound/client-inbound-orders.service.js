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
exports.ClientInboundOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../../common/prisma/tenant-rls");
const inbound_service_1 = require("../../inbound/inbound.service");
const client_list_inbound_query_dto_1 = require("./dto/client-list-inbound-query.dto");
function toProductImageUrl(imagePath) {
    if (!imagePath?.trim())
        return null;
    return `/media/${imagePath.replace(/^\/+/, '')}`;
}
let ClientInboundOrdersService = class ClientInboundOrdersService {
    inbound;
    prisma;
    constructor(inbound, prisma) {
        this.inbound = inbound;
        this.prisma = prisma;
    }
    async findOne(client, id) {
        const order = await this.inbound.findById(id, (0, client_auth_principal_1.clientAuthPrincipal)(client));
        return {
            ...order,
            lines: order.lines.map((line) => ({
                ...line,
                product: {
                    ...line.product,
                    imageUrl: toProductImageUrl(line.product.imagePath),
                },
            })),
        };
    }
    async list(client, query) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const base = {
            limit: query.limit,
            offset: query.offset,
            orderSearch: query.orderSearch,
            companyId: client.companyId,
        };
        if (query.status === 'in_progress') {
            base.statusIn = client_list_inbound_query_dto_1.CLIENT_INBOUND_IN_PROGRESS_STATUSES;
        }
        else if (query.status) {
            base.status = query.status;
        }
        return this.inbound.list(principal, base);
    }
    async listForExport(client, query, opts) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        if (opts.ids?.length) {
            const unique = Array.from(new Set(opts.ids.map((id) => id.trim()).filter(Boolean)));
            return (0, tenant_rls_1.withTenantRls)(this.prisma, principal, async (tx) => {
                const rows = await tx.inboundOrder.findMany({
                    where: {
                        companyId: client.companyId,
                        id: { in: unique.slice(0, opts.maxRows) },
                    },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        company: { select: { id: true, name: true } },
                        lines: { select: { expectedQuantity: true } },
                    },
                });
                return {
                    items: rows,
                    total: rows.length,
                    truncated: unique.length > rows.length,
                };
            });
        }
        const base = {
            orderSearch: query.orderSearch,
            companyId: client.companyId,
            limit: opts.maxRows,
            offset: 0,
        };
        if (query.status === 'in_progress') {
            base.statusIn = client_list_inbound_query_dto_1.CLIENT_INBOUND_IN_PROGRESS_STATUSES;
        }
        else if (query.status) {
            base.status = query.status;
        }
        return this.inbound.listForExport(principal, base, { maxRows: opts.maxRows });
    }
    async create(client, dto) {
        return this.inbound.create((0, client_auth_principal_1.clientAuthPrincipal)(client), { ...dto, executionMode: 'admin', executionPlan: undefined }, { pendingClientApproval: true });
    }
    async findByExternalReference(client, externalReference) {
        return this.inbound.findByExternalReference((0, client_auth_principal_1.clientAuthPrincipal)(client), client.companyId, externalReference);
    }
    async findByOrderNumber(client, orderNumber) {
        return this.inbound.findByOrderNumber((0, client_auth_principal_1.clientAuthPrincipal)(client), client.companyId, orderNumber);
    }
};
exports.ClientInboundOrdersService = ClientInboundOrdersService;
exports.ClientInboundOrdersService = ClientInboundOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [inbound_service_1.InboundService,
        prisma_service_1.PrismaService])
], ClientInboundOrdersService);
//# sourceMappingURL=client-inbound-orders.service.js.map