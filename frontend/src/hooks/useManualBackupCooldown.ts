import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { BackupsApi } from '../api/backups';
import { QK } from '../constants/query-keys';

export function remainingFromNextAllowedAt(
  nextAllowedAt: string | null | undefined,
  fallbackSeconds = 0,
  nowMs = Date.now(),
): number {
  if (!nextAllowedAt) return Math.max(0, fallbackSeconds);
  const target = new Date(nextAllowedAt).getTime();
  if (Number.isNaN(target)) return Math.max(0, fallbackSeconds);
  return Math.max(0, Math.ceil((target - nowMs) / 1000));
}

export function useManualBackupCooldown(enabled: boolean) {
  const query = useQuery({
    queryKey: QK.backups.manualCooldown,
    queryFn: () => BackupsApi.getManualCooldown(),
    enabled,
    staleTime: 5_000,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 15_000;
      if (!data.canCreate || data.remainingSeconds > 0 || data.runningManualJobId) {
        return 2_500;
      }
      return 30_000;
    },
  });

  const [nowMs, setNowMs] = useState(() => Date.now());
  const ticking = Boolean(
    query.data &&
      (!query.data.canCreate || query.data.remainingSeconds > 0 || query.data.runningManualJobId),
  );

  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [ticking, query.data?.nextAllowedAt]);

  const remainingSeconds = remainingFromNextAllowedAt(
    query.data?.nextAllowedAt,
    query.data?.remainingSeconds ?? 0,
    nowMs,
  );
  const running = Boolean(query.data?.runningManualJobId);
  const canCreate = !enabled || (query.data?.canCreate !== false && remainingSeconds <= 0 && !running);

  return {
    query,
    remainingSeconds,
    running,
    canCreate,
    cooldownMinutes: query.data?.cooldownMinutes ?? 15,
    minMinutes: query.data?.minMinutes ?? 1,
    maxMinutes: query.data?.maxMinutes ?? 1440,
  };
}
