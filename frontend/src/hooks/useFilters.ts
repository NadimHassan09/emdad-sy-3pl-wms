import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useCachedState } from '../../../shared/design-system-next/hooks/useCachedState';

/**
 * Draft vs applied filter state: list queries should only read `appliedFilters`.
 * Applied + draft survive list → detail → back via list UI cache.
 */
export function useFilters<T extends object>(initialFilters: T) {
  const { pathname } = useLocation();
  const cacheKey = `filters:${pathname}`;
  const initial = useMemo(() => ({ ...initialFilters }), [initialFilters]);

  const [rawDraftFilters, setDraftFilters] = useCachedState<T>(`${cacheKey}:draft`, initial);
  const [rawAppliedFilters, setAppliedFilters] = useCachedState<T>(
    `${cacheKey}:applied`,
    initial,
  );

  const draftFilters = useMemo(
    () => ({ ...initial, ...(rawDraftFilters ?? {}) }),
    [initial, rawDraftFilters],
  );

  const appliedFilters = useMemo(
    () => ({ ...initial, ...(rawAppliedFilters ?? {}) }),
    [initial, rawAppliedFilters],
  );

  const setDraft = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      setDraftFilters((prev) => {
        const base = { ...initial, ...(prev ?? {}) };
        return typeof patch === 'function' ? (patch as (p: T) => T)(base) : { ...base, ...patch };
      });
    },
    [initial, setDraftFilters],
  );

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...initial, ...draftFilters });
  }, [initial, draftFilters, setAppliedFilters]);

  const resetFilters = useCallback(() => {
    const z = { ...initial };
    setDraftFilters(z);
    setAppliedFilters(z);
  }, [initial, setDraftFilters, setAppliedFilters]);

  /** Merge into draft and applied in one update (e.g. barcode scan → search). */
  const applyPatch = useCallback(
    (patch: Partial<T>) => {
      setDraftFilters((prev) => {
        const next = { ...initial, ...(prev ?? {}), ...patch } as T;
        setAppliedFilters(next);
        return next;
      });
    },
    [initial, setDraftFilters, setAppliedFilters],
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
