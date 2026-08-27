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
exports.ClientOmsOrdersExportDto = exports.BulkCancelClientOmsOrdersDto = exports.BulkConfirmClientOmsOrdersDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../../common/validators/is-uuid-loose");
class BulkConfirmClientOmsOrdersDto {
    ids;
}
exports.BulkConfirmClientOmsOrdersDto = BulkConfirmClientOmsOrdersDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, is_uuid_loose_1.IsUuidLoose)({ each: true }),
    __metadata("design:type", Array)
], BulkConfirmClientOmsOrdersDto.prototype, "ids", void 0);
class BulkCancelClientOmsOrdersDto {
    ids;
}
exports.BulkCancelClientOmsOrdersDto = BulkCancelClientOmsOrdersDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, is_uuid_loose_1.IsUuidLoose)({ each: true }),
    __metadata("design:type", Array)
], BulkCancelClientOmsOrdersDto.prototype, "ids", void 0);
class ClientOmsOrdersExportDto {
    columnIds;
    arabicHeaders;
    ids;
    orderSearch;
    status;
    storeChannel;
    createdFrom;
    createdTo;
}
exports.ClientOmsOrdersExportDto = ClientOmsOrdersExportDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(80),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(64, { each: true }),
    __metadata("design:type", Array)
], ClientOmsOrdersExportDto.prototype, "columnIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ClientOmsOrdersExportDto.prototype, "arabicHeaders", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, is_uuid_loose_1.IsUuidLoose)({ each: true }),
    __metadata("design:type", Array)
], ClientOmsOrdersExportDto.prototype, "ids", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ClientOmsOrdersExportDto.prototype, "orderSearch", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ClientOmsOrdersExportDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ClientOmsOrdersExportDto.prototype, "storeChannel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], ClientOmsOrdersExportDto.prototype, "createdFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], ClientOmsOrdersExportDto.prototype, "createdTo", void 0);
//# sourceMappingURL=bulk-confirm-client-oms-orders.dto.js.map