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
exports.ClientOmsOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../../common/prisma/tenant-rls");
const oms_orders_service_1 = require("../../oms/oms-orders.service");
function portalCodStatusFromRecord(status) {
    switch (status) {
        case client_1.CodRecordStatus.available:
            return client_1.OmsCodStatus.collected;
        case client_1.CodRecordStatus.paid_out:
            return client_1.OmsCodStatus.remitted;
        case client_1.CodRecordStatus.pending:
        default:
            return client_1.OmsCodStatus.pending;
    }
}
function matchesPortalCodFilter(portalStatus, filter) {
    if (!filter?.trim())
        return true;
    const f = filter.trim();
    if (f === 'settled')
        return portalStatus === client_1.OmsCodStatus.remitted;
    if (f === 'available')
        return portalStatus === client_1.OmsCodStatus.collected;
    if (f === 'paid_out')
        return portalStatus === client_1.OmsCodStatus.remitted;
    return portalStatus === f;
}
let ClientOmsOrdersService = class ClientOmsOrdersService {
    prisma;
    omsOrders;
    constructor(prisma, omsOrders) {
        this.prisma = prisma;
        this.omsOrders = omsOrders;
    }
    async list(client, query) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const scoped = {
            ...query,
            companyId: client.companyId,
        };
        return this.omsOrders.list(user, scoped);
    }
    async create(client, dto) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const payload = {
            companyId: client.companyId,
            requiredShipDate: dto.requiredShipDate,
            recipientName: dto.recipientName,
            recipientPhone: dto.recipientPhone,
            city: dto.city,
            district: dto.district,
            addressLine1: dto.addressLine1,
            notes: dto.notes,
            storeChannel: dto.storeChannel,
            paymentMethod: dto.paymentMethod,
            currency: dto.currency ?? 'USD',
            lines: dto.lines.map((l) => ({
                productId: l.productId,
                requestedQuantity: l.requestedQuantity,
                unitPrice: l.unitPrice,
                lineTotal: l.unitPrice != null ? l.unitPrice * l.requestedQuantity : undefined,
            })),
        };
        return this.omsOrders.create(user, payload);
    }
    async findOne(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.findById(id, user);
    }
    async timeline(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.timeline(id, user);
    }
    async codReport(client, query) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const createdAt = query.dateFrom || query.dateTo
            ? {
                ...(query.dateFrom
                    ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
                    : {}),
                ...(query.dateTo
                    ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) }
                    : {}),
            }
            : undefined;
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [codRecords, legacyOrders] = await Promise.all([
                tx.codRecord.findMany({
                    where: {
                        companyId: client.companyId,
                        ...(createdAt
                            ? {
                                omsOrder: {
                                    paymentMethod: 'COD',
                                    createdAt,
                                    ...(query.storeChannel?.trim()
                                        ? {
                                            storeChannel: {
                                                contains: query.storeChannel.trim(),
                                                mode: 'insensitive',
                                            },
                                        }
                                        : {}),
                                },
                            }
                            : {
                                omsOrder: {
                                    paymentMethod: 'COD',
                                    ...(query.storeChannel?.trim()
                                        ? {
                                            storeChannel: {
                                                contains: query.storeChannel.trim(),
                                                mode: 'insensitive',
                                            },
                                        }
                                        : {}),
                                },
                            }),
                    },
                    include: {
                        adjustments: { select: { amount: true } },
                        omsOrder: {
                            select: {
                                id: true,
                                orderNumber: true,
                                status: true,
                                recipientName: true,
                                currency: true,
                                createdAt: true,
                                deliveredAt: true,
                                storeChannel: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                tx.omsOrder.findMany({
                    where: {
                        companyId: client.companyId,
                        paymentMethod: 'COD',
                        codRecord: null,
                        ...(createdAt ? { createdAt } : {}),
                        ...(query.storeChannel?.trim()
                            ? {
                                storeChannel: {
                                    contains: query.storeChannel.trim(),
                                    mode: 'insensitive',
                                },
                            }
                            : {}),
                    },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        recipientName: true,
                        codAmount: true,
                        codStatus: true,
                        codCollectedAt: true,
                        codRemittedAt: true,
                        currency: true,
                        createdAt: true,
                        deliveredAt: true,
                    },
                }),
            ]);
            const rows = [];
            for (const rec of codRecords) {
                const adjSum = rec.adjustments.reduce((s, a) => s.add(a.amount), new client_1.Prisma.Decimal(0));
                const current = rec.originalAmount.add(adjSum);
                const portalStatus = portalCodStatusFromRecord(rec.status);
                rows.push({
                    id: rec.omsOrder.id,
                    orderNumber: rec.omsOrder.orderNumber,
                    status: rec.omsOrder.status,
                    recipientName: rec.omsOrder.recipientName,
                    codAmount: current.toString(),
                    codStatus: portalStatus,
                    codCollectedAt: rec.availableAt,
                    codRemittedAt: rec.paidOutAt,
                    currency: rec.currency ?? rec.omsOrder.currency,
                    createdAt: rec.omsOrder.createdAt,
                    deliveredAt: rec.omsOrder.deliveredAt,
                    codRecordId: rec.id,
                });
            }
            for (const order of legacyOrders) {
                rows.push({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    recipientName: order.recipientName,
                    codAmount: order.codAmount?.toString() ?? null,
                    codStatus: order.codStatus,
                    codCollectedAt: order.codCollectedAt,
                    codRemittedAt: order.codRemittedAt,
                    currency: order.currency,
                    createdAt: order.createdAt,
                    deliveredAt: order.deliveredAt,
                });
            }
            const filtered = rows.filter((r) => matchesPortalCodFilter(r.codStatus, query.codStatus));
            filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            const total = filtered.length;
            const page = filtered.slice(query.offset, query.offset + query.limit);
            const totalCodAmount = filtered.reduce((sum, r) => {
                const n = Number(r.codAmount);
                return sum + (Number.isFinite(n) ? n : 0);
            }, 0);
            return {
                items: page,
                total,
                limit: query.limit,
                offset: query.offset,
                summary: {
                    orderCount: total,
                    totalCodAmount: String(totalCodAmount),
                },
            };
        });
    }
};
exports.ClientOmsOrdersService = ClientOmsOrdersService;
exports.ClientOmsOrdersService = ClientOmsOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        oms_orders_service_1.OmsOrdersService])
], ClientOmsOrdersService);
//# sourceMappingURL=client-oms-orders.service.js.map