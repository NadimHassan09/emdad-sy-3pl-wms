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
const products_service_1 = require("../../products/products.service");
let ClientProductsService = class ClientProductsService {
    products;
    constructor(products) {
        this.products = products;
    }
    async list(client, query) {
        const principal = {
            id: client.id,
            companyId: client.companyId,
            role: client.role,
            email: client.email ?? undefined,
        };
        return this.products.list(principal, {
            ...query,
            companyId: client.companyId,
        });
    }
};
exports.ClientProductsService = ClientProductsService;
exports.ClientProductsService = ClientProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ClientProductsService);
//# sourceMappingURL=client-products.service.js.map