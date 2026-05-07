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
exports.CreateProductDto = void 0;
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class CreateProductDto {
    companyId;
    expiryTracking;
    name;
    sku;
    barcode;
    description;
    uom;
    minStockThreshold;
    lengthCm;
    widthCm;
    heightCm;
    weightKg;
}
exports.CreateProductDto = CreateProductDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateProductDto.prototype, "expiryTracking", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], CreateProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], CreateProductDto.prototype, "sku", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateProductDto.prototype, "barcode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], CreateProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ProductUom),
    __metadata("design:type", String)
], CreateProductDto.prototype, "uom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "minStockThreshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === undefined || value === null || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.99),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "lengthCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === undefined || value === null || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.99),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "widthCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === undefined || value === null || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.99),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "heightCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === undefined || value === null || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.9999),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "weightKg", void 0);
//# sourceMappingURL=create-product.dto.js.map