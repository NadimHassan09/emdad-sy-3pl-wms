import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { BackupsApi, type BackupStatus } from '../api/backups';
import { QK } from '../constants/query-keys';

export type BackupActiveOperation = {
  busy: boolean;
  activeJobId: string | null;
  maintenance: boolean;
  maintenanceReason: string | null;
};

export function useBackupMaintenanceWatch(enabled: boolean, trackedJobId: string | null) {
  const [maintenanceVisible, setMaintenanceVisible] = useState(false);

  const activeQuery = useQuery({
    queryKey: QK.backups.activeOperation,
    queryFn: () => BackupsApi.getActiveOperation(),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.maintenance || trackedJobId) return 2_000;
      return 8_000;
    },
    staleTime: 0,
  });

  const jobId = trackedJobId ?? activeQuery.data?.activeJobId ?? null;

  const statusQuery = useQuery({
    queryKey: QK.backups.status(jobId ?? 'none'),
    queryFn: () => BackupsApi.status(jobId!),
    enabled: enabled && !!jobId && (maintenanceVisible || !!activeQuery.data?.maintenance),
    refetchInterval: 2_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (activeQuery.data?.maintenance) {
      setMaintenanceVisible(true);
      return;
    }
    if (trackedJobId) {
      setMaintenanceVisible(true);
    }
  }, [activeQuery.data?.maintenance, trackedJobId]);

  useEffect(() => {
    const status = statusQuery.data?.status;
    if (maintenanceVisible && status && (status === 'completed' || status === 'failed')) {
      const timer = window.setTimeout(() => setMaintenanceVisible(false), 2_500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [maintenanceVisible, statusQuery.data?.status]);

  const dismiss = useCallback(() => setMaintenanceVisible(false), []);

  return {
    activeOperation: activeQuery.data ?? null,
    jobStatus: statusQuery.data ?? null,
    maintenanceVisible:
      maintenanceVisible &&
      (!!activeQuery.data?.maintenance || !!trackedJobId || !!jobId),
    dismiss,
    isLoading: activeQuery.isLoading,
  };
}

export type { BackupStatus };
