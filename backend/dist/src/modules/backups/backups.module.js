"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const super_admin_guard_1 = require("../../common/auth/super-admin.guard");
const auth_module_1 = require("../auth/auth.module");
const backup_config_1 = require("./backup-config");
const backup_drive_auth_service_1 = require("./backup-drive-auth.service");
const backup_drive_controller_1 = require("./backup-drive.controller");
const backup_drive_integration_service_1 = require("./backup-drive-integration.service");
const backup_drive_service_1 = require("./backup-drive.service");
const backup_drive_retention_cleanup_service_1 = require("./backup-drive-retention-cleanup.service");
const backup_drive_retention_service_1 = require("./backup-drive-retention.service");
const backup_drive_retry_service_1 = require("./backup-drive-retry.service");
const backup_drive_sync_service_1 = require("./backup-drive-sync.service");
const backup_storage_policy_controller_1 = require("./backup-storage-policy.controller");
const backup_storage_policy_service_1 = require("./backup-storage-policy.service");
const backup_file_encryption_service_1 = require("./backup-file-encryption.service");
const backup_download_token_service_1 = require("./backup-download-token.service");
const backup_health_alert_service_1 = require("./backup-health-alert.service");
const backup_health_service_1 = require("./backup-health.service");
const backup_factory_reset_service_1 = require("./backup-factory-reset.service");
const backup_maintenance_middleware_1 = require("./backup-maintenance.middleware");
const backup_maintenance_service_1 = require("./backup-maintenance.service");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_pg_tools_service_1 = require("./backup-pg-tools.service");
const backup_restore_runner_service_1 = require("./backup-restore-runner.service");
const backup_runner_service_1 = require("./backup-runner.service");
const backup_storage_service_1 = require("./backup-storage.service");
const backup_retention_cleanup_service_1 = require("./backup-retention-cleanup.service");
const backup_retention_controller_1 = require("./backup-retention.controller");
const backup_retention_service_1 = require("./backup-retention.service");
const backup_schedules_controller_1 = require("./backup-schedules.controller");
const backup_schedules_service_1 = require("./backup-schedules.service");
const backup_scheduler_service_1 = require("./backup-scheduler.service");
const backups_controller_1 = require("./backups.controller");
const backups_service_1 = require("./backups.service");
let BackupsModule = class BackupsModule {
    configure(consumer) {
        consumer.apply(backup_maintenance_middleware_1.BackupMaintenanceMiddleware).forRoutes('*');
    }
};
exports.BackupsModule = BackupsModule;
exports.BackupsModule = BackupsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, auth_module_1.AuthModule],
        controllers: [
            backup_drive_controller_1.BackupDriveController,
            backup_schedules_controller_1.BackupSchedulesController,
            backup_retention_controller_1.BackupRetentionController,
            backup_storage_policy_controller_1.BackupStoragePolicyController,
            backups_controller_1.BackupsController,
        ],
        providers: [
            backup_config_1.BackupConfig,
            backup_drive_integration_service_1.BackupDriveIntegrationService,
            backup_drive_service_1.BackupDriveService,
            backup_drive_auth_service_1.BackupDriveAuthService,
            backup_drive_sync_service_1.BackupDriveSyncService,
            backup_drive_retry_service_1.BackupDriveRetryService,
            backup_drive_retention_service_1.BackupDriveRetentionService,
            backup_drive_retention_cleanup_service_1.BackupDriveRetentionCleanupService,
            backup_storage_policy_service_1.BackupStoragePolicyService,
            backup_file_encryption_service_1.BackupFileEncryptionService,
            backup_storage_service_1.BackupStorageService,
            backup_download_token_service_1.BackupDownloadTokenService,
            backup_pg_tools_service_1.BackupPgToolsService,
            backup_operations_service_1.BackupOperationsService,
            backup_maintenance_service_1.BackupMaintenanceService,
            backup_runner_service_1.BackupRunnerService,
            backup_restore_runner_service_1.BackupRestoreRunnerService,
            backup_factory_reset_service_1.BackupFactoryResetService,
            backup_scheduler_service_1.BackupSchedulerService,
            backup_retention_service_1.BackupRetentionService,
            backup_retention_cleanup_service_1.BackupRetentionCleanupService,
            backup_health_service_1.BackupHealthService,
            backup_health_alert_service_1.BackupHealthAlertService,
            backup_schedules_service_1.BackupSchedulesService,
            backups_service_1.BackupsService,
            super_admin_guard_1.SuperAdminGuard,
        ],
        exports: [backups_service_1.BackupsService, backup_maintenance_service_1.BackupMaintenanceService],
    })
], BackupsModule);
//# sourceMappingURL=backups.module.js.map