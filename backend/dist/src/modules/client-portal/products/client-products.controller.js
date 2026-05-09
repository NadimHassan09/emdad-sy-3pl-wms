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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientProductsController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const list_products_query_dto_1 = require("../../products/dto/list-products-query.dto");
const client_products_service_1 = require("./client-products.service");
let ClientProductsController = class ClientProductsController {
    products;
    constructor(products) {
        this.products = products;
    }
    list(client, query) {
        return this.products.list(client, query);
    }
};
exports.ClientProductsController = ClientProductsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_products_query_dto_1.ListProductsQueryDto]),
    __metadata("design:returntype", void 0)
], ClientProductsController.prototype, "list", null);
exports.ClientProductsController = ClientProductsController = __decorate([
    (0, common_1.Controller)('client/products'),
    __metadata("design:paramtypes", [client_products_service_1.ClientProductsService])
], ClientProductsController);
//# sourceMappingURL=client-products.controller.js.map