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
const oms_order_events_service_1 = require("../../oms/oms-order-events.service");
const oms_orders_service_1 = require("../../oms/oms-orders.service");
let ClientOmsOrdersService = class ClientOmsOrdersService {
    prisma;
    omsOrders;
    events;
    constructor(prisma, omsOrders, events) {
        this.prisma = prisma;
        this.omsOrders = omsOrders;
        this.events = events;
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
            currency: dto.currency ?? 'SYP',
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
        const order = await this.omsOrders.findById(id, user);
        return order;
    }
    async timeline(client, id) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.omsOrders.timeline(id, user);
    }
    async codReport(client, query) {
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const where = {
            companyId: client.companyId,
            paymentMethod: 'COD',
        };
        if (query.codStatus?.trim()) {
            const status = query.codStatus.trim();
            if (Object.values(client_1.OmsCodStatus).includes(status)) {
                where.codStatus = status;
            }
        }
        if (query.dateFrom || query.dateTo) {
            const createdAt = {};
            if (query.dateFrom)
                createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
            if (query.dateTo)
                createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
            where.createdAt = createdAt;
        }
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [items, total, summary] = await Promise.all([
                tx.omsOrder.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: query.limit,
                    skip: query.offset,
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
                tx.omsOrder.count({ where }),
                tx.omsOrder.aggregate({
                    where,
                    _sum: { codAmount: true },
                    _count: { id: true },
                }),
            ]);
            return {
                items: items.map((row) => ({
                    ...row,
                    codAmount: row.codAmount?.toString() ?? null,
                })),
                total,
                limit: query.limit,
                offset: query.offset,
                summary: {
                    orderCount: summary._count.id,
                    totalCodAmount: summary._sum.codAmount?.toString() ?? '0',
                },
            };
        });
    }
};
exports.ClientOmsOrdersService = ClientOmsOrdersService;
exports.ClientOmsOrdersService = ClientOmsOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        oms_orders_service_1.OmsOrdersService,
        oms_order_events_service_1.OmsOrderEventsService])
], ClientOmsOrdersService);
//# sourceMappingURL=client-oms-orders.service.js.map