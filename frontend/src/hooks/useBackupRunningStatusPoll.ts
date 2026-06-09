import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BackupsApi, type BackupStatus, type BackupSummary } from '../api/backups';
import { QK } from '../constants/query-keys';
import { isBackupRunning } from '../lib/backup-display';

/**
 * Polls GET /backups/:id/status every 3s for running/pending jobs visible in the table.
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
      refetchInterval: 3_000,
      staleTime: 0,
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
