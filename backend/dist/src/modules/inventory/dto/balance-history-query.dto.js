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
exports.BalanceHistoryQueryDto = void 0;
const class_validator_1 = require("class-validator");
const query_transform_1 = require("../../../common/transformers/query-transform");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
class BalanceHistoryQueryDto {
    productId;
    companyId;
    warehouseId;
    from;
    to;
}
exports.BalanceHistoryQueryDto = BalanceHistoryQueryDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], BalanceHistoryQueryDto.prototype, "productId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], BalanceHistoryQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], BalanceHistoryQueryDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.Matches)(DAY, { message: 'from must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], BalanceHistoryQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.Matches)(DAY, { message: 'to must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], BalanceHistoryQueryDto.prototype, "to", void 0);
//# sourceMappingURL=balance-history-query.dto.js.map