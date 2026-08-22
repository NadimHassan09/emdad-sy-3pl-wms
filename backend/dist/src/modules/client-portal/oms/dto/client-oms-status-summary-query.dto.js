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
exports.ClientOmsStatusSummaryQueryDto = void 0;
const class_validator_1 = require("class-validator");
const query_transform_1 = require("../../../../common/transformers/query-transform");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
class ClientOmsStatusSummaryQueryDto {
    createdFrom;
    createdTo;
    storeChannel;
}
exports.ClientOmsStatusSummaryQueryDto = ClientOmsStatusSummaryQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'createdFrom must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ClientOmsStatusSummaryQueryDto.prototype, "createdFrom", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'createdTo must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ClientOmsStatusSummaryQueryDto.prototype, "createdTo", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ClientOmsStatusSummaryQueryDto.prototype, "storeChannel", void 0);
//# sourceMappingURL=client-oms-status-summary-query.dto.js.map