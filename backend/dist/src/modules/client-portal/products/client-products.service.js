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
const notifications_service_1 = require("../../notifications/notifications.service");
const products_service_1 = require("../../products/products.service");
let ClientProductsService = class ClientProductsService {
    products;
    notifications;
    constructor(products, notifications) {
        this.products = products;
        this.notifications = notifications;
    }
    principal(client) {
        return {
            id: client.id,
            companyId: client.companyId,
            role: client.role,
            email: client.email ?? undefined,
        };
    }
    async list(client, query) {
        return this.products.list(this.principal(client), {
            ...query,
            companyId: client.companyId,
        });
    }
    async create(client, dto) {
        if (client.role === client_1.UserRole.client_staff) {
            throw new common_1.ForbiddenException('Only client administrators can create products.');
        }
        const product = await this.products.create(this.principal(client), {
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
        notifications_service_1.NotificationsService])
], ClientProductsService);
//# sourceMappingURL=client-products.service.js.map