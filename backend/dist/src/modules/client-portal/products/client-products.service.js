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
exports.ClientProductsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const inventory_service_1 = require("../../inventory/inventory.service");
const notifications_service_1 = require("../../notifications/notifications.service");
const products_service_1 = require("../../products/products.service");
let ClientProductsService = class ClientProductsService {
    products;
    notifications;
    inventory;
    prisma;
    constructor(products, notifications, inventory, prisma) {
        this.products = products;
        this.notifications = notifications;
        this.inventory = inventory;
        this.prisma = prisma;
    }
    async list(client, query) {
        return this.products.list((0, client_auth_principal_1.clientAuthPrincipal)(client), {
            ...query,
            companyId: client.companyId,
        });
    }
    async findById(client, id) {
        const principal = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const product = await this.products.findById(id, principal);
        const [agg, avail, inboundAgg, outboundAgg, earliestExpiry] = await Promise.all([
            this.prisma.currentStock.aggregate({
                where: { companyId: client.companyId, productId: id },
                _sum: { quantityOnHand: true, quantityReserved: true },
            }),
            this.inventory.availability(principal, id, client.companyId),
            this.prisma.inboundOrderLine.aggregate({
                where: { productId: id, order: { companyId: client.companyId } },
                _sum: { receivedQuantity: true },
            }),
            this.prisma.outboundOrderLine.aggregate({
                where: { productId: id, order: { companyId: client.companyId } },
                _sum: { pickedQuantity: true },
            }),
            this.prisma.currentStock.findFirst({
                where: {
                    companyId: client.companyId,
                    productId: id,
                    quantityOnHand: { gt: 0 },
                    lotId: { not: null },
                    lot: { expiryDate: { not: null } },
                },
                orderBy: { lot: { expiryDate: 'asc' } },
                select: { lot: { select: { expiryDate: true } } },
            }),
        ]);
        const onHand = agg._sum.quantityOnHand ?? new client_1.Prisma.Decimal(0);
        const reserved = agg._sum.quantityReserved ?? new client_1.Prisma.Decimal(0);
        const volumeCbm = product.volumeCbm ??
            (product.lengthCm != null && product.widthCm != null && product.heightCm != null
                ? new client_1.Prisma.Decimal(product.lengthCm)
                    .mul(product.widthCm)
                    .mul(product.heightCm)
                    .div(1_000_000)
                    .toDecimalPlaces(6)
                : null);
        return {
            id: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            description: product.description,
            uom: product.uom,
            status: product.status,
            expiryTracking: product.expiryTracking,
            minStockThreshold: product.minStockThreshold?.toString() ?? '0',
            category: null,
            categoryId: product.categoryId ?? null,
            lengthCm: product.lengthCm?.toString() ?? null,
            widthCm: product.widthCm?.toString() ?? null,
            heightCm: product.heightCm?.toString() ?? null,
            weightKg: product.weightKg?.toString() ?? null,
            volumeCbm: volumeCbm?.toString() ?? null,
            inventoryMethod: product.expiryTracking ? 'FEFO' : 'FIFO',
            createdBy: null,
            createdAt: product.createdAt.toISOString(),
            updatedAt: product.updatedAt.toISOString(),
            totalOnHand: onHand.toString(),
            totalReserved: reserved.toString(),
            totalAvailable: avail.available,
            totalInboundQuantity: (inboundAgg._sum.receivedQuantity ?? new client_1.Prisma.Decimal(0)).toString(),
            totalOutboundQuantity: (outboundAgg._sum.pickedQuantity ?? new client_1.Prisma.Decimal(0)).toString(),
            earliestExpiryDate: earliestExpiry?.lot?.expiryDate
                ? earliestExpiry.lot.expiryDate.toISOString().slice(0, 10)
                : null,
        };
    }
    async create(client, dto) {
        if (client.role === client_1.UserRole.client_staff) {
            throw new common_1.ForbiddenException('Only client administrators can create products.');
        }
        const product = await this.products.create((0, client_auth_principal_1.clientAuthPrincipal)(client), {
            ...dto,
            companyId: client.companyId,
        });
        try {
            await this.notifications.notifyAdminsClientProductAdded({
                companyId: client.companyId,
                companyName: product.company?.name ?? 'Client',
                productId: product.id,
                productSku: product.sku,
                productName: product.name,
            });
        }
        catch {
        }
        return product;
    }
};
exports.ClientProductsService = ClientProductsService;
exports.ClientProductsService = ClientProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [products_service_1.ProductsService,
        notifications_service_1.NotificationsService,
        inventory_service_1.InventoryService,
        prisma_service_1.PrismaService])
], ClientProductsService);
//# sourceMappingURL=client-products.service.js.map