export type BackupHealthSeverity = 'healthy' | 'warning' | 'critical';

export type BackupHealthAlertCode =
  | 'stale_successful_backup'
  | 'storage_threshold'
  | 'repeated_failures'
  | 'gdrive_not_configured'
  | 'gdrive_not_connected'
  | 'gdrive_sync_failures'
  | 'gdrive_pending_sync'
  | 'gdrive_stale_sync';

export type BackupHealthAlert = {
  code: BackupHealthAlertCode;
  severity: 'warning' | 'critical';
  message: string;
};

export type BackupRunningOperation = {
  busy: boolean;
  activeJobId: string | null;
  maintenance: boolean;
  maintenanceReason: string | null;
  job: {
    id: string;
    type: string;
    status: string;
    label: string | null;
  } | null;
};

export type BackupRetentionStatus = {
  policies: {
    keepLastDaily: number;
    keepLastWeekly: number;
    keepLastMonthly: number;
    preSnapshotProtectDays: number;
    retentionCleanupEnabled: boolean;
  };
  eligibleCompletedCount: number;
  pendingDeletionCount: number;
  lastCleanupAt: string | null;
  lastCleanupDeletedCount: number | null;
};

export type BackupHealthMetrics = {
  hoursSinceLastSuccessfulBackup: number | null;
  hoursSinceLastFailedBackup: number | null;
  storageUsedBytes: number;
  oldestBackupAgeHours: number | null;
  recentFailureCount: number;
};

export type BackupDriveHealthStatus = {
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  lastSyncedAt: string | null;
  pendingSyncCount: number;
  failedSyncCount: number;
  hoursSinceLastSync: number | null;
};

export type BackupHealthResponse = {
  lastSuccessfulBackupAt: string | null;
  lastFailedBackupAt: string | null;
  runningOperation: BackupRunningOperation;
  backupCount: number;
  storageUsedBytes: number;
  nextScheduledBackupAt: string | null;
  retentionStatus: BackupRetentionStatus;
  driveStatus: BackupDriveHealthStatus;
  metrics: BackupHealthMetrics;
  healthStatus: BackupHealthSeverity;
  alerts: BackupHealthAlert[];
};
