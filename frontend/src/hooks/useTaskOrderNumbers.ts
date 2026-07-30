import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { WarehouseTaskListItem } from '../api/tasks';
import { resolveOrderNumberLabel } from '../lib/task-list-search';

/** Batch-resolve human order # for task list rows via existing order GET APIs. */
export function useTaskOrderNumbers(rows: WarehouseTaskListItem[]) {
  const keys = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ key: string; referenceType?: string; referenceId: string }> = [];
    for (const r of rows) {
      const referenceId = r.workflowInstance?.referenceId;
      if (!referenceId || seen.has(referenceId)) continue;
      seen.add(referenceId);
      out.push({
        key: referenceId,
        referenceType: r.workflowInstance?.referenceType,
        referenceId,
      });
    }
    return out;
  }, [rows]);

  const results = useQueries({
    queries: keys.map((k) => ({
      queryKey: ['task-order-number', k.referenceId] as const,
      queryFn: () => resolveOrderNumberLabel(k.referenceType, k.referenceId),
      staleTime: 5 * 60_000,
    })),
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    keys.forEach((k, i) => {
      const label = results[i]?.data;
      if (label) map.set(k.referenceId, label);
    });
    return map;
  }, [keys, results]);
}
