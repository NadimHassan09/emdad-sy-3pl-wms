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
exports.ListProductsQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../common/transformers/query-transform");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
function QueryTrimmedString() {
    return (0, class_transformer_1.Transform)(({ value }) => {
        if (value === undefined || value === null || value === '')
            return undefined;
        if (typeof value !== 'string')
            return value;
        const t = value.trim();
        return t === '' ? undefined : t;
    });
}
class ListProductsQueryDto extends pagination_dto_1.PaginationDto {
    companyId;
    search;
    productName;
    sku;
    productBarcode;
    includeArchived;
}
exports.ListProductsQueryDto = ListProductsQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "search", void 0);
__decorate([
    QueryTrimmedString(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "productName", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "sku", void 0);
__decorate([
    QueryTrimmedString(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "productBarcode", void 0);
__decorate([
    (0, query_transform_1.QueryBoolOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ListProductsQueryDto.prototype, "includeArchived", void 0);
//# sourceMappingURL=list-products-query.dto.js.map