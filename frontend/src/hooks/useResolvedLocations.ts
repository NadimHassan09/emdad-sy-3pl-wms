import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { LocationsApi } from '../api/locations';
import { QK } from '../constants/query-keys';

export { EXECUTION_LOOKUP_LIMIT } from '../lib/location-resolve';

export function useResolvedLocations(locationIds: string[]) {
  // Callers frequently pass a fresh array literal each render (e.g. [...ids, x]).
  // Derive a stable string key so `uniqueIds` keeps the same identity unless the
  // actual set of ids changes — otherwise every render produces a new array and
  // a new `locationById` Map, which can trigger reset effects / render storms in
  // consumers that depend on its identity.
  const idsKey = [...new Set(locationIds.map((id) => id.trim()).filter(Boolean))]
    .sort()
    .join('\u001f');

  const uniqueIds = useMemo(() => (idsKey ? idsKey.split('\u001f') : []), [idsKey]);

  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: QK.locations.byId(id),
      queryFn: () => LocationsApi.getById(id),
      enabled: !!id,
      staleTime: 5 * 60_000,
    })),
  });

  // Fingerprint the resolved data so the Map identity is stable until the
  // underlying locations actually change (not on every render).
  const dataSig = queries
    .map((q) => {
      const d = q.data as import('../api/locations').Location | undefined;
      return d ? `${d.id}:${d.fullPath ?? ''}` : '';
    })
    .join('\u001f');

  const locationById = useMemo(() => {
    const m = new Map<string, import('../api/locations').Location>();
    uniqueIds.forEach((id, i) => {
      const loc = queries[i]?.data;
      if (loc) m.set(id, loc);
    });
    return m;
    // `queries` is intentionally excluded; `dataSig` captures meaningful changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueIds, dataSig]);

  return { locationById, resolving: queries.some((q) => q.isFetching) };
}
