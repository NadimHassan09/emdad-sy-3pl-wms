import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type BackupOperationContextValue = {
  trackedJobId: string | null;
  setTrackedJobId: (id: string | null) => void;
};

const BackupOperationContext = createContext<BackupOperationContextValue | null>(null);

export function BackupOperationProvider({ children }: { children: ReactNode }) {
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const value = useMemo(() => ({ trackedJobId, setTrackedJobId }), [trackedJobId]);
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
