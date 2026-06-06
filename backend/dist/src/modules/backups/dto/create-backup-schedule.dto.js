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
exports.CreateBackupScheduleDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class CreateBackupScheduleDto {
    enabled = true;
    frequency;
    hour;
    minute;
    retentionDays;
    storagePolicy;
}
exports.CreateBackupScheduleDto = CreateBackupScheduleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateBackupScheduleDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.BackupScheduleFrequency),
    __metadata("design:type", String)
], CreateBackupScheduleDto.prototype, "frequency", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(23),
    __metadata("design:type", Number)
], CreateBackupScheduleDto.prototype, "hour", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(59),
    __metadata("design:type", Number)
], CreateBackupScheduleDto.prototype, "minute", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], CreateBackupScheduleDto.prototype, "retentionDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BackupStoragePolicy),
    __metadata("design:type", String)
], CreateBackupScheduleDto.prototype, "storagePolicy", void 0);
//# sourceMappingURL=create-backup-schedule.dto.js.map