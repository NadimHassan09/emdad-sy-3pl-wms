/** Client: pathname-scoped cached state for list filters. */
import { useLocation } from 'react-router-dom';

import { useCachedState as useCachedStateBase } from '../../../shared/design-system-next/hooks/useCachedState';

export function useCachedState<T>(keySuffix: string, initial: T) {
  const { pathname } = useLocation();
  return useCachedStateBase<T>(`${pathname}::${keySuffix}`, initial);
}
