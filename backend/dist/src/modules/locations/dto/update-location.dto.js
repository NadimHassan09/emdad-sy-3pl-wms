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
exports.UpdateLocationDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class UpdateLocationDto {
    name;
    type;
    barcode;
    sortOrder;
    status;
    maxWeightKg;
    maxCbm;
    maxPalletPositions;
}
exports.UpdateLocationDto = UpdateLocationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], UpdateLocationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.LocationType),
    __metadata("design:type", String)
], UpdateLocationDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], UpdateLocationDto.prototype, "barcode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateLocationDto.prototype, "sortOrder", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.LocationStatus),
    __metadata("design:type", String)
], UpdateLocationDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateLocationDto.prototype, "maxWeightKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 6 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateLocationDto.prototype, "maxCbm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateLocationDto.prototype, "maxPalletPositions", void 0);
//# sourceMappingURL=update-location.dto.js.map