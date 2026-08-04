import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import type { PageResult } from '../api/client';
import { useCachedState } from '../../../shared/design-system-next/hooks/useCachedState';

export const TASK_LIST_DEFAULT_PAGE_SIZE = 25;
export const TASK_LIST_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type ServerPagination = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions: number[];
};

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
  const { pathname } = useLocation();
  const [page, setPage] = useCachedState(`serverPage:${pathname}`, 1);
  const [pageSize, setPageSize] = useCachedState(
    `serverPageSize:${pathname}`,
    defaultPageSize,
  );

  const filterJson = JSON.stringify(filterKey);
  const prevFilterJson = useRef(filterJson);
  useEffect(() => {
    if (prevFilterJson.current === filterJson) return;
    prevFilterJson.current = filterJson;
    setPage(1);
  }, [filterJson, setPage]);

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
    [totalPages, setPage],
  );

  const onPageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    [setPage, setPageSize],
  );

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
