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
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_product_dto_1 = require("./dto/create-product.dto");
const list_products_query_dto_1 = require("./dto/list-products-query.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const products_service_1 = require("./products.service");
let ProductsController = class ProductsController {
    products;
    constructor(products) {
        this.products = products;
    }
    create(user, dto) {
        return this.products.create(user, dto);
    }
    list(user, query) {
        return this.products.list(user, query);
    }
    nextSku(user, companyIdParam) {
        const companyId = companyIdParam ?? user.companyId;
        if (!companyId) {
            throw new common_1.BadRequestException('companyId is required for SKU generation.');
        }
        return this.products.nextSku(companyId);
    }
    suspend(id) {
        return this.products.suspend(id);
    }
    unsuspend(id) {
        return this.products.unsuspend(id);
    }
    hardDelete(id) {
        return this.products.removePermanentlyIfSafe(id);
    }
    listLots(id) {
        return this.products.listLotsForProduct(id);
    }
    update(id, dto) {
        return this.products.update(id, dto);
    }
    archive(id) {
        return this.products.softDelete(id);
    }
    findOne(id) {
        return this.products.findById(id);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_products_query_dto_1.ListProductsQueryDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('next-sku'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "nextSku", null);
__decorate([
    (0, common_1.Post)(':id/suspend'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "suspend", null);
__decorate([
    (0, common_1.Post)(':id/unsuspend'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "unsuspend", null);
__decorate([
    (0, common_1.Delete)(':id/hard'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "hardDelete", null);
__decorate([
    (0, common_1.Get)(':id/lots'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "listLots", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "archive", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "findOne", null);
exports.ProductsController = ProductsController = __decorate([
    (0, common_1.Controller)('products'),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map