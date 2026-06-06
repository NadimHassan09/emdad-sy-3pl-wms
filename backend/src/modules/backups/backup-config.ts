import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupStoragePolicy } from '@prisma/client';

@Injectable()
export class BackupConfig {
  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_ENABLED'), true);
  }

  get storagePath(): string {
    return (
      this.config.get<string>('BACKUP_STORAGE_PATH') ??
      '/var/lib/emdad-wms/backups/default'
    );
  }

  get environmentId(): string {
    return this.config.get<string>('BACKUP_ENV_ID') ?? 'default';
  }

  get signingSecret(): string {
    return (
      this.config.get<string>('BACKUP_SIGNING_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'dev-backup-signing-secret'
    );
  }

  get downloadTokenTtlSec(): number {
    return this.config.get<number>('BACKUP_DOWNLOAD_TOKEN_TTL_SEC') ?? 300;
  }

  get manualCooldownSec(): number {
    return this.config.get<number>('BACKUP_MANUAL_COOLDOWN_SEC') ?? 900;
  }

  get pgDumpPath(): string {
    return this.config.get<string>('BACKUP_PG_DUMP_PATH') ?? '/usr/bin/pg_dump';
  }

  get pgRestorePath(): string {
    return this.config.get<string>('BACKUP_PG_RESTORE_PATH') ?? '/usr/bin/pg_restore';
  }

  get maxUploadBytes(): number {
    return this.config.get<number>('BACKUP_MAX_UPLOAD_BYTES') ?? 10 * 1024 * 1024 * 1024;
  }

  get factoryResetEnabled(): boolean {
    return this.parseBool(this.config.get<string>('FACTORY_RESET_ENABLED'), false);
  }

  get preSnapshotRequired(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_PRE_SNAPSHOT_REQUIRED'), true);
  }

  get schedulerEnabled(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_SCHEDULER_ENABLED'), true);
  }

  get retentionCleanupEnabled(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_RETENTION_CLEANUP_ENABLED'), true);
  }

  /** Keep last N backups in the daily retention bucket (manual, upload, daily schedules). */
  get keepLastDaily(): number {
    return this.readInt('BACKUP_KEEP_LAST_DAILY', 7, 1, 365);
  }

  /** Keep last N backups from weekly scheduled runs. */
  get keepLastWeekly(): number {
    return this.readInt('BACKUP_KEEP_LAST_WEEKLY', 4, 1, 120);
  }

  /** Keep last N backups from monthly scheduled runs. */
  get keepLastMonthly(): number {
    return this.readInt('BACKUP_KEEP_LAST_MONTHLY', 12, 1, 120);
  }

  /** Never delete pre_snapshot jobs completed within this many days. */
  get preSnapshotProtectDays(): number {
    return this.readInt('BACKUP_PRE_SNAPSHOT_PROTECT_DAYS', 7, 1, 90);
  }

  get healthMonitoringEnabled(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_HEALTH_MONITORING_ENABLED'), true);
  }

  /** Hours without a successful backup before a critical health alert. */
  get healthMaxSuccessAgeHours(): number {
    return this.readInt('BACKUP_HEALTH_MAX_SUCCESS_AGE_HOURS', 48, 1, 720);
  }

  /** Hours without a successful backup before a warning health alert. */
  get healthWarnSuccessAgeHours(): number {
    return this.readInt('BACKUP_HEALTH_WARN_SUCCESS_AGE_HOURS', 24, 1, 720);
  }

  get healthStorageWarnBytes(): number {
    return this.readInt('BACKUP_HEALTH_STORAGE_WARN_BYTES', 50 * 1024 * 1024 * 1024, 1, 10 * 1024 * 1024 * 1024);
  }

  get healthStorageCriticalBytes(): number {
    return this.readInt('BACKUP_HEALTH_STORAGE_CRITICAL_BYTES', 80 * 1024 * 1024 * 1024, 1, 10 * 1024 * 1024 * 1024);
  }

  get healthFailureWindowHours(): number {
    return this.readInt('BACKUP_HEALTH_FAILURE_WINDOW_HOURS', 24, 1, 168);
  }

  get healthFailureWarnCount(): number {
    return this.readInt('BACKUP_HEALTH_FAILURE_WARN_COUNT', 2, 1, 50);
  }

  get healthFailureCriticalCount(): number {
    return this.readInt('BACKUP_HEALTH_FAILURE_CRITICAL_COUNT', 3, 1, 50);
  }

  get healthAlertCooldownHours(): number {
    return this.readInt('BACKUP_HEALTH_ALERT_COOLDOWN_HOURS', 6, 1, 168);
  }

  get gdriveEnabled(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_GDRIVE_ENABLED'), false);
  }

  get gdriveClientId(): string | null {
    const v = this.config.get<string>('BACKUP_GDRIVE_CLIENT_ID')?.trim();
    return v || null;
  }

  get gdriveClientSecret(): string | null {
    const v = this.config.get<string>('BACKUP_GDRIVE_CLIENT_SECRET')?.trim();
    return v || null;
  }

  get gdriveRedirectUri(): string | null {
    const v = this.config.get<string>('BACKUP_GDRIVE_REDIRECT_URI')?.trim();
    return v || null;
  }

  get gdriveRootFolderName(): string {
    return this.config.get<string>('BACKUP_GDRIVE_ROOT_FOLDER_NAME') ?? 'EMDAD WMS Backups';
  }

  get gdriveConnectSuccessUrl(): string | null {
    const v = this.config.get<string>('BACKUP_GDRIVE_CONNECT_SUCCESS_URL')?.trim();
    return v || null;
  }

  gdriveConfigured(): boolean {
    return !!(
      this.gdriveEnabled &&
      this.gdriveClientId &&
      this.gdriveClientSecret &&
      this.gdriveRedirectUri
    );
  }

  /** When true, Drive upload throws after encryption (certification / retry testing only). */
  get gdriveSimulateUploadFailure(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE'), false);
  }

  /** Default storage routing when DB settings row is missing (BACKUP-6B). */
  get defaultStoragePolicy(): BackupStoragePolicy {
    const raw = this.config.get<string>('BACKUP_DEFAULT_STORAGE_POLICY')?.trim().toLowerCase();
    if (raw === 'local_only') return BackupStoragePolicy.local_only;
    if (raw === 'drive_only') return BackupStoragePolicy.drive_only;
    return BackupStoragePolicy.local_and_drive;
  }

  get gdriveRetryMaxAttempts(): number {
    return this.readInt('BACKUP_GDRIVE_RETRY_MAX_ATTEMPTS', 8, 1, 20);
  }

  get gdriveRetryBaseSec(): number {
    return this.readInt('BACKUP_GDRIVE_RETRY_BASE_SEC', 60, 10, 3600);
  }

  get gdriveRetryMaxSec(): number {
    return this.readInt('BACKUP_GDRIVE_RETRY_MAX_SEC', 21_600, 60, 86_400);
  }

  get gdriveRetentionCleanupEnabled(): boolean {
    return this.parseBool(this.config.get<string>('BACKUP_GDRIVE_RETENTION_CLEANUP_ENABLED'), true);
  }

  get gdriveKeepLastDaily(): number {
    return this.readInt('BACKUP_GDRIVE_KEEP_LAST_DAILY', 14, 1, 365);
  }

  get gdriveKeepLastWeekly(): number {
    return this.readInt('BACKUP_GDRIVE_KEEP_LAST_WEEKLY', 8, 1, 120);
  }

  get gdriveKeepLastMonthly(): number {
    return this.readInt('BACKUP_GDRIVE_KEEP_LAST_MONTHLY', 24, 1, 120);
  }

  private readInt(key: string, defaultValue: number, min: number, max: number): number {
    const raw = this.config.get<string>(key);
    if (raw === undefined || raw === '') return defaultValue;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return defaultValue;
    return Math.min(max, Math.max(min, n));
  }

  private parseBool(raw: string | undefined, defaultValue: boolean): boolean {
    if (raw === undefined || raw === '') return defaultValue;
    const v = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return defaultValue;
  }
}
