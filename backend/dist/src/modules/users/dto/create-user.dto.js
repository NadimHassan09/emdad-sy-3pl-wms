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
exports.CreateUserDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CreateUserDto {
    kind;
    email;
    fullName;
    phone;
    password;
    companyId;
    clientRole;
    systemRole;
    workerWarehouseId;
}
exports.CreateUserDto = CreateUserDto;
__decorate([
    (0, class_validator_1.IsIn)(['system', 'client']),
    __metadata("design:type", String)
], CreateUserDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(320),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateUserDto.prototype, "fullName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CreateUserDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CreateUserDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind === 'client'),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind === 'client'),
    (0, class_validator_1.IsIn)(['client_admin', 'client_staff']),
    __metadata("design:type", String)
], CreateUserDto.prototype, "clientRole", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind === 'system'),
    (0, class_validator_1.IsIn)(['super_admin', 'admin', 'worker']),
    __metadata("design:type", String)
], CreateUserDto.prototype, "systemRole", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind === 'system' && o.systemRole === 'worker'),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value === null ? undefined : value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "workerWarehouseId", void 0);
//# sourceMappingURL=create-user.dto.js.map