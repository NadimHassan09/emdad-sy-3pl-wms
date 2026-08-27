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
exports.ExternalListOutboundOrdersQueryDto = exports.ExternalListInboundOrdersQueryDto = exports.ExternalListOmsOrdersQueryDto = void 0;
const class_validator_1 = require("class-validator");
const query_transform_1 = require("../../../../common/transformers/query-transform");
const client_list_inbound_query_dto_1 = require("../../inbound/dto/client-list-inbound-query.dto");
const list_client_oms_orders_query_dto_1 = require("../../oms/dto/list-client-oms-orders-query.dto");
const client_list_outbound_query_dto_1 = require("../../outbound/dto/client-list-outbound-query.dto");
class ExternalListOmsOrdersQueryDto extends list_client_oms_orders_query_dto_1.ListClientOmsOrdersQueryDto {
    externalOrderId;
    orderNumber;
}
exports.ExternalListOmsOrdersQueryDto = ExternalListOmsOrdersQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalListOmsOrdersQueryDto.prototype, "externalOrderId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalListOmsOrdersQueryDto.prototype, "orderNumber", void 0);
class ExternalListInboundOrdersQueryDto extends client_list_inbound_query_dto_1.ClientListInboundQueryDto {
    externalOrderId;
    orderNumber;
}
exports.ExternalListInboundOrdersQueryDto = ExternalListInboundOrdersQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalListInboundOrdersQueryDto.prototype, "externalOrderId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalListInboundOrdersQueryDto.prototype, "orderNumber", void 0);
class ExternalListOutboundOrdersQueryDto extends client_list_outbound_query_dto_1.ClientListOutboundQueryDto {
    externalOrderId;
    orderNumber;
}
exports.ExternalListOutboundOrdersQueryDto = ExternalListOutboundOrdersQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalListOutboundOrdersQueryDto.prototype, "externalOrderId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ExternalListOutboundOrdersQueryDto.prototype, "orderNumber", void 0);
//# sourceMappingURL=external-list-orders-query.dto.js.map