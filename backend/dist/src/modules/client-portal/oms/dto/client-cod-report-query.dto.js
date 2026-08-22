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
exports.ClientCodReportQueryDto = exports.CLIENT_COD_STATUS_FILTERS = void 0;
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../../common/transformers/query-transform");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
exports.CLIENT_COD_STATUS_FILTERS = [
    'pending',
    'collected',
    'remitted',
    'settled',
    'available',
    'paid_out',
];
class ClientCodReportQueryDto extends pagination_dto_1.PaginationDto {
    codStatus;
    dateFrom;
    dateTo;
    storeChannel;
}
exports.ClientCodReportQueryDto = ClientCodReportQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)([...exports.CLIENT_COD_STATUS_FILTERS]),
    __metadata("design:type", String)
], ClientCodReportQueryDto.prototype, "codStatus", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'dateFrom must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ClientCodReportQueryDto.prototype, "dateFrom", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'dateTo must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ClientCodReportQueryDto.prototype, "dateTo", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ClientCodReportQueryDto.prototype, "storeChannel", void 0);
//# sourceMappingURL=client-cod-report-query.dto.js.map