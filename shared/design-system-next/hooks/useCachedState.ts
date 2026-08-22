import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { readListUiCache, writeListUiCache } from './listUiCache';

/**
 * useState that restores from the list UI cache (memory + sessionStorage).
 * `cacheKey` should include the list pathname (and a field name).
 */
export function useCachedState<T>(
  cacheKey: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const cached = readListUiCache<T>(cacheKey);
    return cached !== undefined ? cached : initial;
  });

  useEffect(() => {
    writeListUiCache(cacheKey, state);
  }, [cacheKey, state]);

  const setCached = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      setState((prev) => {
        const next = typeof update === 'function' ? (update as (p: T) => T)(prev) : update;
        writeListUiCache(cacheKey, next);
        return next;
      });
    },
    [cacheKey],
  );

  return [state, setCached];
}
