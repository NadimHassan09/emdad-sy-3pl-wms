import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { AppPageHeader } from '@ds';

import { SystemMaintenanceScreen } from '../../components/backups/SystemMaintenanceScreen';
import { SettingsNav } from '../../components/settings/SettingsNav';
import { useAuth } from '../../auth/AuthContext';
import { BackupOperationProvider, useBackupOperationContext } from '../../context/BackupOperationContext';
import { useBackupMaintenanceWatch } from '../../hooks/useBackupMaintenance';
import { useWmsTranslation } from '../../lib/ui-i18n';

function SettingsLayoutBody() {
  const { t } = useWmsTranslation();
  const { user } = useAuth();
  const { trackedJobId, setTrackedJobId } = useBackupOperationContext();
  const watchMaintenance = user?.role === 'super_admin';

  const { activeOperation, jobStatus, maintenanceVisible } = useBackupMaintenanceWatch(
    watchMaintenance,
    trackedJobId,
  );

  useEffect(() => {
    if (jobStatus?.status === 'completed' || jobStatus?.status === 'failed') {
      setTrackedJobId(null);
    }
  }, [jobStatus?.status, setTrackedJobId]);

  return (
    <div className="space-y-4">
      <AppPageHeader
        title={t(['Settings', 'الإعدادات'])}
        description={t([
          'System configuration and backup administration.',
          'إعدادات النظام وإدارة النسخ الاحتياطي.',
        ])}
      />

      <SettingsNav />

      <Outlet />

      {maintenanceVisible ? (
        <SystemMaintenanceScreen
          activeOperation={activeOperation}
          jobStatus={jobStatus}
        />
      ) : null}
    </div>
  );
}

export function SettingsLayout() {
  return (
    <BackupOperationProvider>
      <SettingsLayoutBody />
    </BackupOperationProvider>
  );
}
