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
exports.CreateCompanyDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const company_field_validation_1 = require("../company-field.validation");
function Trim() {
    return (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value));
}
function TrimEmptyToUndefined() {
    return (0, class_transformer_1.Transform)(({ value }) => {
        if (value === null || value === undefined)
            return undefined;
        if (typeof value !== 'string')
            return value;
        const t = value.trim();
        return t === '' ? undefined : t;
    });
}
class CreateCompanyDto {
    name;
    tradeName;
    contactEmail;
    country;
    city;
    contactPhone;
    address;
    notes;
}
exports.CreateCompanyDto = CreateCompanyDto;
__decorate([
    Trim(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    (0, class_validator_1.Matches)(company_field_validation_1.COMPANY_ORG_NAME_PATTERN, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.name }),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "name", void 0);
__decorate([
    TrimEmptyToUndefined(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    (0, class_validator_1.Matches)(company_field_validation_1.COMPANY_ORG_NAME_PATTERN, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.tradeName }),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "tradeName", void 0);
__decorate([
    Trim(),
    (0, class_validator_1.IsEmail)({}, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.contactEmail }),
    (0, class_validator_1.MaxLength)(320),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "contactEmail", void 0);
__decorate([
    Trim(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(64),
    (0, class_validator_1.Matches)(company_field_validation_1.COMPANY_COUNTRY_PATTERN, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.country }),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "country", void 0);
__decorate([
    Trim(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    (0, class_validator_1.Matches)(company_field_validation_1.COMPANY_CITY_PATTERN, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.city }),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "city", void 0);
__decorate([
    TrimEmptyToUndefined(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    (0, class_validator_1.Matches)(company_field_validation_1.COMPANY_PHONE_PATTERN, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.contactPhone }),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "contactPhone", void 0);
__decorate([
    TrimEmptyToUndefined(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.address }),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "address", void 0);
__decorate([
    TrimEmptyToUndefined(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000, { message: company_field_validation_1.COMPANY_FIELD_MESSAGES.notes }),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "notes", void 0);
//# sourceMappingURL=create-company.dto.js.map