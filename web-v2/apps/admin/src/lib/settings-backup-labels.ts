import type { BackupJobStatus, BackupJobType } from '@/api/backups'
import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'

export type BackupLabelT = (en: string, ar: string) => string

type LocalizedMessage = [string, string]

const BACKUP_TYPE_LABELS: Record<BackupJobType, LocalizedMessage> = {
  manual: ['Manual', 'يدوي'],
  scheduled: ['Scheduled', 'مجدول'],
  upload: ['Upload', 'رفع'],
  restore: ['Restore', 'استعادة'],
  pre_snapshot: ['Pre-snapshot', 'لقطة قبل العملية'],
  factory_reset: ['Factory reset', 'إعادة ضبط المصنع'],
}

const BACKUP_STATUS_LABELS: Record<BackupJobStatus, LocalizedMessage> = {
  pending: ['Pending', 'قيد الانتظار'],
  running: ['Running', 'قيد التشغيل'],
  completed: ['Completed', 'مكتمل'],
  failed: ['Failed', 'فشل'],
}

export function localizedBackupTypeLabel(type: BackupJobType, t: BackupLabelT): string {
  const msg = BACKUP_TYPE_LABELS[type]
  return msg ? t(msg[0], msg[1]) : type
}

export function localizedBackupStatusLabel(status: BackupJobStatus, t: BackupLabelT): string {
  const msg = BACKUP_STATUS_LABELS[status]
  return msg ? t(msg[0], msg[1]) : status
}

export function localizedBackupTypeFilterOptions(t: BackupLabelT) {
  return [
    { value: '', label: t('All types', 'كل الأنواع') },
    { value: 'manual', label: localizedBackupTypeLabel('manual', t) },
    { value: 'scheduled', label: localizedBackupTypeLabel('scheduled', t) },
    { value: 'upload', label: localizedBackupTypeLabel('upload', t) },
    { value: 'pre_snapshot', label: localizedBackupTypeLabel('pre_snapshot', t) },
  ] as const
}

export function localizedBackupStatusFilterOptions(t: BackupLabelT) {
  return [
    { value: '', label: t('All statuses', 'كل الحالات') },
    { value: 'pending', label: localizedBackupStatusLabel('pending', t) },
    { value: 'running', label: localizedBackupStatusLabel('running', t) },
    { value: 'completed', label: localizedBackupStatusLabel('completed', t) },
    { value: 'failed', label: localizedBackupStatusLabel('failed', t) },
  ] as const
}

export function localizedBackupHealthStatus(status: string, t: BackupLabelT): string {
  const map: Record<string, LocalizedMessage> = {
    healthy: ['Healthy', 'سليم'],
    warning: ['Warning', 'تحذير'],
    critical: ['Critical', 'حرج'],
  }
  const msg = map[status]
  return msg ? t(msg[0], msg[1]) : status
}

export function localizedBackupDetailFieldLabels(t: BackupLabelT) {
  return {
    id: t('ID', 'المعرّف'),
    shortId: t('Short ID', 'المعرّف المختصر'),
    type: t('Type', 'النوع'),
    status: t('Status', 'الحالة'),
    label: t('Label', 'التسمية'),
    created: t('Created', 'تاريخ الإنشاء'),
    completed: t('Completed', 'تاريخ الإكمال'),
    createdBy: t('Created by', 'أنشأه'),
    storage: t('Storage', 'التخزين'),
    size: t('Size', 'الحجم'),
    progress: t('Progress', 'التقدم'),
    dumpFile: t('Dump file', 'ملف dump'),
    started: t('Started', 'بدء'),
    checksum: t('Checksum', 'المجموع الاختباري'),
    db: t('DB', 'قاعدة البيانات'),
    pgVersion: t('PG version', 'إصدار PG'),
    storagePolicy: t('Storage policy', 'سياسة التخزين'),
    driveSync: t('Drive sync', 'مزامنة Drive'),
    driveSyncedAt: t('Drive synced at', 'تاريخ مزامنة Drive'),
    driveFileId: t('Drive file ID', 'معرّف ملف Drive'),
    driveSyncError: t('Drive sync error', 'خطأ مزامنة Drive'),
    driveSyncAttempts: t('Sync attempts', 'محاولات المزامنة'),
    driveNextRetry: t('Next retry', 'المحاولة التالية'),
  }
}

export function localizedScheduleFrequencyOptions(t: BackupLabelT) {
  return [
    { value: 'daily', label: t('Daily', 'يومي') },
    { value: 'weekly', label: t('Weekly', 'أسبوعي') },
    { value: 'monthly', label: t('Monthly', 'شهري') },
  ] as const
}

const STORAGE_POLICY_LABELS: Record<string, LocalizedMessage> = {
  local_only: ['Local only', 'محلي فقط'],
  drive_only: ['Google Drive only', 'Google Drive فقط'],
  local_and_drive: ['Local + Google Drive', 'محلي + Google Drive'],
}

const STORAGE_POLICY_LABELS_UI_HIDDEN: Record<string, LocalizedMessage> = {
  local_only: ['Local only', 'محلي فقط'],
  drive_only: ['Off-site only', 'خارج الموقع فقط'],
  local_and_drive: ['Local + off-site', 'محلي + خارج الموقع'],
}

export function localizedBackupStoragePolicyLabel(policy: string, t: BackupLabelT): string {
  const map = isBackupGdriveUiEnabled() ? STORAGE_POLICY_LABELS : STORAGE_POLICY_LABELS_UI_HIDDEN
  const msg = map[policy]
  return msg ? t(msg[0], msg[1]) : policy
}

export function localizedBackupStoragePolicyOptions(t: BackupLabelT) {
  const all = [
    { value: 'local_only', label: localizedBackupStoragePolicyLabel('local_only', t) },
    { value: 'drive_only', label: localizedBackupStoragePolicyLabel('drive_only', t) },
    { value: 'local_and_drive', label: localizedBackupStoragePolicyLabel('local_and_drive', t) },
  ] as const
  if (isBackupGdriveUiEnabled()) {
    return all
  }
  return all.filter((opt) => opt.value === 'local_only')
}

export function localizedScheduleStoragePolicyLabel(
  policy: string | null | undefined,
  t: BackupLabelT,
): string {
  if (policy == null) {
    return t('Global default', 'الافتراضي العام')
  }
  return localizedBackupStoragePolicyLabel(policy, t)
}

export function localizedScheduleStoragePolicyOptions(t: BackupLabelT) {
  return [
    { value: '', label: localizedScheduleStoragePolicyLabel(null, t) },
    ...localizedBackupStoragePolicyOptions(t),
  ] as const
}

export function localizedGoogleDriveSyncStatus(
  status: 'disabled' | 'not_connected' | 'failed' | 'pending' | 'healthy' | 'idle',
  t: BackupLabelT,
): string {
  const map: Record<typeof status, LocalizedMessage> = {
    disabled: ['Disabled', 'معطّل'],
    not_connected: ['Not connected', 'غير متصل'],
    failed: ['Sync failures', 'فشل المزامنة'],
    pending: ['Sync pending', 'مزامنة قيد الانتظار'],
    healthy: ['Healthy', 'سليم'],
    idle: ['Connected — no syncs yet', 'متصل — لا مزامنات بعد'],
  }
  const msg = map[status]
  return t(msg[0], msg[1])
}
