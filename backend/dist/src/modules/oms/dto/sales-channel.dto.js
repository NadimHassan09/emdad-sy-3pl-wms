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
exports.OmsInboundWebhookDto = exports.CreateOmsSalesChannelDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
class CreateOmsSalesChannelDto {
    companyId;
    channelType;
    name;
    externalStoreId;
    config;
}
exports.CreateOmsSalesChannelDto = CreateOmsSalesChannelDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], CreateOmsSalesChannelDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OmsSalesChannelType),
    __metadata("design:type", String)
], CreateOmsSalesChannelDto.prototype, "channelType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateOmsSalesChannelDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateOmsSalesChannelDto.prototype, "externalStoreId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateOmsSalesChannelDto.prototype, "config", void 0);
class OmsInboundWebhookDto {
    eventType;
    externalId;
    payload;
}
exports.OmsInboundWebhookDto = OmsInboundWebhookDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], OmsInboundWebhookDto.prototype, "eventType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], OmsInboundWebhookDto.prototype, "externalId", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], OmsInboundWebhookDto.prototype, "payload", void 0);
//# sourceMappingURL=sales-channel.dto.js.map