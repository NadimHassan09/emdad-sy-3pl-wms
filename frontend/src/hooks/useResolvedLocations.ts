import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { LocationsApi } from '../api/locations';
import { QK } from '../constants/query-keys';

export { EXECUTION_LOOKUP_LIMIT } from '../lib/location-resolve';

export function useResolvedLocations(locationIds: string[]) {
  const uniqueIds = useMemo(
    () => [...new Set(locationIds.map((id) => id.trim()).filter(Boolean))],
    [locationIds],
  );

  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: QK.locations.byId(id),
      queryFn: () => LocationsApi.getById(id),
      enabled: !!id,
      staleTime: 5 * 60_000,
    })),
  });

  const locationById = useMemo(() => {
    const m = new Map<string, import('../api/locations').Location>();
    uniqueIds.forEach((id, i) => {
      const loc = queries[i]?.data;
      if (loc) m.set(id, loc);
    });
    return m;
  }, [uniqueIds, queries]);

  return { locationById, resolving: queries.some((q) => q.isFetching) };
}
