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
exports.QuickDirectedOutboundDto = exports.QUICK_DIRECTED_OUTBOUND_REASON_CODES = void 0;
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../../common/validators/is-uuid-loose");
exports.QUICK_DIRECTED_OUTBOUND_REASON_CODES = [
    'consumption',
    'damage',
    'sample',
    'scrap',
    'other',
];
class QuickDirectedOutboundDto {
    warehouseId;
    companyId;
    productCode;
    quantity;
    reasonCode;
}
exports.QuickDirectedOutboundDto = QuickDirectedOutboundDto;
__decorate([
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], QuickDirectedOutboundDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], QuickDirectedOutboundDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], QuickDirectedOutboundDto.prototype, "productCode", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QuickDirectedOutboundDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(exports.QUICK_DIRECTED_OUTBOUND_REASON_CODES),
    __metadata("design:type", String)
], QuickDirectedOutboundDto.prototype, "reasonCode", void 0);
//# sourceMappingURL=quick-directed-outbound.dto.js.map