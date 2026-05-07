import { useCallback, useMemo, useState } from 'react';

/**
 * Draft vs applied filter state: list queries should only read `appliedFilters`.
 * Call `applyFilters` after the user clicks Apply; `resetFilters` restores `initialFilters` and applies.
 */
export function useFilters<T extends Record<string, unknown>>(initialFilters: T) {
  const initial = useMemo(() => ({ ...initialFilters }), [initialFilters]);

  const [draftFilters, setDraftFilters] = useState<T>(() => ({ ...initial }));
  const [appliedFilters, setAppliedFilters] = useState<T>(() => ({ ...initial }));

  const setDraft = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    setDraftFilters((prev) =>
      typeof patch === 'function' ? (patch as (p: T) => T)(prev) : { ...prev, ...patch },
    );
  }, []);

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    const z = { ...initial };
    setDraftFilters(z);
    setAppliedFilters(z);
  }, [initial]);

  /** Merge into draft and applied in one update (e.g. barcode scan → search). */
  const applyPatch = useCallback((patch: Partial<T>) => {
    setDraftFilters((prev) => {
      const next = { ...prev, ...patch } as T;
      setAppliedFilters(next);
      return next;
    });
  }, []);

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
