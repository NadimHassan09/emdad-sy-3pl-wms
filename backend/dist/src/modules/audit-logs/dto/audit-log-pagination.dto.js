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
exports.AuditLogPaginationDto = void 0;
const class_validator_1 = require("class-validator");
const query_transform_1 = require("../../../common/transformers/query-transform");
class AuditLogPaginationDto {
    limit = 50;
    offset = 0;
}
exports.AuditLogPaginationDto = AuditLogPaginationDto;
__decorate([
    (0, query_transform_1.PaginationLimit)(50, 100),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], AuditLogPaginationDto.prototype, "limit", void 0);
__decorate([
    (0, query_transform_1.PaginationOffset)(0),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(5000),
    __metadata("design:type", Number)
], AuditLogPaginationDto.prototype, "offset", void 0);
//# sourceMappingURL=audit-log-pagination.dto.js.map