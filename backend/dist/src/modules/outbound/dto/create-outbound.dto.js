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
exports.CreateOutboundOrderDto = exports.CreateOutboundOrderLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class CreateOutboundOrderLineDto {
    productId;
    requestedQuantity;
    specificLotId;
}
exports.CreateOutboundOrderLineDto = CreateOutboundOrderLineDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOutboundOrderLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateOutboundOrderLineDto.prototype, "requestedQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOutboundOrderLineDto.prototype, "specificLotId", void 0);
class CreateOutboundOrderDto {
    companyId;
    destinationAddress;
    requiredShipDate;
    carrier;
    clientReference;
    notes;
    lines;
}
exports.CreateOutboundOrderDto = CreateOutboundOrderDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOutboundOrderDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOutboundOrderDto.prototype, "destinationAddress", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateOutboundOrderDto.prototype, "requiredShipDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOutboundOrderDto.prototype, "carrier", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOutboundOrderDto.prototype, "clientReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOutboundOrderDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateOutboundOrderLineDto),
    __metadata("design:type", Array)
], CreateOutboundOrderDto.prototype, "lines", void 0);
//# sourceMappingURL=create-outbound.dto.js.map