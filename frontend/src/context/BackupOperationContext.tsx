import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type BackupOperationContextValue = {
  trackedJobId: string | null;
  setTrackedJobId: (id: string | null) => void;
  createBackupRequestId: number;
  requestCreateBackup: () => void;
  createBackupBusy: boolean;
  setCreateBackupBusy: (busy: boolean) => void;
  createScheduleRequestId: number;
  requestCreateSchedule: () => void;
  uploadBackupRequestId: number;
  requestUploadBackup: () => void;
  restoreBackupRequestId: number;
  requestRestoreBackup: () => void;
  factoryResetRequestId: number;
  requestFactoryReset: () => void;
};

const BackupOperationContext = createContext<BackupOperationContextValue | null>(null);

export function BackupOperationProvider({ children }: { children: ReactNode }) {
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [createBackupRequestId, setCreateBackupRequestId] = useState(0);
  const [createBackupBusy, setCreateBackupBusy] = useState(false);
  const [createScheduleRequestId, setCreateScheduleRequestId] = useState(0);
  const [uploadBackupRequestId, setUploadBackupRequestId] = useState(0);
  const [restoreBackupRequestId, setRestoreBackupRequestId] = useState(0);
  const [factoryResetRequestId, setFactoryResetRequestId] = useState(0);

  const requestCreateBackup = useCallback(() => {
    setCreateBackupRequestId((n) => n + 1);
  }, []);
  const requestCreateSchedule = useCallback(() => {
    setCreateScheduleRequestId((n) => n + 1);
  }, []);
  const requestUploadBackup = useCallback(() => {
    setUploadBackupRequestId((n) => n + 1);
  }, []);
  const requestRestoreBackup = useCallback(() => {
    setRestoreBackupRequestId((n) => n + 1);
  }, []);
  const requestFactoryReset = useCallback(() => {
    setFactoryResetRequestId((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      trackedJobId,
      setTrackedJobId,
      createBackupRequestId,
      requestCreateBackup,
      createBackupBusy,
      setCreateBackupBusy,
      createScheduleRequestId,
      requestCreateSchedule,
      uploadBackupRequestId,
      requestUploadBackup,
      restoreBackupRequestId,
      requestRestoreBackup,
      factoryResetRequestId,
      requestFactoryReset,
    }),
    [
      trackedJobId,
      createBackupRequestId,
      requestCreateBackup,
      createBackupBusy,
      createScheduleRequestId,
      requestCreateSchedule,
      uploadBackupRequestId,
      requestUploadBackup,
      restoreBackupRequestId,
      requestRestoreBackup,
      factoryResetRequestId,
      requestFactoryReset,
    ],
  );

  return (
    <BackupOperationContext.Provider value={value}>{children}</BackupOperationContext.Provider>
  );
}

export function useBackupOperationContext(): BackupOperationContextValue {
  const ctx = useContext(BackupOperationContext);
  if (!ctx) {
    throw new Error('useBackupOperationContext must be used within BackupOperationProvider');
  }
  return ctx;
}
