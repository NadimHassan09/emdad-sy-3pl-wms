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
exports.UpdateProductDto = void 0;
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class UpdateProductDto {
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
exports.UpdateProductDto = UpdateProductDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductDto.prototype, "expiryTracking", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "sku", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "barcode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ProductUom),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "uom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "minStockThreshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === null)
            return null;
        if (value === undefined || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined && v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.99),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "lengthCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === null)
            return null;
        if (value === undefined || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined && v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.99),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "widthCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === null)
            return null;
        if (value === undefined || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined && v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.99),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "heightCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === null)
            return null;
        if (value === undefined || value === '')
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }),
    (0, class_validator_1.ValidateIf)((_, v) => v !== undefined && v !== null),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999999.9999),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "weightKg", void 0);
//# sourceMappingURL=update-product.dto.js.map