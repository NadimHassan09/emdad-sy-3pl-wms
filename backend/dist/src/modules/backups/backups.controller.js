"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const throttler_1 = require("@nestjs/throttler");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const multer_1 = require("multer");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const roles_guard_1 = require("../../common/auth/roles.guard");
const super_admin_guard_1 = require("../../common/auth/super-admin.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const backup_health_alert_service_1 = require("./backup-health-alert.service");
const backup_health_service_1 = require("./backup-health.service");
const backups_service_1 = require("./backups.service");
const create_backup_dto_1 = require("./dto/create-backup.dto");
const factory_reset_dto_1 = require("./dto/factory-reset.dto");
const list_backups_query_dto_1 = require("./dto/list-backups-query.dto");
const restore_backup_dto_1 = require("./dto/restore-backup.dto");
let BackupsController = class BackupsController {
    backups;
    backupHealth;
    backupHealthAlerts;
    constructor(backups, backupHealth, backupHealthAlerts) {
        this.backups = backups;
        this.backupHealth = backupHealth;
        this.backupHealthAlerts = backupHealthAlerts;
    }
    getHealth() {
        return this.backupHealth.getHealth();
    }
    evaluateHealthAlerts() {
        return this.backupHealthAlerts.evaluateNow();
    }
    getActiveOperation() {
        return this.backups.getActiveOperation();
    }
    upload(user, file) {
        return this.backups.uploadBackup(user, file);
    }
    factoryReset(user, dto) {
        return this.backups.factoryReset(user, dto);
    }
    create(user, dto) {
        return this.backups.createManual(user, dto);
    }
    list(user, query) {
        return this.backups.list(user, query);
    }
    syncDrive(user, id) {
        return this.backups.syncDrive(user, id);
    }
    restore(user, id, dto) {
        return this.backups.restoreBackup(user, id, dto);
    }
    status(user, id) {
        return this.backups.getStatus(user, id);
    }
    downloadUrl(user, id) {
        return this.backups.issueDownload(user, id);
    }
    async download(user, id, token, res) {
        const { stream, filename, sizeBytes } = await this.backups.streamDownload(user, id, token);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', String(sizeBytes));
        stream.pipe(res);
    }
    findOne(user, id) {
        return this.backups.findById(user, id);
    }
};
exports.BackupsController = BackupsController;
__decorate([
    (0, common_1.Get)('health'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Post)('health/evaluate-alerts'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "evaluateHealthAlerts", null);
__decorate([
    (0, common_1.Get)('operations/active'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "getActiveOperation", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: os.tmpdir(),
            filename: (_req, file, cb) => {
                cb(null, `wms-upload-${Date.now()}-${path.basename(file.originalname)}`);
            },
        }),
        limits: { fileSize: 10 * 1024 * 1024 * 1024 },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('factory-reset'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 2, ttl: 300_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, factory_reset_dto_1.FactoryResetDto]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "factoryReset", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_backup_dto_1.CreateBackupDto]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_backups_query_dto_1.ListBackupsQueryDto]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/sync-drive'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "syncDrive", null);
__decorate([
    (0, common_1.Post)(':id/restore'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 2, ttl: 300_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, restore_backup_dto_1.RestoreBackupDto]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "restore", null);
__decorate([
    (0, common_1.Get)(':id/status'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "status", null);
__decorate([
    (0, common_1.Post)(':id/download-url'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "downloadUrl", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Query)('token')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], BackupsController.prototype, "download", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BackupsController.prototype, "findOne", null);
exports.BackupsController = BackupsController = __decorate([
    (0, common_1.Controller)('backups'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.ADMIN),
    __metadata("design:paramtypes", [backups_service_1.BackupsService,
        backup_health_service_1.BackupHealthService,
        backup_health_alert_service_1.BackupHealthAlertService])
], BackupsController);
//# sourceMappingURL=backups.controller.js.map