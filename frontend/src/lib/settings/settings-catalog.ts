import { isBackupGdriveUiEnabled } from '../backup-gdrive-ui';
import { isGoogleAuthUiEnabled } from '../google-auth-ui';

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
  {
    id: 'google-oauth',
    title: 'Google OAuth',
    titleAr: 'Google OAuth',
    description: 'Google OAuth credentials for client Sheets integration.',
    descriptionAr: 'بيانات Google OAuth لربط شيتات العملاء.',
    path: '/backups/google-oauth-settings',
    superAdminOnly: true,
  },
];

const GDRIVE_TAB_ID = 'backup-google-drive';
const GOOGLE_OAUTH_TAB_ID = 'google-oauth';

/** Settings tabs visible in the current deployment (GDrive + Google OAuth UI flags). */
export function getVisibleSettingsTabs(): SettingsTabEntry[] {
  return SETTINGS_TABS.filter((entry) => {
    if (entry.id === GDRIVE_TAB_ID && !isBackupGdriveUiEnabled()) return false;
    if (entry.id === GOOGLE_OAUTH_TAB_ID && !isGoogleAuthUiEnabled()) return false;
    return true;
  });
}
