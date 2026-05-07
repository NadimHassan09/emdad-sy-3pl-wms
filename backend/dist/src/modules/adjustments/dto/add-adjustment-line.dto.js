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
exports.AddAdjustmentLineDto = void 0;
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class AddAdjustmentLineDto {
    productId;
    locationId;
    lotId;
    quantityAfter;
}
exports.AddAdjustmentLineDto = AddAdjustmentLineDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], AddAdjustmentLineDto.prototype, "productId", void 0);
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], AddAdjustmentLineDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], AddAdjustmentLineDto.prototype, "lotId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AddAdjustmentLineDto.prototype, "quantityAfter", void 0);
//# sourceMappingURL=add-adjustment-line.dto.js.map