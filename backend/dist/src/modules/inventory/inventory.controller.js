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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const availability_query_dto_1 = require("./dto/availability-query.dto");
const internal_transfer_dto_1 = require("./dto/internal-transfer.dto");
const ledger_entry_query_dto_1 = require("./dto/ledger-entry-query.dto");
const stock_query_dto_1 = require("./dto/stock-query.dto");
const inventory_service_1 = require("./inventory.service");
let InventoryController = class InventoryController {
    inventory;
    constructor(inventory) {
        this.inventory = inventory;
    }
    stockByProduct(user, query) {
        return this.inventory.stockByProductSummary(user, query);
    }
    stock(user, query) {
        return this.inventory.stock(user, query);
    }
    ledgerEntry(user, query) {
        return this.inventory.ledgerEntry(user, query);
    }
    ledger(user, query) {
        return this.inventory.ledger(user, query);
    }
    availability(user, query) {
        return this.inventory.availability(user, query.productId, query.companyId);
    }
    internalTransfer(user, dto) {
        return this.inventory.internalTransfer(user, dto);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)('stock/by-product'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stock_query_dto_1.StockQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "stockByProduct", null);
__decorate([
    (0, common_1.Get)(['stock', 'current-stock']),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stock_query_dto_1.StockQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "stock", null);
__decorate([
    (0, common_1.Get)('ledger/entry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ledger_entry_query_dto_1.LedgerEntryQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "ledgerEntry", null);
__decorate([
    (0, common_1.Get)('ledger'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stock_query_dto_1.LedgerQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "ledger", null);
__decorate([
    (0, common_1.Get)('availability'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, availability_query_dto_1.AvailabilityQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "availability", null);
__decorate([
    (0, common_1.Post)('internal-transfer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, internal_transfer_dto_1.InternalTransferDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "internalTransfer", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)('inventory'),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map