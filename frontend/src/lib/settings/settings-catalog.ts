import { isBackupGdriveUiEnabled } from '../backup-gdrive-ui';

export type SettingsTabEntry = {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  path: string;
  superAdminOnly?: boolean;
};

/** Tab order matches Backup & Recovery dashboard chrome. */
export const SETTINGS_TABS: SettingsTabEntry[] = [
  {
    id: 'backup-history',
    title: 'Overview',
    titleAr: 'نظرة عامة',
    description: 'Backup health, recent jobs, storage, and quick actions.',
    descriptionAr: 'صحة النسخ والمهام الأخيرة والتخزين والإجراءات السريعة.',
    path: '/backups',
  },
  {
    id: 'backup-schedules',
    title: 'Scheduled Backups',
    titleAr: 'النسخ المجدول',
    description: 'Create and manage automated backup schedules.',
    descriptionAr: 'إنشاء وإدارة جداول النسخ الاحتياطي التلقائي.',
    path: '/backups/schedules',
  },
  {
    id: 'backup-retention',
    title: 'Retention',
    titleAr: 'الاحتفاظ',
    description: 'Review retention policies and run manual cleanup.',
    descriptionAr: 'مراجعة سياسات الاحتفاظ وتشغيل التنظيف اليدوي.',
    path: '/backups/retention',
  },
  {
    id: 'backup-health',
    title: 'Health',
    titleAr: 'الصحة',
    description: 'Backup health dashboard, alerts, and monitoring events.',
    descriptionAr: 'لوحة صحة النسخ الاحتياطي والتنبيهات وأحداث المراقبة.',
    path: '/backups/health',
  },
  {
    id: 'backup-google-drive',
    title: 'Google Drive',
    titleAr: 'Google Drive',
    description: 'Connect Google Drive, review sync status, and retry failed uploads.',
    descriptionAr: 'ربط Google Drive ومراجعة حالة المزامنة وإعادة محاولة الرفع الفاشل.',
    path: '/backups/google-drive',
  },
];

const GDRIVE_TAB_ID = 'backup-google-drive';

/** Settings tabs visible in the current deployment (respects BACKUP_GDRIVE_UI_ENABLED). */
export function getVisibleSettingsTabs(): SettingsTabEntry[] {
  if (isBackupGdriveUiEnabled()) {
    return SETTINGS_TABS;
  }
  return SETTINGS_TABS.filter((entry) => entry.id !== GDRIVE_TAB_ID);
}
