/**
 * Admin wrapper — injects pathname persist key so page survives list↔detail navigation.
 * SoT: shared/design-system-next/hooks/useChunkedServerPagination.ts
 */
import { useLocation } from 'react-router-dom';

import {
  useChunkedServerPagination as useChunkedServerPaginationBase,
  type UseChunkedServerPaginationOptions,
} from '../../../shared/design-system-next/hooks/useChunkedServerPagination';

export {
  CHUNK_SIZE_STANDARD,
  CHUNK_SIZE_TASKS,
  UI_PAGE_SIZE,
} from '../../../shared/design-system-next/hooks/useChunkedServerPagination';
export type {
  ChunkedFetchFn,
  UseChunkedServerPaginationOptions,
  PageResult,
} from '../../../shared/design-system-next/hooks/useChunkedServerPagination';

export function useChunkedServerPagination<T>(
  options: UseChunkedServerPaginationOptions<T>,
) {
  const { pathname } = useLocation();
  return useChunkedServerPaginationBase({
    ...options,
    persistKey: options.persistKey ?? `chunkPage:${pathname}`,
  });
}
