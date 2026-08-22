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
exports.CreateClientOmsOrderDto = exports.CreateClientOmsOrderLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const is_uuid_loose_1 = require("../../../../common/validators/is-uuid-loose");
const is_recipient_contact_1 = require("../../../../common/validators/is-recipient-contact");
class CreateClientOmsOrderLineDto {
    productId;
    requestedQuantity;
    unitPrice;
}
exports.CreateClientOmsOrderLineDto = CreateClientOmsOrderLineDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateClientOmsOrderLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Requested quantity must be a whole number (no decimals).' }),
    (0, class_validator_1.IsPositive)({ message: 'Requested quantity must be a positive whole number greater than zero.' }),
    __metadata("design:type", Number)
], CreateClientOmsOrderLineDto.prototype, "requestedQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Unit price must be a whole number (no decimals).' }),
    (0, class_validator_1.Min)(0, { message: 'Unit price cannot be negative.' }),
    __metadata("design:type", Number)
], CreateClientOmsOrderLineDto.prototype, "unitPrice", void 0);
class CreateClientOmsOrderDto {
    requiredShipDate;
    recipientName;
    recipientPhone;
    shippingPhoneCountry;
    city;
    district;
    addressLine1;
    addressLine2;
    shippingReceiverLat;
    shippingReceiverLng;
    babelNeighbourhoodId;
    notes;
    storeChannel;
    paymentMethod;
    currency;
    lines;
}
exports.CreateClientOmsOrderDto = CreateClientOmsOrderDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "requiredShipDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Recipient name is required.' }),
    (0, is_recipient_contact_1.IsRecipientName)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "recipientName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Recipient phone is required.' }),
    (0, is_recipient_contact_1.IsRecipientPhone)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "recipientPhone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "shippingPhoneCountry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Governorate is required.' }),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'City/Region is required.' }),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "district", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Town/Neighborhood is required.' }),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "addressLine1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "addressLine2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 8 }),
    __metadata("design:type", Number)
], CreateClientOmsOrderDto.prototype, "shippingReceiverLat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 8 }),
    __metadata("design:type", Number)
], CreateClientOmsOrderDto.prototype, "shippingReceiverLng", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateClientOmsOrderDto.prototype, "babelNeighbourhoodId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "storeChannel", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OmsPaymentMethod),
    (0, class_validator_1.IsNotEmpty)({ message: 'Payment method is required.' }),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClientOmsOrderDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateClientOmsOrderLineDto),
    __metadata("design:type", Array)
], CreateClientOmsOrderDto.prototype, "lines", void 0);
//# sourceMappingURL=create-client-oms-order.dto.js.map