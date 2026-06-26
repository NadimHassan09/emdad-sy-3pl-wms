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
exports.BackupDriveController = void 0;
const common_1 = require("@nestjs/common");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const public_decorator_1 = require("../../common/auth/public.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const super_admin_guard_1 = require("../../common/auth/super-admin.guard");
const backup_config_1 = require("./backup-config");
const backup_drive_auth_service_1 = require("./backup-drive-auth.service");
const backup_drive_integration_service_1 = require("./backup-drive-integration.service");
const backup_drive_service_1 = require("./backup-drive.service");
let BackupDriveController = class BackupDriveController {
    auth;
    integration;
    drive;
    backupConfig;
    constructor(auth, integration, drive, backupConfig) {
        this.auth = auth;
        this.integration = integration;
        this.drive = drive;
        this.backupConfig = backupConfig;
    }
    connectAuthUrl(user) {
        return this.auth.buildAuthUrl(user);
    }
    async connectCallback(code, state, error, res) {
        if (error) {
            return res.status(400).json({
                success: false,
                error: { code: 'OAUTH_DENIED', message: error },
            });
        }
        const result = await this.auth.handleCallback(code, state);
        const successUrl = this.backupConfig.gdriveConnectSuccessUrl;
        if (successUrl) {
            const url = new URL(successUrl);
            url.searchParams.set('drive', 'connected');
            return res.redirect(url.toString());
        }
        return res.json({
            success: true,
            data: result,
        });
    }
    disconnect(user) {
        return this.auth.disconnect(user);
    }
    async testConnection() {
        const refreshToken = await this.integration.getRefreshToken();
        const folderId = await this.integration.getFolderId();
        if (!refreshToken || !folderId) {
            return { ok: false, connected: false, message: 'Google Drive is not connected.' };
        }
        const result = await this.drive.testConnection(refreshToken, folderId);
        return { connected: true, ...result };
    }
    status() {
        return this.integration.getAdminStatus();
    }
};
exports.BackupDriveController = BackupDriveController;
__decorate([
    (0, common_1.Get)('auth-url'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BackupDriveController.prototype, "connectAuthUrl", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], BackupDriveController.prototype, "connectCallback", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BackupDriveController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Post)('test'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupDriveController.prototype, "testConnection", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupDriveController.prototype, "status", null);
exports.BackupDriveController = BackupDriveController = __decorate([
    (0, common_1.Controller)('integrations/google-drive'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.ADMIN),
    __metadata("design:paramtypes", [backup_drive_auth_service_1.BackupDriveAuthService,
        backup_drive_integration_service_1.BackupDriveIntegrationService,
        backup_drive_service_1.BackupDriveService,
        backup_config_1.BackupConfig])
], BackupDriveController);
//# sourceMappingURL=backup-drive.controller.js.map