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
exports.QuoteShippingRatesDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class QuoteShippingRatesDto {
    receiverLat;
    receiverLng;
    neighbourhoodId;
    packageType;
    weightKg;
    deliveryType;
    pickupType;
    volumeCbm;
    codAmount;
    governorate;
    city;
    neighborhood;
}
exports.QuoteShippingRatesDto = QuoteShippingRatesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], QuoteShippingRatesDto.prototype, "receiverLat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], QuoteShippingRatesDto.prototype, "receiverLng", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], QuoteShippingRatesDto.prototype, "neighbourhoodId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ShippingPackageType),
    __metadata("design:type", String)
], QuoteShippingRatesDto.prototype, "packageType", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.001),
    __metadata("design:type", Number)
], QuoteShippingRatesDto.prototype, "weightKg", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ShippingDeliveryType),
    __metadata("design:type", String)
], QuoteShippingRatesDto.prototype, "deliveryType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingPickupType),
    __metadata("design:type", String)
], QuoteShippingRatesDto.prototype, "pickupType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], QuoteShippingRatesDto.prototype, "volumeCbm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], QuoteShippingRatesDto.prototype, "codAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuoteShippingRatesDto.prototype, "governorate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuoteShippingRatesDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuoteShippingRatesDto.prototype, "neighborhood", void 0);
//# sourceMappingURL=quote-shipping-rates.dto.js.map