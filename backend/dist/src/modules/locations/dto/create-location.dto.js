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
exports.CreateLocationDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class CreateLocationDto {
    warehouseId;
    parentId;
    name;
    type;
    barcode;
    maxWeightKg;
    maxCbm;
}
exports.CreateLocationDto = CreateLocationDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateLocationDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateLocationDto.prototype, "parentId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], CreateLocationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.LocationType),
    __metadata("design:type", String)
], CreateLocationDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], CreateLocationDto.prototype, "barcode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateLocationDto.prototype, "maxWeightKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 6 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateLocationDto.prototype, "maxCbm", void 0);
//# sourceMappingURL=create-location.dto.js.map