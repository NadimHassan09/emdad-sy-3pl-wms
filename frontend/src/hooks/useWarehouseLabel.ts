import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { WarehousesApi } from '../api/warehouses';
import { QK } from '../constants/query-keys';

/**
 * Resolve a warehouse UUID to its human-readable code (e.g. "WH-001").
 * Falls back to the warehouse name, then a short UUID preview, then "—".
 * Shares the cached warehouse list query used across the app.
 */
export function useWarehouseLabel() {
  const q = useQuery({
    queryKey: [...QK.warehouses, false] as const,
    queryFn: () => WarehousesApi.list(false),
    staleTime: 30 * 60_000,
  });

  const list = Array.isArray(q.data) ? q.data : [];

  const warehouseLabel = useCallback(
    (warehouseId?: string | null): string => {
      const id = warehouseId?.trim();
      if (!id) return '—';
      const wh = list.find((w) => w.id === id);
      if (wh?.code) return wh.code;
      if (wh?.name) return wh.name;
      return `${id.slice(0, 8)}…`;
    },
    [list],
  );

  return { warehouseLabel, isLoading: q.isLoading, warehouses: list };
}
