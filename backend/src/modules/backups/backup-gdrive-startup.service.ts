import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BackupConfig } from './backup-config';

const EXPECTED_CALLBACK_SUFFIX = '/api/integrations/google-drive/callback';

export type BackupGdriveStartupReport = {
  enabled: boolean;
  configured: boolean;
  missingEnv: string[];
  warnings: string[];
};

@Injectable()
export class BackupGdriveStartupService implements OnModuleInit {
  private readonly logger = new Logger(BackupGdriveStartupService.name);
  private report: BackupGdriveStartupReport | null = null;

  constructor(
    private readonly backupConfig: BackupConfig,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.report = this.validate();
    this.logReport(this.report);
    this.enforceStrictStartup(this.report);
  }

  getReport(): BackupGdriveStartupReport | null {
    return this.report;
  }

  validate(): BackupGdriveStartupReport {
    const enabled = this.backupConfig.gdriveEnabled;
    const missingEnv: string[] = [];
    const warnings: string[] = [];

    if (!enabled) {
      return { enabled: false, configured: false, missingEnv, warnings };
    }

    if (!this.backupConfig.gdriveClientId) missingEnv.push('BACKUP_GDRIVE_CLIENT_ID');
    if (!this.backupConfig.gdriveClientSecret) missingEnv.push('BACKUP_GDRIVE_CLIENT_SECRET');
    if (!this.backupConfig.gdriveRedirectUri) missingEnv.push('BACKUP_GDRIVE_REDIRECT_URI');
    if (!this.config.get<string>('BACKUP_ENCRYPTION_KEY')?.trim()) {
      missingEnv.push('BACKUP_ENCRYPTION_KEY');
    }

    const redirectUri = this.backupConfig.gdriveRedirectUri;
    if (redirectUri && !redirectUri.endsWith(EXPECTED_CALLBACK_SUFFIX)) {
      warnings.push(
        `BACKUP_GDRIVE_REDIRECT_URI should end with ${EXPECTED_CALLBACK_SUFFIX}`,
      );
    }

    if (!this.backupConfig.gdriveConnectSuccessUrl) {
      warnings.push('BACKUP_GDRIVE_CONNECT_SUCCESS_URL is unset — OAuth callback returns JSON instead of redirecting to admin UI');
    }

    const configured = missingEnv.length === 0;

    return { enabled, configured, missingEnv, warnings };
  }

  private logReport(report: BackupGdriveStartupReport): void {
    if (!report.enabled) {
      this.logger.log('Google Drive off-site backup is disabled (BACKUP_GDRIVE_ENABLED=false).');
      return;
    }

    if (report.configured) {
      this.logger.log(
        `Google Drive off-site backup is enabled and OAuth credentials are configured (redirect: ${this.backupConfig.gdriveRedirectUri}).`,
      );
    } else {
      this.logger.error(
        `Google Drive is enabled but OAuth is incomplete. Missing: ${report.missingEnv.join(', ')}. ` +
          'Connect Drive and backup sync will remain unavailable until credentials are set.',
      );
    }

    for (const warning of report.warnings) {
      this.logger.warn(`Google Drive startup: ${warning}`);
    }
  }

  private enforceStrictStartup(report: BackupGdriveStartupReport): void {
    if (!report.enabled || report.configured) return;

    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const strict = this.parseBool(this.config.get<string>('BACKUP_GDRIVE_STARTUP_STRICT'), isProd);

    if (strict) {
      throw new Error(
        `Google Drive startup validation failed. Missing environment variables: ${report.missingEnv.join(', ')}. ` +
          'Set OAuth credentials or disable BACKUP_GDRIVE_ENABLED.',
      );
    }
  }

  private parseBool(raw: string | undefined, defaultValue: boolean): boolean {
    if (raw === undefined || raw === '') return defaultValue;
    const v = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return defaultValue;
  }
}
