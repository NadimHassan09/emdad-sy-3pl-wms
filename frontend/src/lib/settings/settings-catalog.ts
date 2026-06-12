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

export const SETTINGS_TABS: SettingsTabEntry[] = [
  {
    id: 'backup-history',
    title: 'History',
    titleAr: 'السجل',
    description: 'Browse backup jobs, download dumps, and monitor running operations.',
    descriptionAr: 'استعراض مهام النسخ الاحتياطي وتنزيل الملفات ومتابعة العمليات الجارية.',
    path: '/settings/backups',
  },
  {
    id: 'backup-upload',
    title: 'Upload',
    titleAr: 'رفع',
    description: 'Drag-and-drop PostgreSQL dump upload with validation.',
    descriptionAr: 'رفع ملف dump مع التحقق.',
    path: '/settings/backups/upload',
    superAdminOnly: true,
  },
  {
    id: 'backup-restore',
    title: 'Restore',
    titleAr: 'استعادة',
    description: 'Replace the database from a completed backup.',
    descriptionAr: 'استبدال قاعدة البيانات من نسخة مكتملة.',
    path: '/settings/backups/restore',
    superAdminOnly: true,
  },
  {
    id: 'factory-reset',
    title: 'Factory Reset',
    titleAr: 'إعادة ضبط المصنع',
    description: 'Danger zone — wipe business data and re-seed.',
    descriptionAr: 'منطقة خطرة — مسح البيانات وإعادة البذر.',
    path: '/settings/backups/factory-reset',
    superAdminOnly: true,
  },
  {
    id: 'backup-schedules',
    title: 'Scheduled Backups',
    titleAr: 'النسخ المجدول',
    description: 'Create and manage automated backup schedules.',
    descriptionAr: 'إنشاء وإدارة جداول النسخ الاحتياطي التلقائي.',
    path: '/settings/backups/schedules',
  },
  {
    id: 'backup-retention',
    title: 'Retention',
    titleAr: 'الاحتفاظ',
    description: 'Review retention policies and run manual cleanup.',
    descriptionAr: 'مراجعة سياسات الاحتفاظ وتشغيل التنظيف اليدوي.',
    path: '/settings/backups/retention',
  },
  {
    id: 'backup-health',
    title: 'Health',
    titleAr: 'الصحة',
    description: 'Backup health dashboard, alerts, and monitoring events.',
    descriptionAr: 'لوحة صحة النسخ الاحتياطي والتنبيهات وأحداث المراقبة.',
    path: '/settings/backups/health',
  },
  {
    id: 'backup-storage-policy',
    title: 'Storage Policy',
    titleAr: 'سياسة التخزين',
    description: isBackupGdriveUiEnabled()
      ? 'Global backup storage routing, usage indicators, and Drive sync summary.'
      : 'Global backup storage routing and local usage indicators.',
    descriptionAr: isBackupGdriveUiEnabled()
      ? 'توجيه التخزين العام ومؤشرات الاستخدام وملخص مزامنة Drive.'
      : 'توجيه التخزين العام ومؤشرات الاستخدام المحلي.',
    path: '/settings/backups/storage-policy',
  },
  {
    id: 'backup-google-drive',
    title: 'Google Drive',
    titleAr: 'Google Drive',
    description: 'Connect Google Drive, review sync status, and retry failed uploads.',
    descriptionAr: 'ربط Google Drive ومراجعة حالة المزامنة وإعادة محاولة الرفع الفاشل.',
    path: '/settings/backups/google-drive',
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
