import { useQuery } from '@tanstack/react-query';

import type { LocationType } from '../api/locations';
import { LocationsApi } from '../api/locations';
import { EXECUTION_LOOKUP_LIMIT } from '../lib/location-resolve';

export function useTypedLocationLookup(
  warehouseId: string,
  type: LocationType,
  enabled = true,
) {
  return useQuery({
    queryKey: ['locations', 'lookup', 'typed', warehouseId, type] as const,
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        type,
        limit: EXECUTION_LOOKUP_LIMIT,
        offset: 0,
      }),
    enabled: !!warehouseId && enabled,
    staleTime: 5 * 60_000,
  });
}
