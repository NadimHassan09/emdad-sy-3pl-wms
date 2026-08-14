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
exports.UpdateOmsReturnPlanDto = exports.ApproveOmsReturnDto = exports.RejectOmsReturnDto = exports.CreateOmsReturnDto = exports.CreateOmsReturnLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class CreateOmsReturnLineDto {
    productId;
    quantity;
    unitPrice;
    lotId;
}
exports.CreateOmsReturnLineDto = CreateOmsReturnLineDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOmsReturnLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateOmsReturnLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateOmsReturnLineDto.prototype, "unitPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOmsReturnLineDto.prototype, "lotId", void 0);
class CreateOmsReturnDto {
    omsOrderId;
    reason;
    notes;
    warehouseId;
    lines;
}
exports.CreateOmsReturnDto = CreateOmsReturnDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOmsReturnDto.prototype, "omsOrderId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateOmsReturnDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateOmsReturnDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOmsReturnDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateOmsReturnLineDto),
    __metadata("design:type", Array)
], CreateOmsReturnDto.prototype, "lines", void 0);
class RejectOmsReturnDto {
    reason;
}
exports.RejectOmsReturnDto = RejectOmsReturnDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RejectOmsReturnDto.prototype, "reason", void 0);
class ApproveOmsReturnDto {
    warehouseId;
}
exports.ApproveOmsReturnDto = ApproveOmsReturnDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ApproveOmsReturnDto.prototype, "warehouseId", void 0);
class UpdateOmsReturnPlanDto {
    executionMode;
    executionPlan;
    notes;
}
exports.UpdateOmsReturnPlanDto = UpdateOmsReturnPlanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['admin', 'workers']),
    __metadata("design:type", String)
], UpdateOmsReturnPlanDto.prototype, "executionMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateOmsReturnPlanDto.prototype, "executionPlan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateOmsReturnPlanDto.prototype, "notes", void 0);
//# sourceMappingURL=oms-return.dto.js.map