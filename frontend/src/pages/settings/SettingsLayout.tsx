import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { SystemMaintenanceScreen } from '../../components/backups/SystemMaintenanceScreen';
import { SettingsNav } from '../../components/settings/SettingsNav';
import { useClaimSectionNav } from '../../components/section-nav-ownership';
import { useAuth } from '../../auth/AuthContext';
import { BackupOperationProvider, useBackupOperationContext } from '../../context/BackupOperationContext';
import { useBackupMaintenanceWatch } from '../../hooks/useBackupMaintenance';

function SettingsLayoutBody() {
  const { user } = useAuth();
  const { trackedJobId, setTrackedJobId } = useBackupOperationContext();
  const watchMaintenance = user?.role === 'super_admin';
  useClaimSectionNav();

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
    <div className="space-y-5 animate-enter">
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
