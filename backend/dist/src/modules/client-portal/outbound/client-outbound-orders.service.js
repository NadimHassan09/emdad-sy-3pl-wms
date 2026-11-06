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
exports.ClientOutboundOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const audit_log_service_1 = require("../../../common/audit/audit-log.service");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../../common/prisma/tenant-rls");
const order_planning_date_1 = require("../../../common/utils/order-planning-date");
const client_order_lock_1 = require("../shared/client-order-lock");
const outbound_service_1 = require("../../outbound/outbound.service");
const client_list_outbound_query_dto_1 = require("./dto/client-list-outbound-query.dto");
function toProductImageUrl(imagePath) {
    if (!imagePath?.trim())
        return null;
    return `/media/${imagePath.replace(/^\/+/, '')}`;
}
let ClientOutboundOrdersService = class ClientOutboundOrdersService {
    outbound;
    prisma;
    audit;
    constructor(outbound, prisma, audit) {
        this.outbound = outbound;
        this.prisma = prisma;
        this.audit = audit;
    }
    async findOne(client, id) {
        const order = await this.outbound.findById(id, (0, client_auth_principal_1.clientAuthPrincipal)(client));
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
            base.statusIn = client_list_outbound_query_dto_1.CLIENT_OUTBOUND_IN_PROGRESS_STATUSES;
        }
        else if (query.status === 'shipped') {
            base.statusIn = [client_1.OutboundOrderStatus.shipped, client_1.OutboundOrderStatus.delivered];
        }
        else if (query.status) {
            base.status = query.status;
        }
        return this.outbound.list(principal, base);
    }
    async listForExport(client, query, opts) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        if (opts.ids?.length) {
            const unique = Array.from(new Set(opts.ids.map((id) => id.trim()).filter(Boolean)));
            return (0, tenant_rls_1.withTenantRls)(this.prisma, principal, async (tx) => {
                const rows = await tx.outboundOrder.findMany({
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
                                requestedQuantity: true,
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
            base.statusIn = client_list_outbound_query_dto_1.CLIENT_OUTBOUND_IN_PROGRESS_STATUSES;
        }
        else if (query.status === 'shipped') {
            base.statusIn = [client_1.OutboundOrderStatus.shipped, client_1.OutboundOrderStatus.delivered];
        }
        else if (query.status) {
            base.status = query.status;
        }
        return this.outbound.listForExport(principal, base, { maxRows: opts.maxRows });
    }
    async create(client, dto) {
        return this.outbound.create((0, client_auth_principal_1.clientAuthPrincipal)(client), { ...dto, executionMode: 'admin', executionPlan: undefined }, { pendingClientApproval: true });
    }
    async updateEditable(client, id, dto) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, principal, async (tx) => {
            const order = await tx.outboundOrder.findFirst({
                where: { id, companyId: client.companyId },
                select: { id: true, status: true, companyId: true, omsOrder: { select: { id: true } } },
            });
            if (!order)
                throw new common_1.NotFoundException('Outbound order not found.');
            if (order.omsOrder) {
                throw new common_1.BadRequestException('This order belongs to an online (OMS) order. Edit it from the OMS sheet.');
            }
            (0, client_order_lock_1.assertClientMayChangeWmsOrder)(order.status);
            if (dto.requiredShipDate)
                (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.requiredShipDate, 'Required ship date');
            return tx.outboundOrder.update({
                where: { id },
                data: {
                    destinationAddress: dto.destinationAddress,
                    requiredShipDate: dto.requiredShipDate ? new Date(dto.requiredShipDate) : undefined,
                    clientReference: dto.clientReference,
                    notes: dto.notes,
                    updatedAt: new Date(),
                },
                select: { id: true, status: true, companyId: true },
            });
        });
        await this.audit.log(this.audit.fromPrincipal(principal, {
            action: 'OUTBOUND_CLIENT_EDITED',
            resourceType: 'outbound_order',
            resourceId: updated.id,
            companyId: updated.companyId,
            newState: { status: updated.status },
        }));
        return this.findOne(client, id);
    }
    async removeUnapproved(client, id) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const order = await this.outbound.findById(id, principal);
        if (order.companyId !== client.companyId)
            throw new common_1.NotFoundException('Outbound order not found.');
        (0, client_order_lock_1.assertClientMayChangeWmsOrder)(order.status);
        await this.outbound.cancel(id, principal);
        return this.outbound.remove(id, principal);
    }
    async findByExternalReference(client, externalReference) {
        return this.outbound.findByExternalReference((0, client_auth_principal_1.clientAuthPrincipal)(client), client.companyId, externalReference);
    }
    async findByOrderNumber(client, orderNumber) {
        return this.outbound.findByOrderNumber((0, client_auth_principal_1.clientAuthPrincipal)(client), client.companyId, orderNumber);
    }
};
exports.ClientOutboundOrdersService = ClientOutboundOrdersService;
exports.ClientOutboundOrdersService = ClientOutboundOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [outbound_service_1.OutboundService,
        prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], ClientOutboundOrdersService);
//# sourceMappingURL=client-outbound-orders.service.js.map