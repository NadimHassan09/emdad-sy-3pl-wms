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
const client_1 = require("@prisma/client");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const audit_log_service_1 = require("../../../common/audit/audit-log.service");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../../common/prisma/tenant-rls");
const order_planning_date_1 = require("../../../common/utils/order-planning-date");
const client_order_lock_1 = require("../shared/client-order-lock");
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
    audit;
    constructor(inbound, prisma, audit) {
        this.inbound = inbound;
        this.prisma = prisma;
        this.audit = audit;
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
                        lines: {
                            orderBy: { lineNumber: 'asc' },
                            select: {
                                expectedQuantity: true,
                                product: { select: { name: true, weightKg: true } },
                            },
                        },
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
    async updateEditable(client, id, dto) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, principal, async (tx) => {
            const order = await tx.inboundOrder.findFirst({
                where: { id, companyId: client.companyId },
                select: { id: true, status: true, companyId: true },
            });
            if (!order)
                throw new common_1.NotFoundException('Inbound order not found.');
            (0, client_order_lock_1.assertClientMayChangeWmsOrder)(order.status);
            if (dto.expectedArrivalDate) {
                (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.expectedArrivalDate, 'Expected arrival date');
            }
            if (dto.lines) {
                const ids = dto.lines.map((l) => l.productId);
                if (new Set(ids).size !== ids.length) {
                    throw new common_1.BadRequestException('Each product can only appear once in an order.');
                }
                const products = await tx.product.findMany({
                    where: { id: { in: ids }, companyId: client.companyId },
                    select: { id: true },
                });
                if (products.length !== ids.length) {
                    throw new common_1.BadRequestException('One or more products were not found for your company.');
                }
                await tx.inboundOrderLine.deleteMany({ where: { inboundOrderId: id } });
                await tx.inboundOrderLine.createMany({
                    data: dto.lines.map((l, idx) => ({
                        inboundOrderId: id,
                        productId: l.productId,
                        expectedQuantity: new client_1.Prisma.Decimal(l.expectedQuantity),
                        expectedLotNumber: l.expectedLotNumber?.trim() || null,
                        expectedExpiryDate: l.expectedExpiryDate ? new Date(l.expectedExpiryDate) : null,
                        lineNumber: idx + 1,
                    })),
                });
            }
            return tx.inboundOrder.update({
                where: { id },
                data: {
                    expectedArrivalDate: dto.expectedArrivalDate ? new Date(dto.expectedArrivalDate) : undefined,
                    clientReference: dto.clientReference,
                    notes: dto.notes,
                    updatedAt: new Date(),
                },
                select: { id: true, orderNumber: true, status: true, companyId: true },
            });
        });
        await this.audit.log(this.audit.fromPrincipal(principal, {
            action: 'INBOUND_CLIENT_EDITED',
            resourceType: 'inbound_order',
            resourceId: updated.id,
            companyId: updated.companyId,
            newState: { status: updated.status, linesReplaced: !!dto.lines },
        }));
        return this.findOne(client, id);
    }
    async removeUnapproved(client, id) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const order = await this.inbound.findById(id, principal);
        if (order.companyId !== client.companyId)
            throw new common_1.NotFoundException('Inbound order not found.');
        (0, client_order_lock_1.assertClientMayChangeWmsOrder)(order.status);
        await this.inbound.cancel(id, principal);
        return this.inbound.remove(id, principal);
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
        prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], ClientInboundOrdersService);
//# sourceMappingURL=client-inbound-orders.service.js.map