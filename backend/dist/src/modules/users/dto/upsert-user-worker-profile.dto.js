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
exports.UpsertUserWorkerProfileDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class UpsertUserWorkerProfileDto {
    warehouseId;
    roles;
    linkWorkerId;
}
exports.UpsertUserWorkerProfileDto = UpsertUserWorkerProfileDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpsertUserWorkerProfileDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsEnum)(client_1.WorkerOperationalRole, { each: true }),
    __metadata("design:type", Array)
], UpsertUserWorkerProfileDto.prototype, "roles", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertUserWorkerProfileDto.prototype, "linkWorkerId", void 0);
//# sourceMappingURL=upsert-user-worker-profile.dto.js.map