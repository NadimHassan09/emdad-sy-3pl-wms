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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateReturnOrderLineDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class CreateReturnOrderLineDto {
    productId;
    expectedQuantity;
    outboundOrderLineId;
    packageId;
    lotId;
    condition;
    disposition;
}
exports.CreateReturnOrderLineDto = CreateReturnOrderLineDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateReturnOrderLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateReturnOrderLineDto.prototype, "expectedQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateReturnOrderLineDto.prototype, "outboundOrderLineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateReturnOrderLineDto.prototype, "packageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateReturnOrderLineDto.prototype, "lotId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ReturnItemCondition),
    __metadata("design:type", typeof (_a = typeof client_1.ReturnItemCondition !== "undefined" && client_1.ReturnItemCondition) === "function" ? _a : Object)
], CreateReturnOrderLineDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ReturnItemDisposition),
    __metadata("design:type", typeof (_b = typeof client_1.ReturnItemDisposition !== "undefined" && client_1.ReturnItemDisposition) === "function" ? _b : Object)
], CreateReturnOrderLineDto.prototype, "disposition", void 0);
//# sourceMappingURL=create-return-order-line.dto.js.map