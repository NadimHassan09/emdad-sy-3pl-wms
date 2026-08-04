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
exports.UpdateCodStatusDto = exports.CreateCodAdjustmentDto = exports.ListCodRecordsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../common/transformers/query-transform");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class ListCodRecordsQueryDto extends pagination_dto_1.PaginationDto {
    companyId;
    status;
    omsOrderId;
}
exports.ListCodRecordsQueryDto = ListCodRecordsQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListCodRecordsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CodRecordStatus),
    __metadata("design:type", String)
], ListCodRecordsQueryDto.prototype, "status", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListCodRecordsQueryDto.prototype, "omsOrderId", void 0);
class CreateCodAdjustmentDto {
    amount;
    reason;
}
exports.CreateCodAdjustmentDto = CreateCodAdjustmentDto;
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    __metadata("design:type", Number)
], CreateCodAdjustmentDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateCodAdjustmentDto.prototype, "reason", void 0);
class UpdateCodStatusDto {
    status;
}
exports.UpdateCodStatusDto = UpdateCodStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CodRecordStatus),
    __metadata("design:type", String)
], UpdateCodStatusDto.prototype, "status", void 0);
//# sourceMappingURL=cod.dto.js.map