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
exports.ShippingMethodDto = exports.ConnectShippingProviderDto = void 0;
const class_validator_1 = require("class-validator");
class ConnectShippingProviderDto {
    username;
    password;
}
exports.ConnectShippingProviderDto = ConnectShippingProviderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ConnectShippingProviderDto.prototype, "username", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ConnectShippingProviderDto.prototype, "password", void 0);
class ShippingMethodDto {
    shippingMethod;
}
exports.ShippingMethodDto = ShippingMethodDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['manual', 'carrier']),
    __metadata("design:type", String)
], ShippingMethodDto.prototype, "shippingMethod", void 0);
//# sourceMappingURL=connect-shipping-provider.dto.js.map