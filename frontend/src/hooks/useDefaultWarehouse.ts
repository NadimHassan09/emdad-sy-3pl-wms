import { useQuery } from '@tanstack/react-query';

import { WarehousesApi } from '../api/warehouses';
import { QK } from '../constants/query-keys';

const ENV_WID = (import.meta.env.VITE_DEFAULT_WAREHOUSE_ID as string | undefined)?.trim() || '';

/**
 * Single-warehouse UI: resolve the warehouse id from env or the first active warehouse.
 */
export function useDefaultWarehouseId() {
  const q = useQuery({
    queryKey: [...QK.warehouses, false] as const,
    queryFn: () => WarehousesApi.list(false),
    staleTime: 30 * 60_000,
  });

  const list = q.data ?? [];
  const fromEnv = ENV_WID && list.some((w) => w.id === ENV_WID) ? ENV_WID : '';
  const warehouseId = fromEnv || list.find((w) => w.status === 'active')?.id || list[0]?.id || '';

  return {
    warehouseId,
    isLoading: q.isLoading,
    warehouses: list,
    error: q.error,
  };
}
