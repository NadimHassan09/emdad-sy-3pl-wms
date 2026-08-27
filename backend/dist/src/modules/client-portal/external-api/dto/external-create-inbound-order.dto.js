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
exports.ExternalCreateInboundOrderDto = exports.ExternalInboundLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class ExternalInboundLineDto {
    sku;
    quantity;
}
exports.ExternalInboundLineDto = ExternalInboundLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Product SKU is required.' }),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalInboundLineDto.prototype, "sku", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'Quantity must be a whole number (no decimals).' }),
    (0, class_validator_1.IsPositive)({ message: 'Quantity must be a positive whole number.' }),
    __metadata("design:type", Number)
], ExternalInboundLineDto.prototype, "quantity", void 0);
class ExternalCreateInboundOrderDto {
    externalOrderId;
    expectedArrivalDate;
    notes;
    lines;
}
exports.ExternalCreateInboundOrderDto = ExternalCreateInboundOrderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'externalOrderId is required.' }),
    (0, class_validator_1.MaxLength)(80),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9-]+$/, {
        message: 'externalOrderId may only contain English letters, English digits (0-9), and hyphen (-).',
    }),
    __metadata("design:type", String)
], ExternalCreateInboundOrderDto.prototype, "externalOrderId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'expectedArrivalDate is required.' }),
    __metadata("design:type", String)
], ExternalCreateInboundOrderDto.prototype, "expectedArrivalDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ExternalCreateInboundOrderDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: 'Add at least one product line.' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExternalInboundLineDto),
    __metadata("design:type", Array)
], ExternalCreateInboundOrderDto.prototype, "lines", void 0);
//# sourceMappingURL=external-create-inbound-order.dto.js.map