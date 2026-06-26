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
exports.ReviewVarianceDto = exports.ListVariancesQueryDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const query_transform_1 = require("../../../common/transformers/query-transform");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
const cycle_count_variance_constants_1 = require("../cycle-count-variance.constants");
const STATUSES = Object.values(client_1.CycleCountVarianceStatus);
class ListVariancesQueryDto {
    companyId;
    cycleCountId;
    status;
}
exports.ListVariancesQueryDto = ListVariancesQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListVariancesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListVariancesQueryDto.prototype, "cycleCountId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(STATUSES),
    __metadata("design:type", String)
], ListVariancesQueryDto.prototype, "status", void 0);
class ReviewVarianceDto {
    action;
    reasonCode;
    reviewNotes;
}
exports.ReviewVarianceDto = ReviewVarianceDto;
__decorate([
    (0, class_validator_1.IsIn)(['approve', 'reject']),
    __metadata("design:type", String)
], ReviewVarianceDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...cycle_count_variance_constants_1.VARIANCE_REASON_CODES]),
    __metadata("design:type", Object)
], ReviewVarianceDto.prototype, "reasonCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 2000),
    __metadata("design:type", String)
], ReviewVarianceDto.prototype, "reviewNotes", void 0);
//# sourceMappingURL=variance.dto.js.map