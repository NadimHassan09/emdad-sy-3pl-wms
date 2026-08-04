import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BackupsApi, type BackupStatus, type BackupSummary } from '../api/backups';
import { QK } from '../constants/query-keys';
import { isBackupRunning } from '../lib/backup-display';

/**
 * Fallback poll for running/pending backup rows when socket push is unavailable.
 * Primary path: `backup.job.progress` via RealtimeProvider.
 */
export function useBackupRunningStatusPoll(rows: BackupSummary[]) {
  const runningIds = useMemo(
    () => rows.filter((row) => isBackupRunning(row.status)).map((row) => row.id),
    [rows],
  );

  const queries = useQueries({
    queries: runningIds.map((id) => ({
      queryKey: QK.backups.status(id),
      queryFn: () => BackupsApi.status(id),
      // Slow safety net only — realtime push owns progress updates.
      refetchInterval: 15_000,
      staleTime: 5_000,
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
        };
      }),
    [rows, statusById],
  );

  const isPolling = runningIds.length > 0;

  return { mergedRows, isPolling, runningIds };
}
