/** Client: pathname-scoped cached state for list filters. */
import { useLocation } from 'react-router';

import { useCachedState as useCachedStateBase } from './base/useCachedState';

export function useCachedState<T>(keySuffix: string, initial: T) {
  const { pathname } = useLocation();
  return useCachedStateBase<T>(`${pathname}::${keySuffix}`, initial);
}
