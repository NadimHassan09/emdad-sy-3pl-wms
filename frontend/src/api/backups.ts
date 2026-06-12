import { api, type PageResult } from './client';

export type BackupJobType =
  | 'manual'
  | 'scheduled'
  | 'upload'
  | 'restore'
  | 'pre_snapshot'
  | 'factory_reset';

export type BackupJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type BackupTriggeredBy = {
  id: string;
  email: string;
  fullName: string;
};

export type BackupManifest = {
  environmentId?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  dbName?: string;
  pgVersion?: string | null;
  createdAt?: string;
};

export type BackupSummary = {
  id: string;
  type: BackupJobType;
  status: BackupJobStatus;
  label: string | null;
  progressPercent: number;
  bytesWritten: number;
  createdAt: string;
  completedAt: string | null;
  triggeredBy: BackupTriggeredBy;
  manifest: BackupManifest | null;
  storagePolicy: BackupStoragePolicyValue | null;
  gdriveSyncStatus: 'pending' | 'synced' | 'failed' | null;
  gdriveSyncedAt: string | null;
};

export type BackupDetail = BackupSummary & {
  dumpFilename: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  gdriveFileId: string | null;
  gdriveSyncError: string | null;
  gdriveSyncAttempts: number;
  gdriveNextRetryAt: string | null;
};

export type BackupStatus = {
  id: string;
  status: BackupJobStatus;
  progressPercent: number;
  bytesWritten: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type ListBackupsParams = {
  limit?: number;
  offset?: number;
  type?: Extract<BackupJobType, 'manual' | 'scheduled' | 'upload' | 'pre_snapshot'>;
  status?: BackupJobStatus;
  search?: string;
};

export type BackupDownloadUrl = {
  backupId: string;
  token: string;
  downloadUrl: string;
  expiresAt: string;
  expiresInSec: number;
};

export type BackupUploadResult = {
  jobId: string;
  status: BackupJobStatus;
  sizeBytes: number;
  checksumSha256: string;
  tocEntries?: number;
};

export type BackupRestoreResult = {
  restoreJobId: string;
  sourceBackupId: string;
  status: BackupJobStatus;
};

export type BackupFactoryResetResult = {
  resetJobId: string;
  status: BackupJobStatus;
};

export type BackupActiveOperation = {
  busy: boolean;
  activeJobId: string | null;
  maintenance: boolean;
  maintenanceReason: string | null;
};

export type UploadProgressHandler = (percent: number, phase: 'uploading' | 'processing') => void;

export type BackupScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export type BackupStoragePolicyValue = 'local_only' | 'drive_only' | 'local_and_drive';

export type BackupScheduleUser = {
  id: string;
  email: string;
  fullName: string;
};

export type BackupSchedule = {
  id: string;
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  hour: number;
  minute: number;
  retentionDays: number;
  storagePolicy: BackupStoragePolicyValue | null;
  effectiveStoragePolicy?: BackupStoragePolicyValue;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: BackupScheduleUser;
  updatedBy?: BackupScheduleUser;
};

export type BackupScheduleListResult = {
  items: BackupSchedule[];
};

export type CreateBackupScheduleInput = {
  frequency: BackupScheduleFrequency;
  hour: number;
  minute: number;
  retentionDays: number;
  storagePolicy?: BackupStoragePolicyValue | null;
  enabled?: boolean;
};

export type UpdateBackupScheduleInput = Partial<CreateBackupScheduleInput>;

export type BackupScheduleRunNowResult = {
  jobId: string;
};

export type BackupRetentionPolicies = {
  keepLastDaily: number;
  keepLastWeekly: number;
  keepLastMonthly: number;
  preSnapshotProtectDays: number;
  retentionCleanupEnabled: boolean;
};

export type DriveRetentionPolicies = {
  keepLastDaily: number;
  keepLastWeekly: number;
  keepLastMonthly: number;
  driveRetentionCleanupEnabled: boolean;
};

export type DriveRetentionCleanupResult = {
  dryRun: boolean;
  policies: {
    keepLastDaily: number;
    keepLastWeekly: number;
    keepLastMonthly: number;
  };
  buckets: RetentionBucketSummary[];
  protected: ProtectedBackupSummary[];
  deletedDriveCount: number;
  deletedJobCount: number;
  deletedDriveJobIds: string[];
  deletedJobIds: string[];
};

export type RetentionBucket = 'daily' | 'weekly' | 'monthly';

export type RetentionProtectionReason =
  | 'latest_successful'
  | 'active_operation'
  | 'pre_snapshot_age'
  | 'retained_in_bucket';

export type ProtectedBackupSummary = {
  jobId: string;
  type: string;
  label: string | null;
  completedAt: string | null;
  reasons: RetentionProtectionReason[];
};

export type RetentionBucketSummary = {
  bucket: RetentionBucket;
  keepLast: number;
  totalEligible: number;
  retainedCount: number;
  expiredCount: number;
  retainedJobIds: string[];
  expiredJobIds: string[];
};

export type RetentionCleanupResult = {
  dryRun: boolean;
  policies: {
    keepLastDaily: number;
    keepLastWeekly: number;
    keepLastMonthly: number;
    preSnapshotProtectDays: number;
  };
  buckets: RetentionBucketSummary[];
  protected: ProtectedBackupSummary[];
  deletedCount: number;
  bytesReclaimed: number;
  deletedJobIds: string[];
};

export type BackupHealthSeverity = 'healthy' | 'warning' | 'critical';

export type BackupHealthAlert = {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
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
  runningOperation: {
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
  backupCount: number;
  storageUsedBytes: number;
  nextScheduledBackupAt: string | null;
  retentionStatus: {
    policies: BackupRetentionPolicies;
    eligibleCompletedCount: number;
    pendingDeletionCount: number;
    lastCleanupAt: string | null;
    lastCleanupDeletedCount: number | null;
  };
  driveStatus: BackupDriveHealthStatus;
  metrics: BackupHealthMetrics;
  healthStatus: BackupHealthSeverity;
  alerts: BackupHealthAlert[];
};

export type BackupStoragePolicySettings = {
  defaultPolicy: BackupStoragePolicyValue;
  envFallbackPolicy: BackupStoragePolicyValue;
  effectiveDefaultPolicy: BackupStoragePolicyValue;
  updatedAt: string;
  updatedByUserId: string | null;
};

export type GoogleDriveConnectedBy = {
  id: string;
  email: string;
  fullName: string;
};

export type GoogleDriveSyncFailure = {
  id: string;
  type: string;
  label: string | null;
  completedAt: string | null;
  storagePolicy: BackupStoragePolicyValue;
  gdriveSyncError: string | null;
  gdriveSyncAttempts: number;
  gdriveNextRetryAt: string | null;
};

export type GoogleDriveAdminStatus = {
  connected: boolean;
  folderId: string | null;
  connectedAt: string | null;
  connectedBy: GoogleDriveConnectedBy | null;
  rootFolderName: string;
  gdriveEnabled: boolean;
  gdriveConfigured: boolean;
  lastSyncedAt: string | null;
  pendingSyncCount: number;
  failedSyncCount: number;
  syncFailures: GoogleDriveSyncFailure[];
};

export type GoogleDriveAuthUrl = {
  url: string;
  state: string;
};

export type GoogleDriveTestResult = {
  ok?: boolean;
  connected?: boolean;
  message?: string;
  folderName?: string | null;
  folderId?: string;
};

export type GoogleDriveDisconnectResult = {
  disconnected: boolean;
};

export type BackupDriveSyncResult = {
  id: string;
  gdriveSyncStatus: 'pending' | 'synced' | 'failed' | null;
  gdriveFileId: string | null;
  gdriveSyncedAt: string | null;
  gdriveSyncError: string | null;
  gdriveSyncAttempts: number;
  gdriveNextRetryAt: string | null;
};

export type CreateBackupInput = {
  label?: string;
  storagePolicy?: BackupStoragePolicyValue;
};

export type CreateBackupResult = {
  jobId: string;
  status: BackupJobStatus;
  storagePolicy: BackupStoragePolicyValue;
  createdAt: string;
};

export const BackupsApi = {
  list(params: ListBackupsParams = {}): Promise<PageResult<BackupSummary>> {
    return api
      .get<PageResult<BackupSummary>>('/backups', { params })
      .then((r) => r.data);
  },

  async listAll(batchSize = 50): Promise<BackupSummary[]> {
    const all: BackupSummary[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const page = await this.list({ limit: batchSize, offset });
      all.push(...page.items);
      total = page.total;
      offset += batchSize;
      if (page.items.length === 0) break;
    }

    return all;
  },

  create(body: CreateBackupInput = {}): Promise<CreateBackupResult> {
    return api.post<CreateBackupResult>('/backups', body).then((r) => r.data);
  },

  getById(id: string): Promise<BackupDetail> {
    return api.get<BackupDetail>(`/backups/${id}`).then((r) => r.data);
  },

  status(id: string): Promise<BackupStatus> {
    return api.get<BackupStatus>(`/backups/${id}/status`).then((r) => r.data);
  },

  issueDownloadUrl(id: string): Promise<BackupDownloadUrl> {
    return api.post<BackupDownloadUrl>(`/backups/${id}/download-url`).then((r) => r.data);
  },

  getActiveOperation(): Promise<BackupActiveOperation> {
    return api.get<BackupActiveOperation>('/backups/operations/active').then((r) => r.data);
  },

  async upload(
    file: File,
    onProgress?: UploadProgressHandler,
  ): Promise<BackupUploadResult> {
    const form = new FormData();
    form.append('file', file);

    const response = await api.post<BackupUploadResult>('/backups/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        onProgress(pct, 'uploading');
      },
    });

    onProgress?.(100, 'processing');
    return response.data;
  },

  restore(
    sourceBackupId: string,
    body: { confirmPhrase: 'RESTORE'; createPreSnapshot?: boolean },
  ): Promise<BackupRestoreResult> {
    return api
      .post<BackupRestoreResult>(`/backups/${sourceBackupId}/restore`, body)
      .then((r) => r.data);
  },

  factoryReset(body: {
    confirmPhrase: 'FACTORY RESET';
    createPreSnapshot?: boolean;
  }): Promise<BackupFactoryResetResult> {
    return api.post<BackupFactoryResetResult>('/backups/factory-reset', body).then((r) => r.data);
  },

  /** List backups eligible for restore (completed manual/upload with data). */
  async listRestorable(): Promise<BackupSummary[]> {
    const all = await this.listAll();
    return all.filter(
      (row) =>
        row.status === 'completed' &&
        row.bytesWritten > 0 &&
        (row.type === 'manual' || row.type === 'upload'),
    );
  },

  listSchedules(): Promise<BackupScheduleListResult> {
    return api.get<BackupScheduleListResult>('/backups/schedules').then((r) => r.data);
  },

  createSchedule(body: CreateBackupScheduleInput): Promise<BackupSchedule> {
    return api.post<BackupSchedule>('/backups/schedules', body).then((r) => r.data);
  },

  updateSchedule(id: string, body: UpdateBackupScheduleInput): Promise<BackupSchedule> {
    return api.patch<BackupSchedule>(`/backups/schedules/${id}`, body).then((r) => r.data);
  },

  runScheduleNow(id: string): Promise<BackupScheduleRunNowResult> {
    return api.post<BackupScheduleRunNowResult>(`/backups/schedules/${id}/run-now`).then((r) => r.data);
  },

  getRetentionPolicies(): Promise<BackupRetentionPolicies> {
    return api.get<BackupRetentionPolicies>('/backups/retention/policies').then((r) => r.data);
  },

  previewRetentionCleanup(): Promise<RetentionCleanupResult> {
    return api.get<RetentionCleanupResult>('/backups/retention/preview').then((r) => r.data);
  },

  runRetentionCleanup(): Promise<RetentionCleanupResult> {
    return api.post<RetentionCleanupResult>('/backups/retention/cleanup').then((r) => r.data);
  },

  getDriveRetentionPolicies(): Promise<DriveRetentionPolicies> {
    return api.get<DriveRetentionPolicies>('/backups/retention/drive/policies').then((r) => r.data);
  },

  previewDriveRetentionCleanup(): Promise<DriveRetentionCleanupResult> {
    return api.get<DriveRetentionCleanupResult>('/backups/retention/drive/preview').then((r) => r.data);
  },

  runDriveRetentionCleanup(): Promise<DriveRetentionCleanupResult> {
    return api.post<DriveRetentionCleanupResult>('/backups/retention/drive/cleanup').then((r) => r.data);
  },

  getHealth(): Promise<BackupHealthResponse> {
    return api.get<BackupHealthResponse>('/backups/health').then((r) => r.data);
  },

  evaluateHealthAlerts(): Promise<{ healthStatus: BackupHealthSeverity; alerts: BackupHealthAlert[] }> {
    return api
      .post<{ healthStatus: BackupHealthSeverity; alerts: BackupHealthAlert[] }>(
        '/backups/health/evaluate-alerts',
      )
      .then((r) => r.data);
  },

  getStoragePolicy(): Promise<BackupStoragePolicySettings> {
    return api.get<BackupStoragePolicySettings>('/backups/storage-policy').then((r) => r.data);
  },

  updateStoragePolicy(defaultPolicy: BackupStoragePolicyValue): Promise<{
    defaultPolicy: BackupStoragePolicyValue;
    updatedAt: string;
  }> {
    return api
      .put<{ defaultPolicy: BackupStoragePolicyValue; updatedAt: string }>(
        '/backups/storage-policy',
        { defaultPolicy },
      )
      .then((r) => r.data);
  },

  syncToDrive(jobId: string): Promise<BackupDriveSyncResult> {
    return api.post<BackupDriveSyncResult>(`/backups/${jobId}/sync-drive`).then((r) => r.data);
  },

  getGoogleDriveStatus(): Promise<GoogleDriveAdminStatus> {
    return api.get<GoogleDriveAdminStatus>('/integrations/google-drive/status').then((r) => r.data);
  },

  getGoogleDriveAuthUrl(): Promise<GoogleDriveAuthUrl> {
    return api.get<GoogleDriveAuthUrl>('/integrations/google-drive/auth-url').then((r) => r.data);
  },

  testGoogleDriveConnection(): Promise<GoogleDriveTestResult> {
    return api.post<GoogleDriveTestResult>('/integrations/google-drive/test').then((r) => r.data);
  },

  disconnectGoogleDrive(): Promise<GoogleDriveDisconnectResult> {
    return api.delete<GoogleDriveDisconnectResult>('/integrations/google-drive').then((r) => r.data);
  },

  async download(id: string, filenameHint?: string | null): Promise<void> {
    const { token } = await this.issueDownloadUrl(id);
    const response = await api.get<Blob>(`/backups/${id}/download`, {
      params: { token },
      responseType: 'blob',
    });

    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? filenameHint ?? `${id}.dump`;

    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
