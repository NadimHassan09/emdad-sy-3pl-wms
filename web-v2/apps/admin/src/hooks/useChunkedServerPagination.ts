/**
 * Admin wrapper — injects pathname persist key so page survives list↔detail navigation.
 * Base implementation lives in ./base/useChunkedServerPagination.ts
 */
import { useLocation } from 'react-router';

import {
  useChunkedServerPagination as useChunkedServerPaginationBase,
  type UseChunkedServerPaginationOptions,
} from './base/useChunkedServerPagination';

export {
  CHUNK_SIZE_STANDARD,
  CHUNK_SIZE_TASKS,
  UI_PAGE_SIZE,
} from './base/useChunkedServerPagination';
export type {
  ChunkedFetchFn,
  UseChunkedServerPaginationOptions,
  PageResult,
} from './base/useChunkedServerPagination';

export function useChunkedServerPagination<T>(
  options: UseChunkedServerPaginationOptions<T>,
) {
  const { pathname } = useLocation();
  return useChunkedServerPaginationBase({
    ...options,
    persistKey: options.persistKey ?? `chunkPage:${pathname}`,
  });
}
