import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'

export type BackupsTabEntry = {
  id: string
  titleEn: string
  titleAr: string
  path: string
  superAdminOnly?: boolean
}

export const BACKUPS_TABS: BackupsTabEntry[] = [
  {
    id: 'backup-history',
    titleEn: 'Overview',
    titleAr: 'نظرة عامة',
    path: '/backups',
  },
  {
    id: 'backup-schedules',
    titleEn: 'Scheduled Backups',
    titleAr: 'النسخ المجدول',
    path: '/backups/schedules',
  },
  {
    id: 'backup-retention',
    titleEn: 'Retention',
    titleAr: 'الاحتفاظ',
    path: '/backups/retention',
  },
  {
    id: 'backup-health',
    titleEn: 'Health',
    titleAr: 'الصحة',
    path: '/backups/health',
  },
  {
    id: 'backup-google-drive',
    titleEn: 'Google Drive',
    titleAr: 'Google Drive',
    path: '/backups/google-drive',
  },
]

export function getVisibleBackupsTabs(): BackupsTabEntry[] {
  if (isBackupGdriveUiEnabled()) {
    return BACKUPS_TABS
  }
  return BACKUPS_TABS.filter((entry) => entry.id !== 'backup-google-drive')
}
