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
exports.BackupConfig = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
let BackupConfig = class BackupConfig {
    config;
    constructor(config) {
        this.config = config;
    }
    get enabled() {
        return this.parseBool(this.config.get('BACKUP_ENABLED'), true);
    }
    get storagePath() {
        return (this.config.get('BACKUP_STORAGE_PATH') ??
            '/var/lib/emdad-wms/backups/default');
    }
    get environmentId() {
        return this.config.get('BACKUP_ENV_ID') ?? 'default';
    }
    get signingSecret() {
        return (this.config.get('BACKUP_SIGNING_SECRET') ??
            this.config.get('JWT_SECRET') ??
            'dev-backup-signing-secret');
    }
    get downloadTokenTtlSec() {
        return this.config.get('BACKUP_DOWNLOAD_TOKEN_TTL_SEC') ?? 300;
    }
    get manualCooldownSec() {
        return this.config.get('BACKUP_MANUAL_COOLDOWN_SEC') ?? 900;
    }
    get pgDumpPath() {
        return this.config.get('BACKUP_PG_DUMP_PATH') ?? '/usr/bin/pg_dump';
    }
    get pgRestorePath() {
        return this.config.get('BACKUP_PG_RESTORE_PATH') ?? '/usr/bin/pg_restore';
    }
    get maxUploadBytes() {
        return this.config.get('BACKUP_MAX_UPLOAD_BYTES') ?? 10 * 1024 * 1024 * 1024;
    }
    get factoryResetEnabled() {
        return this.parseBool(this.config.get('FACTORY_RESET_ENABLED'), false);
    }
    get preSnapshotRequired() {
        return this.parseBool(this.config.get('BACKUP_PRE_SNAPSHOT_REQUIRED'), true);
    }
    get schedulerEnabled() {
        return this.parseBool(this.config.get('BACKUP_SCHEDULER_ENABLED'), true);
    }
    get retentionCleanupEnabled() {
        return this.parseBool(this.config.get('BACKUP_RETENTION_CLEANUP_ENABLED'), true);
    }
    get keepLastDaily() {
        return this.readInt('BACKUP_KEEP_LAST_DAILY', 7, 1, 365);
    }
    get keepLastWeekly() {
        return this.readInt('BACKUP_KEEP_LAST_WEEKLY', 4, 1, 120);
    }
    get keepLastMonthly() {
        return this.readInt('BACKUP_KEEP_LAST_MONTHLY', 12, 1, 120);
    }
    get preSnapshotProtectDays() {
        return this.readInt('BACKUP_PRE_SNAPSHOT_PROTECT_DAYS', 7, 1, 90);
    }
    get healthMonitoringEnabled() {
        return this.parseBool(this.config.get('BACKUP_HEALTH_MONITORING_ENABLED'), true);
    }
    get healthMaxSuccessAgeHours() {
        return this.readInt('BACKUP_HEALTH_MAX_SUCCESS_AGE_HOURS', 48, 1, 720);
    }
    get healthWarnSuccessAgeHours() {
        return this.readInt('BACKUP_HEALTH_WARN_SUCCESS_AGE_HOURS', 24, 1, 720);
    }
    get healthStorageWarnBytes() {
        return this.readInt('BACKUP_HEALTH_STORAGE_WARN_BYTES', 50 * 1024 * 1024 * 1024, 1, 10 * 1024 * 1024 * 1024);
    }
    get healthStorageCriticalBytes() {
        return this.readInt('BACKUP_HEALTH_STORAGE_CRITICAL_BYTES', 80 * 1024 * 1024 * 1024, 1, 10 * 1024 * 1024 * 1024);
    }
    get healthFailureWindowHours() {
        return this.readInt('BACKUP_HEALTH_FAILURE_WINDOW_HOURS', 24, 1, 168);
    }
    get healthFailureWarnCount() {
        return this.readInt('BACKUP_HEALTH_FAILURE_WARN_COUNT', 2, 1, 50);
    }
    get healthFailureCriticalCount() {
        return this.readInt('BACKUP_HEALTH_FAILURE_CRITICAL_COUNT', 3, 1, 50);
    }
    get healthAlertCooldownHours() {
        return this.readInt('BACKUP_HEALTH_ALERT_COOLDOWN_HOURS', 6, 1, 168);
    }
    get gdriveEnabled() {
        return this.parseBool(this.config.get('BACKUP_GDRIVE_ENABLED'), false);
    }
    get gdriveClientId() {
        const v = this.config.get('BACKUP_GDRIVE_CLIENT_ID')?.trim();
        return v || null;
    }
    get gdriveClientSecret() {
        const v = this.config.get('BACKUP_GDRIVE_CLIENT_SECRET')?.trim();
        return v || null;
    }
    get gdriveRedirectUri() {
        const v = this.config.get('BACKUP_GDRIVE_REDIRECT_URI')?.trim();
        return v || null;
    }
    get gdriveRootFolderName() {
        return this.config.get('BACKUP_GDRIVE_ROOT_FOLDER_NAME') ?? 'EMDAD WMS Backups';
    }
    get gdriveConnectSuccessUrl() {
        const v = this.config.get('BACKUP_GDRIVE_CONNECT_SUCCESS_URL')?.trim();
        return v || null;
    }
    gdriveConfigured() {
        return !!(this.gdriveEnabled &&
            this.gdriveClientId &&
            this.gdriveClientSecret &&
            this.gdriveRedirectUri);
    }
    get gdriveSimulateUploadFailure() {
        return this.parseBool(this.config.get('BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE'), false);
    }
    get defaultStoragePolicy() {
        const raw = this.config.get('BACKUP_DEFAULT_STORAGE_POLICY')?.trim().toLowerCase();
        if (raw === 'local_only')
            return client_1.BackupStoragePolicy.local_only;
        if (raw === 'drive_only')
            return client_1.BackupStoragePolicy.drive_only;
        return client_1.BackupStoragePolicy.local_and_drive;
    }
    get gdriveRetryMaxAttempts() {
        return this.readInt('BACKUP_GDRIVE_RETRY_MAX_ATTEMPTS', 8, 1, 20);
    }
    get gdriveRetryBaseSec() {
        return this.readInt('BACKUP_GDRIVE_RETRY_BASE_SEC', 60, 10, 3600);
    }
    get gdriveRetryMaxSec() {
        return this.readInt('BACKUP_GDRIVE_RETRY_MAX_SEC', 21_600, 60, 86_400);
    }
    get gdriveRetentionCleanupEnabled() {
        return this.parseBool(this.config.get('BACKUP_GDRIVE_RETENTION_CLEANUP_ENABLED'), true);
    }
    get gdriveKeepLastDaily() {
        return this.readInt('BACKUP_GDRIVE_KEEP_LAST_DAILY', 14, 1, 365);
    }
    get gdriveKeepLastWeekly() {
        return this.readInt('BACKUP_GDRIVE_KEEP_LAST_WEEKLY', 8, 1, 120);
    }
    get gdriveKeepLastMonthly() {
        return this.readInt('BACKUP_GDRIVE_KEEP_LAST_MONTHLY', 24, 1, 120);
    }
    readInt(key, defaultValue, min, max) {
        const raw = this.config.get(key);
        if (raw === undefined || raw === '')
            return defaultValue;
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n))
            return defaultValue;
        return Math.min(max, Math.max(min, n));
    }
    parseBool(raw, defaultValue) {
        if (raw === undefined || raw === '')
            return defaultValue;
        const v = raw.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(v))
            return true;
        if (['false', '0', 'no', 'off'].includes(v))
            return false;
        return defaultValue;
    }
};
exports.BackupConfig = BackupConfig;
exports.BackupConfig = BackupConfig = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BackupConfig);
//# sourceMappingURL=backup-config.js.map