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
var BackupGdriveStartupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupGdriveStartupService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const backup_config_1 = require("./backup-config");
const EXPECTED_CALLBACK_SUFFIX = '/api/integrations/google-drive/callback';
let BackupGdriveStartupService = BackupGdriveStartupService_1 = class BackupGdriveStartupService {
    backupConfig;
    config;
    logger = new common_1.Logger(BackupGdriveStartupService_1.name);
    report = null;
    constructor(backupConfig, config) {
        this.backupConfig = backupConfig;
        this.config = config;
    }
    onModuleInit() {
        this.report = this.validate();
        this.logReport(this.report);
        this.enforceStrictStartup(this.report);
    }
    getReport() {
        return this.report;
    }
    validate() {
        const enabled = this.backupConfig.gdriveEnabled;
        const missingEnv = [];
        const warnings = [];
        if (!enabled) {
            return { enabled: false, configured: false, missingEnv, warnings };
        }
        if (!this.backupConfig.gdriveClientId)
            missingEnv.push('BACKUP_GDRIVE_CLIENT_ID');
        if (!this.backupConfig.gdriveClientSecret)
            missingEnv.push('BACKUP_GDRIVE_CLIENT_SECRET');
        if (!this.backupConfig.gdriveRedirectUri)
            missingEnv.push('BACKUP_GDRIVE_REDIRECT_URI');
        if (!this.config.get('BACKUP_ENCRYPTION_KEY')?.trim()) {
            missingEnv.push('BACKUP_ENCRYPTION_KEY');
        }
        const redirectUri = this.backupConfig.gdriveRedirectUri;
        if (redirectUri && !redirectUri.endsWith(EXPECTED_CALLBACK_SUFFIX)) {
            warnings.push(`BACKUP_GDRIVE_REDIRECT_URI should end with ${EXPECTED_CALLBACK_SUFFIX}`);
        }
        if (!this.backupConfig.gdriveConnectSuccessUrl) {
            warnings.push('BACKUP_GDRIVE_CONNECT_SUCCESS_URL is unset — OAuth callback returns JSON instead of redirecting to admin UI');
        }
        const configured = missingEnv.length === 0;
        return { enabled, configured, missingEnv, warnings };
    }
    logReport(report) {
        if (!report.enabled) {
            this.logger.log('Google Drive off-site backup is disabled (BACKUP_GDRIVE_ENABLED=false).');
            return;
        }
        if (report.configured) {
            this.logger.log(`Google Drive off-site backup is enabled and OAuth credentials are configured (redirect: ${this.backupConfig.gdriveRedirectUri}).`);
        }
        else {
            this.logger.error(`Google Drive is enabled but OAuth is incomplete. Missing: ${report.missingEnv.join(', ')}. ` +
                'Connect Drive and backup sync will remain unavailable until credentials are set.');
        }
        for (const warning of report.warnings) {
            this.logger.warn(`Google Drive startup: ${warning}`);
        }
    }
    enforceStrictStartup(report) {
        if (!report.enabled || report.configured)
            return;
        const isProd = this.config.get('NODE_ENV') === 'production';
        const strict = this.parseBool(this.config.get('BACKUP_GDRIVE_STARTUP_STRICT'), isProd);
        if (strict) {
            throw new Error(`Google Drive startup validation failed. Missing environment variables: ${report.missingEnv.join(', ')}. ` +
                'Set OAuth credentials or disable BACKUP_GDRIVE_ENABLED.');
        }
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
exports.BackupGdriveStartupService = BackupGdriveStartupService;
exports.BackupGdriveStartupService = BackupGdriveStartupService = BackupGdriveStartupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backup_config_1.BackupConfig,
        config_1.ConfigService])
], BackupGdriveStartupService);
//# sourceMappingURL=backup-gdrive-startup.service.js.map