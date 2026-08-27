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
exports.UpdateShippingDetailsDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const query_transform_1 = require("../../../common/transformers/query-transform");
class ShippingCartonLineDto {
    productId;
    quantity;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ShippingCartonLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ShippingCartonLineDto.prototype, "quantity", void 0);
class ShippingCartonDto {
    lines;
    lengthCm;
    widthCm;
    heightCm;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ShippingCartonLineDto),
    __metadata("design:type", Array)
], ShippingCartonDto.prototype, "lines", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.1),
    __metadata("design:type", Number)
], ShippingCartonDto.prototype, "lengthCm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.1),
    __metadata("design:type", Number)
], ShippingCartonDto.prototype, "widthCm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.1),
    __metadata("design:type", Number)
], ShippingCartonDto.prototype, "heightCm", void 0);
class UpdateShippingDetailsDto {
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
    babelNeighbourhoodId;
    carrier;
    trackingNumber;
    city;
    district;
    addressLine1;
    addressLine2;
    currency;
    shippingPackages;
}
exports.UpdateShippingDetailsDto = UpdateShippingDetailsDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingMethod),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingMethod", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingProviderCode", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingReceiverLat", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingReceiverLng", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingPackageType),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingPackageType", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingContents", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingDeliveryType),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingDeliveryType", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingPickupType),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingPickupType", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ShippingPayer),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingPayer", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingWeightKg", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingVolumeCbm", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(16),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingPhoneCountry", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "babelNeighbourhoodId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "carrier", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "trackingNumber", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "city", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "district", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "addressLine1", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "addressLine2", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "currency", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ShippingCartonDto),
    __metadata("design:type", Object)
], UpdateShippingDetailsDto.prototype, "shippingPackages", void 0);
//# sourceMappingURL=update-shipping-details.dto.js.map