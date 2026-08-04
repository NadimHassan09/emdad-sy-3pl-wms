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

  const [draftFilters, setDraftFilters] = useCachedState<T>(`${cacheKey}:draft`, initial);
  const [appliedFilters, setAppliedFilters] = useCachedState<T>(
    `${cacheKey}:applied`,
    initial,
  );

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
    const z = { ...initial };
    setDraftFilters(z);
    setAppliedFilters(z);
  }, [initial, setDraftFilters, setAppliedFilters]);

  /** Merge into draft and applied in one update (e.g. barcode scan → search). */
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
