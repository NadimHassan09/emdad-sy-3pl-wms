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
exports.ExternalCreateOmsOrderDto = exports.ExternalOmsLineDto = exports.ExternalOmsAddressDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const is_recipient_contact_1 = require("../../../../common/validators/is-recipient-contact");
class ExternalOmsAddressDto {
    governorate;
    city;
    neighborhood;
    street;
}
exports.ExternalOmsAddressDto = ExternalOmsAddressDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalOmsAddressDto.prototype, "governorate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalOmsAddressDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalOmsAddressDto.prototype, "neighborhood", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ExternalOmsAddressDto.prototype, "street", void 0);
class ExternalOmsLineDto {
    sku;
    quantity;
    unitPrice;
}
exports.ExternalOmsLineDto = ExternalOmsLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalOmsLineDto.prototype, "sku", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Quantity must be a whole number (no decimals).' }),
    (0, class_validator_1.IsPositive)({ message: 'Quantity must be a positive whole number.' }),
    __metadata("design:type", Number)
], ExternalOmsLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Unit price must be a whole number (no decimals).' }),
    (0, class_validator_1.Min)(0, { message: 'Unit price cannot be negative.' }),
    __metadata("design:type", Number)
], ExternalOmsLineDto.prototype, "unitPrice", void 0);
class ExternalCreateOmsOrderDto {
    externalOrderId;
    requiredShipDate;
    address;
    recipientName;
    recipientPhone;
    shippingPhoneCountry;
    paymentMethod;
    currency;
    storeChannel;
    notes;
    lines;
}
exports.ExternalCreateOmsOrderDto = ExternalCreateOmsOrderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "externalOrderId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "requiredShipDate", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ExternalOmsAddressDto),
    __metadata("design:type", ExternalOmsAddressDto)
], ExternalCreateOmsOrderDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_recipient_contact_1.IsRecipientName)(),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "recipientName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, is_recipient_contact_1.IsRecipientPhone)(),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "recipientPhone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "shippingPhoneCountry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OmsPaymentMethod),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "storeChannel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExternalOmsLineDto),
    __metadata("design:type", Array)
], ExternalCreateOmsOrderDto.prototype, "lines", void 0);
//# sourceMappingURL=external-create-oms-order.dto.js.map