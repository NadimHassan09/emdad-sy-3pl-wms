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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupRetentionController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const super_admin_guard_1 = require("../../common/auth/super-admin.guard");
const backup_drive_retention_service_1 = require("./backup-drive-retention.service");
const backup_retention_service_1 = require("./backup-retention.service");
let BackupRetentionController = class BackupRetentionController {
    retention;
    driveRetention;
    constructor(retention, driveRetention) {
        this.retention = retention;
        this.driveRetention = driveRetention;
    }
    getPolicies() {
        return this.retention.getPolicies();
    }
    preview() {
        return this.retention.previewCleanup();
    }
    cleanup(user) {
        return this.retention.executeCleanup(user);
    }
    getDrivePolicies() {
        return this.driveRetention.getPolicies();
    }
    previewDrive() {
        return this.driveRetention.previewCleanup();
    }
    cleanupDrive(user) {
        return this.driveRetention.executeCleanup(user);
    }
};
exports.BackupRetentionController = BackupRetentionController;
__decorate([
    (0, common_1.Get)('policies'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupRetentionController.prototype, "getPolicies", null);
__decorate([
    (0, common_1.Get)('preview'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupRetentionController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('cleanup'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 300_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BackupRetentionController.prototype, "cleanup", null);
__decorate([
    (0, common_1.Get)('drive/policies'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupRetentionController.prototype, "getDrivePolicies", null);
__decorate([
    (0, common_1.Get)('drive/preview'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupRetentionController.prototype, "previewDrive", null);
__decorate([
    (0, common_1.Post)('drive/cleanup'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 300_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BackupRetentionController.prototype, "cleanupDrive", null);
exports.BackupRetentionController = BackupRetentionController = __decorate([
    (0, common_1.Controller)('backups/retention'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.ADMIN),
    __metadata("design:paramtypes", [backup_retention_service_1.BackupRetentionService,
        backup_drive_retention_service_1.BackupDriveRetentionService])
], BackupRetentionController);
//# sourceMappingURL=backup-retention.controller.js.map