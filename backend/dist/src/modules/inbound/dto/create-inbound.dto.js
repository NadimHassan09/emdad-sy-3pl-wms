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
exports.CreateInboundOrderDto = exports.CreateInboundOrderLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class CreateInboundOrderLineDto {
    productId;
    expectedQuantity;
    expectedLotNumber;
    expectedExpiryDate;
}
exports.CreateInboundOrderLineDto = CreateInboundOrderLineDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateInboundOrderLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateInboundOrderLineDto.prototype, "expectedQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], CreateInboundOrderLineDto.prototype, "expectedLotNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateInboundOrderLineDto.prototype, "expectedExpiryDate", void 0);
class CreateInboundOrderDto {
    companyId;
    expectedArrivalDate;
    clientReference;
    notes;
    lines;
}
exports.CreateInboundOrderDto = CreateInboundOrderDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateInboundOrderDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateInboundOrderDto.prototype, "expectedArrivalDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateInboundOrderDto.prototype, "clientReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateInboundOrderDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateInboundOrderLineDto),
    __metadata("design:type", Array)
], CreateInboundOrderDto.prototype, "lines", void 0);
//# sourceMappingURL=create-inbound.dto.js.map