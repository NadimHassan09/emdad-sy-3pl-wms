import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PageResult } from '../api/client';

export const TASK_LIST_DEFAULT_PAGE_SIZE = 25;
export const TASK_LIST_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type ServerPaginationFetchFn<T> = (
  offset: number,
  limit: number,
) => Promise<PageResult<T>>;

export type UseServerPaginationOptions<T> = {
  filterKey: Record<string, unknown>;
  queryKey: QueryKey;
  fetchPage: ServerPaginationFetchFn<T>;
  enabled?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
};

export function useServerPagination<T>({
  filterKey,
  queryKey,
  fetchPage,
  enabled = true,
  defaultPageSize = TASK_LIST_DEFAULT_PAGE_SIZE,
  pageSizeOptions = TASK_LIST_PAGE_SIZE_OPTIONS,
}: UseServerPaginationOptions<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [JSON.stringify(filterKey)]);

  const offset = (page - 1) * pageSize;

  const listQuery = useQuery({
    queryKey: [...queryKey, filterKey, { page, pageSize, offset }],
    queryFn: () => fetchPage(offset, pageSize),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onPageChange = useCallback(
    (next: number) => {
      setPage(Math.max(1, Math.min(totalPages, next)));
    },
    [totalPages],
  );

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const serverPagination = useMemo(
    () => ({
      total,
      page,
      pageSize,
      onPageChange,
      onPageSizeChange,
      pageSizeOptions: [...pageSizeOptions],
    }),
    [total, page, pageSize, onPageChange, onPageSizeChange, pageSizeOptions],
  );

  return {
    rows: listQuery.data?.items ?? [],
    total,
    page,
    pageSize,
    setPage,
    resetPage: () => setPage(1),
    serverPagination,
    isInitialLoading: listQuery.isLoading && listQuery.data === undefined,
    isFetching: listQuery.isFetching,
    isError: listQuery.isError,
    error: listQuery.error,
    refetch: listQuery.refetch,
  };
}
