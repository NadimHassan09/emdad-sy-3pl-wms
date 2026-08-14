import type { Tone } from '@ds';
import type { BackupJobStatus, BackupJobType, BackupManifest, BackupStoragePolicyValue, BackupSummary } from '../api/backups';

export function formatBackupTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatBackupBytes(bytes: number | null | undefined): string {
  const n = bytes ?? 0;
  if (n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatBackupType(type: BackupJobType): string {
  const labels: Record<BackupJobType, string> = {
    manual: 'Manual',
    scheduled: 'Scheduled',
    upload: 'Upload',
    restore: 'Restore',
    pre_snapshot: 'Pre-snapshot',
    factory_reset: 'Factory reset',
  };
  return labels[type] ?? type;
}

export function backupStatusBadgeClass(status: BackupJobStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-status-success-bg text-status-success-fg ring-status-success-border';
    case 'running':
      return 'bg-status-info-bg text-status-info-fg ring-status-info-border';
    case 'pending':
      return 'bg-status-warning-bg text-status-warning-fg ring-status-warning-border';
    case 'failed':
      return 'bg-status-danger-bg text-status-danger-fg ring-status-danger-border';
    default:
      return 'bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-border';
  }
}

export function formatBackupStorage(manifest: BackupManifest | null | undefined): string {
  const env = manifest?.environmentId?.trim();
  return env ? `VPS (${env})` : 'VPS (local)';
}

export function backupCreatedByLabel(
  row: Pick<BackupSummary, 'triggeredBy' | 'type'>,
): string {
  if (row.type === 'scheduled') return 'system';
  return row.triggeredBy.fullName?.trim() || row.triggeredBy.email || row.triggeredBy.id;
}

export function backupTypeTone(type: BackupJobType): Tone {
  switch (type) {
    case 'manual':
      return 'brand';
    case 'scheduled':
      return 'info';
    case 'upload':
      return 'accent';
    case 'pre_snapshot':
      return 'warning';
    case 'restore':
      return 'success';
    case 'factory_reset':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function isBackupRunning(status: BackupJobStatus): boolean {
  return status === 'pending' || status === 'running';
}

/** Show live progress only when bytes are being written or progress has advanced past startup. */
export function shouldShowBackupProgress(
  row: Pick<BackupSummary, 'status' | 'progressPercent' | 'bytesWritten'>,
): boolean {
  if (!isBackupRunning(row.status)) return false;
  if (row.bytesWritten > 0) return true;
  return row.progressPercent > 0;
}

export function truncateBackupId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 3) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function formatBackupStoragePolicy(
  policy: BackupStoragePolicyValue | null | undefined,
): string {
  if (!policy) return '—';
  const labels: Record<BackupStoragePolicyValue, string> = {
    local_only: 'Local only',
    drive_only: 'Drive only',
    local_and_drive: 'Local + Drive',
  };
  return labels[policy] ?? policy;
}

export type GdriveSyncStatus = 'pending' | 'synced' | 'failed' | null;

export function gdriveSyncBadgeClass(status: GdriveSyncStatus): string {
  switch (status) {
    case 'synced':
      return 'bg-status-success-bg text-status-success-fg ring-status-success-border';
    case 'pending':
      return 'bg-status-warning-bg text-status-warning-fg ring-status-warning-border';
    case 'failed':
      return 'bg-status-danger-bg text-status-danger-fg ring-status-danger-border';
    default:
      return 'bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-border';
  }
}

export function formatGdriveSyncStatus(
  status: GdriveSyncStatus,
  storagePolicy: BackupStoragePolicyValue | null | undefined,
): string {
  if (storagePolicy === 'local_only') return 'N/A';
  if (!status) return '—';
  const labels: Record<Exclude<GdriveSyncStatus, null>, string> = {
    pending: 'Pending',
    synced: 'Synced',
    failed: 'Failed',
  };
  return labels[status];
}

const DOWNLOADABLE_BACKUP_TYPES: BackupJobType[] = [
  'manual',
  'scheduled',
  'upload',
  'pre_snapshot',
];

/** Jobs with an on-disk PostgreSQL dump (not restore/factory-reset metadata rows). */
export function isBackupDownloadable(
  row: Pick<BackupSummary, 'type' | 'status' | 'bytesWritten'>,
): boolean {
  return (
    row.status === 'completed' &&
    row.bytesWritten > 0 &&
    DOWNLOADABLE_BACKUP_TYPES.includes(row.type)
  );
}
