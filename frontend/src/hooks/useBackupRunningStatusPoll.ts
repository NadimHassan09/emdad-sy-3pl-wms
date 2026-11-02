import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BackupsApi, type BackupStatus, type BackupSummary } from '../api/backups';
import { QK } from '../constants/query-keys';
import { isBackupJobId, isBackupRunning } from '../lib/backup-display';

/**
 * Fallback poll for running/pending backup rows when socket push is unavailable.
 * Primary path: `system.version` → backups module refetch (Architecture 2.2).
 * This poll is a degraded fallback when socket sync is unavailable.
 */
export function useBackupRunningStatusPoll(rows: BackupSummary[], intervalMs = 15_000) {
  const runningIds = useMemo(
    () =>
      rows
        .filter((row) => isBackupJobId(row.id) && isBackupRunning(row.status))
        .map((row) => row.id),
    [rows],
  );

  const queries = useQueries({
    queries: runningIds.map((id) => ({
      queryKey: QK.backups.status(id),
      queryFn: () => BackupsApi.status(id),
      enabled: isBackupJobId(id),
      refetchInterval: intervalMs,
      staleTime: Math.min(5_000, intervalMs),
      retry: false,
    })),
  });

  const statusById = useMemo(() => {
    const map = new Map<string, BackupStatus>();
    runningIds.forEach((id, index) => {
      const data = queries[index]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [queries, runningIds]);

  const mergedRows = useMemo(
    () =>
      rows.map((row) => {
        const live = statusById.get(row.id);
        if (!live) return row;
        return {
          ...row,
          status: live.status,
          progressPercent: live.progressPercent,
          bytesWritten: live.bytesWritten,
          completedAt: live.completedAt ?? row.completedAt,
          downloadable:
            live.status === 'completed'
              ? live.bytesWritten > 0
              : live.status === 'failed'
                ? false
                : row.downloadable,
        };
      }),
    [rows, statusById],
  );

  const isPolling = runningIds.length > 0;

  return { mergedRows, isPolling, runningIds };
}
