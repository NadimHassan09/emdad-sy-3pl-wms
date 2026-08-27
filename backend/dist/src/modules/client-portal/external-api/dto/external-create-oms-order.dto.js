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
    (0, class_validator_1.IsNotEmpty)({ message: 'Governorate is required.' }),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalOmsAddressDto.prototype, "governorate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'City is required.' }),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalOmsAddressDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Neighborhood is required.' }),
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
    (0, class_validator_1.IsNotEmpty)({ message: 'Product SKU is required.' }),
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
    countryCode;
    recipientPhone;
    paymentMethod;
    storeChannel;
    notes;
    lines;
}
exports.ExternalCreateOmsOrderDto = ExternalCreateOmsOrderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'externalOrderId is required.' }),
    (0, class_validator_1.MaxLength)(80),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9-]+$/, {
        message: 'externalOrderId may only contain English letters, English digits (0-9), and hyphen (-).',
    }),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "externalOrderId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'requiredShipDate is required.' }),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "requiredShipDate", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ExternalOmsAddressDto),
    __metadata("design:type", ExternalOmsAddressDto)
], ExternalCreateOmsOrderDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Recipient name is required.' }),
    (0, is_recipient_contact_1.IsRecipientName)(),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "recipientName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'countryCode is required.' }),
    (0, class_validator_1.Matches)(/^[0-9]+$/, {
        message: 'countryCode must be English digits only (example: 963). Do not include +, letters, or symbols.',
    }),
    (0, class_validator_1.MaxLength)(8),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "countryCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Recipient phone is required.' }),
    (0, class_validator_1.Matches)(/^[0-9]+$/, {
        message: 'recipientPhone must be English digits only (no +, spaces, letters, or symbols).',
    }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "recipientPhone", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value),
    (0, class_validator_1.IsEnum)(client_1.OmsPaymentMethod, {
        message: 'paymentMethod must be exactly one of: COD, Prepaid, or Credit.',
    }),
    __metadata("design:type", String)
], ExternalCreateOmsOrderDto.prototype, "paymentMethod", void 0);
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