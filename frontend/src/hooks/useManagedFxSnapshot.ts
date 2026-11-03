import { useQuery } from '@tanstack/react-query';
import { ShippingApi } from '../api/shipping';
import { getClientFxSnapshot, setManagedFxSnapshot, type FxRateSnapshot } from '../lib/shipping-compare';

/**
 * Loads the USD/SYP rate managed on Shipping Companies so price comparison uses the same rate
 * as COD conversion. Until it is usable, comparison keeps the env/fallback snapshot.
 */
export function useManagedFxSnapshot(): FxRateSnapshot {
  const query = useQuery({
    queryKey: ['shipping', 'fx'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const view = await ShippingApi.getFx();
      if (view.usable && view.activeRate != null) {
        setManagedFxSnapshot({
          usdToSypRate: view.activeRate,
          source: view.activeSource ?? 'managed',
          timestamp: view.lastSuccessfulAt ?? new Date().toISOString(),
        });
      } else {
        setManagedFxSnapshot(null);
      }
      return view;
    },
  });
  // Re-read after each fetch so callers recompute with the managed rate.
  void query.dataUpdatedAt;
  return getClientFxSnapshot();
}
