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
exports.ClientListOutboundQueryDto = exports.CLIENT_OUTBOUND_IN_PROGRESS_STATUSES = exports.CLIENT_OUTBOUND_STATUS_FILTERS = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../../common/dto/pagination.dto");
const query_transform_1 = require("../../../../common/transformers/query-transform");
exports.CLIENT_OUTBOUND_STATUS_FILTERS = [
    'pending_approval',
    'in_progress',
    'shipped',
    'cancelled',
];
exports.CLIENT_OUTBOUND_IN_PROGRESS_STATUSES = [
    client_1.OutboundOrderStatus.draft,
    client_1.OutboundOrderStatus.pending_stock,
    client_1.OutboundOrderStatus.confirmed,
    client_1.OutboundOrderStatus.allocated,
    client_1.OutboundOrderStatus.picking,
    client_1.OutboundOrderStatus.packing,
    client_1.OutboundOrderStatus.ready_to_ship,
    client_1.OutboundOrderStatus.out_for_delivery,
    client_1.OutboundOrderStatus.returned,
];
class ClientListOutboundQueryDto extends pagination_dto_1.PaginationDto {
    orderSearch;
    status;
}
exports.ClientListOutboundQueryDto = ClientListOutboundQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ClientListOutboundQueryDto.prototype, "orderSearch", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...exports.CLIENT_OUTBOUND_STATUS_FILTERS]),
    __metadata("design:type", String)
], ClientListOutboundQueryDto.prototype, "status", void 0);
//# sourceMappingURL=client-list-outbound-query.dto.js.map