import type { Location, LocationType } from '../api/locations';
import { LocationsApi } from '../api/locations';
import { matchLocationByScan } from '../pages/tasks/putaway/putaway-utils';

/** Max rows per execution UI location search (LOC-3A / LOC-3B). */
export const EXECUTION_LOOKUP_LIMIT = 25;

export type ResolveLocationOptions = {
  /** Restrict matches to these location types (client-side filter on lookup page). */
  types?: LocationType[];
};

/**
 * Resolve a barcode or path scan via server lookup (≤25 rows), then exact client match.
 */
export async function resolveLocationByScan(
  warehouseId: string,
  code: string,
  opts?: ResolveLocationOptions,
): Promise<Location | undefined> {
  const trimmed = code.trim();
  if (!trimmed || !warehouseId) return undefined;

  const page = await LocationsApi.lookup({
    warehouseId,
    search: trimmed,
    limit: EXECUTION_LOOKUP_LIMIT,
    offset: 0,
  });

  const allowed = opts?.types?.length ? new Set(opts.types) : null;
  const candidates = allowed
    ? page.items.filter((l) => allowed.has(l.type as LocationType))
    : page.items;

  return matchLocationByScan(trimmed, candidates) ?? candidates[0];
}

export function locationFromMap(
  locationById: Map<string, Location>,
  id: string | null | undefined,
): Location | undefined {
  if (!id?.trim()) return undefined;
  return locationById.get(id);
}
