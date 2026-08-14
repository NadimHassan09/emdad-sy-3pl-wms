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
exports.ShippingConfigDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class ShippingConfigDto {
    shippingMethod;
    shippingProviderCode;
    shippingReceiverLat;
    shippingReceiverLng;
    shippingPackageType;
    shippingContents;
    shippingDeliveryType;
    shippingPickupType;
    shippingPayer;
    shippingWeightKg;
    shippingVolumeCbm;
    shippingPhoneCountry;
}
exports.ShippingConfigDto = ShippingConfigDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingMethod),
    __metadata("design:type", String)
], ShippingConfigDto.prototype, "shippingMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingProviderCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 8 }),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingReceiverLat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 8 }),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingReceiverLng", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingPackageType),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingPackageType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingContents", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingDeliveryType),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingDeliveryType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingPickupType),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingPickupType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingPayer),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingPayer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingWeightKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 6 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingVolumeCbm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ShippingConfigDto.prototype, "shippingPhoneCountry", void 0);
//# sourceMappingURL=shipping-config.dto.js.map