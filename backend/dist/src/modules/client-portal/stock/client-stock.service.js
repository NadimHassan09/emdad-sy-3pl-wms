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
exports.ClientStockService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const inventory_service_1 = require("../../inventory/inventory.service");
let ClientStockService = class ClientStockService {
    inventory;
    prisma;
    constructor(inventory, prisma) {
        this.inventory = inventory;
        this.prisma = prisma;
    }
    async list(client, query) {
        const principal = {
            id: client.id,
            companyId: client.companyId,
            role: client.role,
            email: client.email ?? undefined,
        };
        const page = await this.inventory.stockByProductSummary(principal, {
            ...query,
            companyId: client.companyId,
        });
        const productIds = page.items.map((i) => i.productId);
        const minExpiry = await this.minExpiryDateByProduct(client.companyId, productIds);
        return {
            total: page.total,
            limit: page.limit,
            offset: page.offset,
            items: page.items.map((row) => ({
                productId: row.productId,
                productName: row.product.name,
                sku: row.product.sku,
                totalQuantity: row.totalQuantity,
                uom: row.product.uom,
                expiryDate: minExpiry.get(row.productId) ?? null,
            })),
        };
    }
    async minExpiryDateByProduct(companyId, productIds) {
        const out = new Map();
        if (productIds.length === 0)
            return out;
        const rows = await this.prisma.currentStock.findMany({
            where: {
                companyId,
                productId: { in: productIds },
                quantityOnHand: { gt: 0 },
                lotId: { not: null },
                lot: { expiryDate: { not: null } },
            },
            select: {
                productId: true,
                lot: { select: { expiryDate: true } },
            },
        });
        const best = new Map();
        for (const r of rows) {
            const exp = r.lot?.expiryDate;
            if (!exp)
                continue;
            const cur = best.get(r.productId);
            if (cur === undefined || exp < cur)
                best.set(r.productId, exp);
        }
        for (const [pid, d] of best) {
            out.set(pid, d.toISOString().slice(0, 10));
        }
        return out;
    }
};
exports.ClientStockService = ClientStockService;
exports.ClientStockService = ClientStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService,
        prisma_service_1.PrismaService])
], ClientStockService);
//# sourceMappingURL=client-stock.service.js.map