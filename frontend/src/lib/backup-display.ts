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

const BACKUP_JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBackupJobId(value: unknown): value is string {
  return typeof value === 'string' && BACKUP_JOB_ID_RE.test(value.trim());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function jobIdFromRecord(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  for (const key of ['jobId', 'id', 'job_id', 'backupId', 'backup_id']) {
    const raw = row[key];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (isBackupJobId(trimmed)) return trimmed;
  }
  return null;
}

/** Accepts a create-backup payload, including a still-wrapped `{ data }` envelope. */
export function resolveCreatedBackupJobId(result: unknown): string | null {
  let value: unknown = result;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isBackupJobId(trimmed)) return trimmed;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }

  const root = asRecord(value);
  if (!root) return null;

  const direct = jobIdFromRecord(root);
  if (direct) return direct;

  const nested = asRecord(root.data);
  const fromData = jobIdFromRecord(nested);
  if (fromData) return fromData;

  return jobIdFromRecord(asRecord(nested?.data));
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
  row: Pick<BackupSummary, 'type' | 'status' | 'bytesWritten' | 'downloadable'>,
): boolean {
  if (row.downloadable === false) return false;
  if (row.downloadable === true) return true;
  return (
    row.status === 'completed' &&
    row.bytesWritten > 0 &&
    DOWNLOADABLE_BACKUP_TYPES.includes(row.type)
  );
}

export function formatCooldownClock(totalSeconds: number, isArabic: boolean): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (isArabic) {
    if (hours > 0) return `${hours} س ${minutes} د`;
    if (minutes > 0) return seconds > 0 ? `${minutes} د ${seconds} ث` : `${minutes} د`;
    return `${seconds} ث`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

export function manualBackupErrorMessage(
  err: unknown,
  isArabic: boolean,
): string | null {
  const e = err as {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
  if (!e) return null;
  if (e.code === 'BACKUP_MANUAL_COOLDOWN') {
    const remaining = Number(e.fields?.remainingSeconds ?? 0);
    const clock = formatCooldownClock(remaining, isArabic);
    return isArabic
      ? `يرجى الانتظار ${clock} قبل إنشاء نسخة يدوية أخرى.`
      : `Please wait ${clock} before creating another manual backup.`;
  }
  if (e.code === 'BACKUP_MANUAL_IN_PROGRESS') {
    return isArabic
      ? 'هناك نسخة يدوية قيد التنفيذ. انتظر حتى تكتمل قبل البدء بأخرى.'
      : 'A manual backup is already running. Wait for it to finish before starting another.';
  }
  if (e.code === 'BACKUP_OPERATION_IN_PROGRESS') {
    return isArabic
      ? 'هناك عملية نسخ احتياطي قيد التنفيذ. انتظر حتى تكتمل.'
      : 'A backup operation is already running. Wait for it to finish.';
  }
  return e.message ?? null;
}
