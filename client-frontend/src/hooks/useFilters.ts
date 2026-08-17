import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { readListUiCache } from '../../../shared/design-system-next/hooks/listUiCache';
import { useCachedState } from './useCachedState';

/**
 * Thin draft/applied wrapper over pathname-scoped `useCachedState`.
 * Seeds from legacy per-field keys (`${pathname}::search`, etc.) so refresh/nav
 * persistence is not lost when migrating live filters onto Apply/Reset.
 */
export function useFilters<T extends object>(initialFilters: T) {
  const { pathname } = useLocation();
  const initial = useMemo(() => {
    const seeded = { ...initialFilters } as T;
    for (const key of Object.keys(initialFilters) as Array<keyof T & string>) {
      const legacy = readListUiCache<unknown>(`${pathname}::${key}`);
      if (legacy !== undefined) {
        (seeded as Record<string, unknown>)[key] = legacy;
      }
    }
    return seeded;
  }, [pathname, initialFilters]);

  const [draftFilters, setDraftFilters] = useCachedState<T>('filters:draft', initial);
  const [appliedFilters, setAppliedFilters] = useCachedState<T>('filters:applied', initial);

  const setDraft = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      setDraftFilters((prev) =>
        typeof patch === 'function' ? (patch as (p: T) => T)(prev) : { ...prev, ...patch },
      );
    },
    [setDraftFilters],
  );

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
  }, [draftFilters, setAppliedFilters]);

  const resetFilters = useCallback(() => {
    const z = { ...initialFilters };
    setDraftFilters(z);
    setAppliedFilters(z);
  }, [initialFilters, setDraftFilters, setAppliedFilters]);

  const applyPatch = useCallback(
    (patch: Partial<T>) => {
      setDraftFilters((prev) => {
        const next = { ...prev, ...patch } as T;
        setAppliedFilters(next);
        return next;
      });
    },
    [setDraftFilters, setAppliedFilters],
  );

  return {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    setDraft,
    applyFilters,
    applyPatch,
    resetFilters,
  };
}
