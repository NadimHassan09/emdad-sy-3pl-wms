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
exports.ClientStockController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const stock_query_dto_1 = require("../../inventory/dto/stock-query.dto");
const client_stock_service_1 = require("./client-stock.service");
let ClientStockController = class ClientStockController {
    stock;
    constructor(stock) {
        this.stock = stock;
    }
    list(client, query) {
        return this.stock.list(client, query);
    }
};
exports.ClientStockController = ClientStockController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stock_query_dto_1.StockQueryDto]),
    __metadata("design:returntype", void 0)
], ClientStockController.prototype, "list", null);
exports.ClientStockController = ClientStockController = __decorate([
    (0, common_1.Controller)('client/stock'),
    __metadata("design:paramtypes", [client_stock_service_1.ClientStockService])
], ClientStockController);
//# sourceMappingURL=client-stock.controller.js.map