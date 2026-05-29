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
exports.ListAuditLogsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const query_transform_1 = require("../../../common/transformers/query-transform");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
const audit_log_pagination_dto_1 = require("./audit-log-pagination.dto");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
class ListAuditLogsQueryDto extends audit_log_pagination_dto_1.AuditLogPaginationDto {
    actor_id;
    actor_email;
    actor_role;
    company_id;
    resource_type;
    resource_id;
    action;
    date_from;
    date_to;
    search;
    sort_by;
    sort_dir;
    cursor;
}
exports.ListAuditLogsQueryDto = ListAuditLogsQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "actor_id", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(320),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "actor_email", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "actor_role", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "company_id", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "resource_type", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "resource_id", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "action", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'date_from must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "date_from", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(DAY, { message: 'date_to must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "date_to", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "search", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['created_at', 'action', 'actor_email', 'actor_role', 'resource_type']),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "sort_by", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['asc', 'desc']),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "sort_dir", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], ListAuditLogsQueryDto.prototype, "cursor", void 0);
//# sourceMappingURL=list-audit-logs-query.dto.js.map