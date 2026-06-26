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
exports.ListProductHistoryQueryDto = void 0;
exports.parseOverdueOnly = parseOverdueOnly;
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../common/transformers/query-transform");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
class ListProductHistoryQueryDto extends pagination_dto_1.PaginationDto {
    companyId;
    warehouseId;
    productId;
    overdueOnly;
    lastCountedFrom;
    lastCountedTo;
}
exports.ListProductHistoryQueryDto = ListProductHistoryQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListProductHistoryQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListProductHistoryQueryDto.prototype, "warehouseId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListProductHistoryQueryDto.prototype, "productId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['true', 'false', '1', '0', 'yes']),
    __metadata("design:type", String)
], ListProductHistoryQueryDto.prototype, "overdueOnly", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'lastCountedFrom must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListProductHistoryQueryDto.prototype, "lastCountedFrom", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'lastCountedTo must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListProductHistoryQueryDto.prototype, "lastCountedTo", void 0);
function parseOverdueOnly(raw) {
    return raw === 'true' || raw === '1' || raw === 'yes';
}
//# sourceMappingURL=list-product-history-query.dto.js.map