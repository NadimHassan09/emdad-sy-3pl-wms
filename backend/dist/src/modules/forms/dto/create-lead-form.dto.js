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
exports.CreateLeadFormDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
function Trim() {
    return (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value));
}
class CreateLeadFormDto {
    fullName;
    phone;
    email;
    activityType;
    message;
}
exports.CreateLeadFormDto = CreateLeadFormDto;
__decorate([
    Trim(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 150),
    __metadata("design:type", String)
], CreateLeadFormDto.prototype, "fullName", void 0);
__decorate([
    Trim(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 30),
    (0, class_validator_1.Matches)(/^[+]?[\d\s()-]{5,30}$/, {
        message: 'phone must be a valid phone number.',
    }),
    __metadata("design:type", String)
], CreateLeadFormDto.prototype, "phone", void 0);
__decorate([
    Trim(),
    (0, class_validator_1.IsEmail)({}, { message: 'email must be a valid email address.' }),
    (0, class_validator_1.Length)(3, 200),
    __metadata("design:type", String)
], CreateLeadFormDto.prototype, "email", void 0);
__decorate([
    Trim(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateLeadFormDto.prototype, "activityType", void 0);
__decorate([
    Trim(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 2000),
    __metadata("design:type", String)
], CreateLeadFormDto.prototype, "message", void 0);
//# sourceMappingURL=create-lead-form.dto.js.map