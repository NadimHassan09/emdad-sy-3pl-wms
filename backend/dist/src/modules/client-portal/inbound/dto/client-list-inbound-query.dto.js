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
exports.ClientListInboundQueryDto = exports.CLIENT_INBOUND_IN_PROGRESS_STATUSES = exports.CLIENT_INBOUND_STATUS_FILTERS = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../../common/transformers/query-transform");
exports.CLIENT_INBOUND_STATUS_FILTERS = [
    'pending_approval',
    'in_progress',
    'completed',
    'cancelled',
];
exports.CLIENT_INBOUND_IN_PROGRESS_STATUSES = [
    client_1.InboundOrderStatus.draft,
    client_1.InboundOrderStatus.confirmed,
    client_1.InboundOrderStatus.in_progress,
    client_1.InboundOrderStatus.partially_received,
];
class ClientListInboundQueryDto extends pagination_dto_1.PaginationDto {
    orderSearch;
    status;
}
exports.ClientListInboundQueryDto = ClientListInboundQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ClientListInboundQueryDto.prototype, "orderSearch", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...exports.CLIENT_INBOUND_STATUS_FILTERS]),
    __metadata("design:type", String)
], ClientListInboundQueryDto.prototype, "status", void 0);
//# sourceMappingURL=client-list-inbound-query.dto.js.map