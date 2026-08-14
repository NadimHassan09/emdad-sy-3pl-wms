import { useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import { useBackupOperationContext } from '../../context/BackupOperationContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { getVisibleSettingsTabs } from '../../lib/settings/settings-catalog';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';
import { PillSubNav } from '../PillSubNav';

export function SettingsNav() {
  const { t } = useWmsTranslation();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { canMutate } = useBackupAdminAccess();
  const {
    requestCreateBackup,
    createBackupBusy,
    requestCreateSchedule,
    requestUploadBackup,
    requestRestoreBackup,
    requestFactoryReset,
  } = useBackupOperationContext();
  const tabs = getVisibleSettingsTabs().filter(
    (entry) => !entry.superAdminOnly || user?.role === 'super_admin',
  );

  const onOverview = pathname === '/backups' || pathname === '/backups/';
  const onSchedules = pathname === '/backups/schedules' || pathname.startsWith('/backups/schedules/');

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <PillSubNav
          ariaLabel={t(['Backups navigation', 'تنقل النسخ الاحتياطي'])}
          className="mb-0"
          items={tabs.map((entry) => ({
            key: entry.id,
            label: t([entry.title, entry.titleAr]),
            to: entry.path,
          }))}
        />
      </div>
      {canMutate && onOverview ? (
        <>
          <Button
            type="button"
            variant="brand"
            onClick={requestRestoreBackup}
            data-testid="restore-backup-btn"
            className="shrink-0"
          >
            {t(['Restore', 'استعادة'])}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={requestFactoryReset}
            data-testid="factory-reset-btn"
            className="shrink-0"
          >
            {t(['Factory Reset', 'إعادة ضبط المصنع'])}
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={requestUploadBackup}
            data-testid="upload-backup-btn"
            className="shrink-0"
          >
            {t(['Upload', 'رفع'])}
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={requestCreateBackup}
            disabled={createBackupBusy}
            data-testid="create-backup-btn"
            className="shrink-0"
          >
            {t(['Create Backup', 'إنشاء نسخة احتياطية'])}
          </Button>
        </>
      ) : null}
      {canMutate && onSchedules ? (
        <Button
          type="button"
          variant="brand"
          onClick={requestCreateSchedule}
          data-testid="create-schedule-btn"
          className="shrink-0"
        >
          {t(['Create schedule', 'إنشاء جدولة'])}
        </Button>
      ) : null}
    </div>
  );
}
