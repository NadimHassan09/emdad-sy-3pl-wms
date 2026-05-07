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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const INBOUND_OPEN = [
    client_1.InboundOrderStatus.draft,
    client_1.InboundOrderStatus.confirmed,
    client_1.InboundOrderStatus.in_progress,
    client_1.InboundOrderStatus.partially_received,
];
const OUTBOUND_OPEN = [
    client_1.OutboundOrderStatus.draft,
    client_1.OutboundOrderStatus.pending_stock,
    client_1.OutboundOrderStatus.confirmed,
    client_1.OutboundOrderStatus.picking,
    client_1.OutboundOrderStatus.packing,
    client_1.OutboundOrderStatus.ready_to_ship,
];
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async openOrdersCharts(user) {
        const companyWhereInbound = user.companyId
            ? { companyId: user.companyId }
            : {};
        const companyWhereOutbound = user.companyId
            ? { companyId: user.companyId }
            : {};
        const [inboundGroups, outboundGroups] = await Promise.all([
            this.prisma.inboundOrder.groupBy({
                by: ['status'],
                where: {
                    ...companyWhereInbound,
                    status: { in: INBOUND_OPEN },
                },
                _count: { _all: true },
            }),
            this.prisma.outboundOrder.groupBy({
                by: ['status'],
                where: {
                    ...companyWhereOutbound,
                    status: { in: OUTBOUND_OPEN },
                },
                _count: { _all: true },
            }),
        ]);
        const inCount = (s) => inboundGroups.find((g) => g.status === s)?._count._all ?? 0;
        const inbound = [
            {
                key: 'new',
                label: 'New',
                count: inCount(client_1.InboundOrderStatus.draft) + inCount(client_1.InboundOrderStatus.confirmed),
            },
            {
                key: 'receive',
                label: 'Receive',
                count: inCount(client_1.InboundOrderStatus.in_progress),
            },
            {
                key: 'putaway',
                label: 'Putaway',
                count: inCount(client_1.InboundOrderStatus.partially_received),
            },
        ];
        const outCount = (s) => outboundGroups.find((g) => g.status === s)?._count._all ?? 0;
        const outbound = [
            {
                key: 'picking',
                label: 'Picking',
                count: outCount(client_1.OutboundOrderStatus.draft) +
                    outCount(client_1.OutboundOrderStatus.pending_stock) +
                    outCount(client_1.OutboundOrderStatus.confirmed) +
                    outCount(client_1.OutboundOrderStatus.picking),
            },
            {
                key: 'packing',
                label: 'Packing',
                count: outCount(client_1.OutboundOrderStatus.packing),
            },
            {
                key: 'shipping',
                label: 'Shipping',
                count: outCount(client_1.OutboundOrderStatus.ready_to_ship),
            },
        ];
        return { inbound, outbound };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map