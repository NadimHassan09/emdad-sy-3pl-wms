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
exports.ListBillingPlansQueryDto = void 0;
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../common/transformers/query-transform");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
class ListBillingPlansQueryDto extends pagination_dto_1.PaginationDto {
    companyId;
    search;
    cycleStatus;
    daysRemaining;
    billingStatus;
    expiryFrom;
    expiryTo;
    sort_by;
    sort_dir;
}
exports.ListBillingPlansQueryDto = ListBillingPlansQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "search", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'renewed', 'expired', 'none']),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "cycleStatus", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['critical', 'warning', 'healthy', 'expired', 'none']),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "daysRemaining", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['operational', 'restricted', 'inactive']),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "billingStatus", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'expiryFrom must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "expiryFrom", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'expiryTo must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "expiryTo", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([
        'companyName',
        'cycleStart',
        'cycleEnd',
        'daysRemaining',
        'cycleLengthDays',
        'fixedSubscriptionFee',
        'createdAt',
    ]),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "sort_by", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['asc', 'desc']),
    __metadata("design:type", String)
], ListBillingPlansQueryDto.prototype, "sort_dir", void 0);
//# sourceMappingURL=list-billing-plans-query.dto.js.map