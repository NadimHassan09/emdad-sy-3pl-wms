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
exports.ListClientOmsOrdersQueryDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../../common/transformers/query-transform");
const oms_operational_stage_1 = require("../../../oms/oms-operational-stage");
const ORDER_STATUSES = Object.values(client_1.OmsOrderStatus);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TOTAL_OPS = ['eq', 'gt', 'gte', 'lt', 'lte'];
class ListClientOmsOrdersQueryDto extends pagination_dto_1.PaginationDto {
    orderSearch;
    createdFrom;
    createdTo;
    status;
    storeChannel;
    customer;
    phone;
    city;
    carrier;
    startOrderNo;
    endOrderNo;
    totalOp;
    totalValue;
    operationalStage;
}
exports.ListClientOmsOrdersQueryDto = ListClientOmsOrdersQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "orderSearch", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'createdFrom must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "createdFrom", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'createdTo must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "createdTo", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(ORDER_STATUSES),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "status", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "storeChannel", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "customer", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "phone", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "city", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "carrier", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "startOrderNo", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "endOrderNo", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(TOTAL_OPS),
    __metadata("design:type", Object)
], ListClientOmsOrdersQueryDto.prototype, "totalOp", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d+(\.\d{1,4})?$/, {
        message: 'totalValue must be a non-negative number',
    }),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], ListClientOmsOrdersQueryDto.prototype, "totalValue", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(oms_operational_stage_1.OMS_OPERATIONAL_STAGE_VALUES),
    __metadata("design:type", Object)
], ListClientOmsOrdersQueryDto.prototype, "operationalStage", void 0);
//# sourceMappingURL=list-client-oms-orders-query.dto.js.map