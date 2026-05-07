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
exports.ListWarehousesQueryDto = void 0;
const class_validator_1 = require("class-validator");
const query_transform_1 = require("../../../common/transformers/query-transform");
class ListWarehousesQueryDto {
    includeInactive;
}
exports.ListWarehousesQueryDto = ListWarehousesQueryDto;
__decorate([
    (0, query_transform_1.QueryBoolOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ListWarehousesQueryDto.prototype, "includeInactive", void 0);
//# sourceMappingURL=list-warehouses-query.dto.js.map