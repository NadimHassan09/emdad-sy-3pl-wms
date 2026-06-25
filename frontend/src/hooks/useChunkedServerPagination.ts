import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PageResult } from '../api/client';

/** Backend fetch size per chunk (API limit). */
export const CHUNK_SIZE_STANDARD = 200;
export const CHUNK_SIZE_TASKS = 500;

/** UI rows per page — must divide evenly into standard chunk size. */
export const UI_PAGE_SIZE = 50;

export type ChunkedFetchFn<T> = (
  offset: number,
  limit: number,
) => Promise<PageResult<T>>;

export type UseChunkedServerPaginationOptions<T> = {
  /** Records per API request (200 or 500). */
  chunkSize: number;
  /** Stable filter object for query keys and eviction scope. */
  filterKey: Record<string, unknown>;
  fetchChunk: ChunkedFetchFn<T>;
  /**
   * Query key prefix for chunk 0 — must match realtime `setQueriesData` prefix
   * (e.g. `QK.products`, `QK.inboundOrders`).
   */
  rtQueryKeyPrefix: readonly unknown[];
  /** Prefix for chunks offset > 0 (must NOT match RT prefix). */
  chunkQueryKeyPrefix: string;
  enabled?: boolean;
  pageSize?: number;
};

function chunkQueryKey(
  rtQueryKeyPrefix: readonly unknown[],
  chunkQueryKeyPrefix: string,
  filterKey: Record<string, unknown>,
  chunkOffset: number,
  chunkSize: number,
): QueryKey {
  if (chunkOffset === 0) {
    return [...rtQueryKeyPrefix, 'list', filterKey, { offset: 0, limit: chunkSize }];
  }
  return [chunkQueryKeyPrefix, filterKey, { offset: chunkOffset, limit: chunkSize }];
}

function pagesPerChunk(chunkSize: number, pageSize: number): number {
  return chunkSize / pageSize;
}

export function useChunkedServerPagination<T>({
  chunkSize,
  filterKey,
  fetchChunk,
  rtQueryKeyPrefix,
  chunkQueryKeyPrefix,
  enabled = true,
  pageSize = UI_PAGE_SIZE,
}: UseChunkedServerPaginationOptions<T>) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const pagesInChunk = pagesPerChunk(chunkSize, pageSize);

  useEffect(() => {
    setPage(1);
  }, [JSON.stringify(filterKey)]);

  const chunkIndex = Math.floor(((page - 1) * pageSize) / chunkSize);
  const chunkOffset = chunkIndex * chunkSize;
  const localStart = (page - 1) * pageSize - chunkOffset;

  const currentKey = useMemo(
    () => chunkQueryKey(rtQueryKeyPrefix, chunkQueryKeyPrefix, filterKey, chunkOffset, chunkSize),
    [rtQueryKeyPrefix, chunkQueryKeyPrefix, filterKey, chunkOffset, chunkSize],
  );

  const currentQuery = useQuery({
    queryKey: currentKey,
    queryFn: () => fetchChunk(chunkOffset, chunkSize),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const total = currentQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const maxChunkIndex = Math.max(0, Math.ceil(total / chunkSize) - 1);

  const pageInChunk = ((page - 1) % pagesInChunk) + 1;
  const shouldPrefetchNext =
    enabled &&
    chunkIndex < maxChunkIndex &&
    pageInChunk >= pagesInChunk - 1;
  const shouldPrefetchPrev = enabled && chunkIndex > 0 && pageInChunk <= 2;

  const prefetchChunk = useCallback(
    (targetChunkIndex: number) => {
      if (targetChunkIndex < 0 || targetChunkIndex > maxChunkIndex) return;
      const offset = targetChunkIndex * chunkSize;
      const key = chunkQueryKey(
        rtQueryKeyPrefix,
        chunkQueryKeyPrefix,
        filterKey,
        offset,
        chunkSize,
      );
      void qc.prefetchQuery({
        queryKey: key,
        queryFn: () => fetchChunk(offset, chunkSize),
        staleTime: 30_000,
      });
    },
    [
      qc,
      rtQueryKeyPrefix,
      chunkQueryKeyPrefix,
      filterKey,
      chunkSize,
      fetchChunk,
      maxChunkIndex,
    ],
  );

  useEffect(() => {
    if (shouldPrefetchNext) prefetchChunk(chunkIndex + 1);
  }, [shouldPrefetchNext, chunkIndex, prefetchChunk]);

  useEffect(() => {
    if (shouldPrefetchPrev) prefetchChunk(chunkIndex - 1);
  }, [shouldPrefetchPrev, chunkIndex, prefetchChunk]);

  useEffect(() => {
    if (!enabled) return;
    const keepOffsets = new Set(
      [
        (chunkIndex - 1) * chunkSize,
        chunkIndex * chunkSize,
        (chunkIndex + 1) * chunkSize,
      ].filter((o) => o >= 0),
    );
    const filterJson = JSON.stringify(filterKey);

    for (const q of qc.getQueryCache().findAll({ queryKey: [chunkQueryKeyPrefix], exact: false })) {
      const key = q.queryKey;
      if (key.length < 3 || JSON.stringify(key[1]) !== filterJson) continue;
      const off = (key[2] as { offset?: number })?.offset;
      if (typeof off === 'number' && !keepOffsets.has(off)) {
        qc.removeQueries({ queryKey: key });
      }
    }

    for (const q of qc.getQueryCache().findAll({ queryKey: [...rtQueryKeyPrefix, 'list'], exact: false })) {
      const key = q.queryKey;
      if (key.length < 4 || JSON.stringify(key[key.length - 2]) !== filterJson) continue;
      const off = (key[key.length - 1] as { offset?: number })?.offset ?? 0;
      if (!keepOffsets.has(off)) {
        qc.removeQueries({ queryKey: key });
      }
    }
  }, [chunkIndex, chunkSize, chunkQueryKeyPrefix, enabled, filterKey, qc, rtQueryKeyPrefix]);

  const rows = useMemo(() => {
    const items = currentQuery.data?.items ?? [];
    return items.slice(localStart, localStart + pageSize);
  }, [currentQuery.data?.items, localStart, pageSize]);

  const onPageChange = useCallback(
    (next: number) => {
      setPage(Math.max(1, Math.min(totalPages, next)));
    },
    [totalPages],
  );

  const resetPage = useCallback(() => setPage(1), []);

  const isInitialLoading = currentQuery.isLoading && currentQuery.data === undefined;

  const serverPagination = useMemo(
    () => ({
      total,
      page,
      pageSize,
      onPageChange,
      onPageSizeChange: () => {},
      pageSizeOptions: [pageSize] as number[],
    }),
    [total, page, pageSize, onPageChange],
  );

  return {
    rows,
    total,
    page,
    pageSize,
    setPage,
    resetPage,
    serverPagination,
    isInitialLoading,
    isFetching: currentQuery.isFetching,
    isError: currentQuery.isError,
    error: currentQuery.error,
    refetch: currentQuery.refetch,
    chunkIndex,
    chunkOffset,
    pagesInChunk,
  };
}
