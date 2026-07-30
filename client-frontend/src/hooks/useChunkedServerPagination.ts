/** Client re-export — SoT lives in shared/design-system/hooks (no Admin @wms alias). */
export {
  useChunkedServerPagination,
  CHUNK_SIZE_STANDARD,
  CHUNK_SIZE_TASKS,
  UI_PAGE_SIZE,
} from '../../../shared/design-system/hooks/useChunkedServerPagination';
export type {
  ChunkedFetchFn,
  UseChunkedServerPaginationOptions,
  PageResult,
} from '../../../shared/design-system/hooks/useChunkedServerPagination';
