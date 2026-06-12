import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ReportsApi, type ReportKpiDto, type ReportRowDto } from '../api/reports';
import {
  filtersCacheKey,
  filtersToApiParams,
  REPORT_CACHE,
  reportPreviewQueryKey,
} from '../lib/reports/framework';
import type { ReportFilterValues, ReportViewMode } from '../lib/reports/types';

export type ReportQueryParams = {
  warehouseId: string;
  companyId?: string;
  status?: string;
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: string;
};

export function useReportServerData(options: {
  reportId: string;
  filters: ReportFilterValues;
  warehouseId: string;
  enabled: boolean;
  viewMode: ReportViewMode;
  page: number;
  pageSize: number;
  loadsKpis?: boolean;
}) {
  const { reportId, filters, warehouseId, enabled, viewMode, page, pageSize, loadsKpis } = options;

  const apiParams = useMemo(
    () => filtersToApiParams(filters, warehouseId, page, pageSize),
    [filters, warehouseId, page, pageSize],
  );

  const filterKey = useMemo(() => filtersCacheKey(filters, warehouseId), [filters, warehouseId]);

  const tableQuery = useQuery({
    queryKey: reportPreviewQueryKey(reportId, filterKey, { page, pageSize, mode: 'table' }),
    queryFn: () => ReportsApi.run(reportId, apiParams),
    enabled: enabled && viewMode === 'table',
    placeholderData: keepPreviousData,
    staleTime: REPORT_CACHE.previewStaleMs,
  });

  const aggregateQuery = useQuery({
    queryKey: reportPreviewQueryKey(reportId, filterKey, { mode: 'aggregate' }),
    queryFn: () =>
      ReportsApi.aggregate(reportId, {
        warehouseId,
        companyId: apiParams.companyId,
        status: apiParams.status,
        sku: apiParams.sku,
        dateFrom: apiParams.dateFrom,
        dateTo: apiParams.dateTo,
        groupBy: apiParams.groupBy || 'client',
      }),
    enabled: enabled && (viewMode === 'graph' || viewMode === 'pivot') && !!apiParams.groupBy,
    staleTime: REPORT_CACHE.previewStaleMs,
  });

  const graphTableQuery = useQuery({
    queryKey: reportPreviewQueryKey(reportId, filterKey, { mode: 'graph-full' }),
    queryFn: () =>
      ReportsApi.run(reportId, {
        ...apiParams,
        limit: 200,
        offset: 0,
      }),
    enabled:
      enabled &&
      (viewMode === 'graph' || viewMode === 'pivot') &&
      !apiParams.groupBy &&
      reportId === 'warehouse-analysis',
    staleTime: REPORT_CACHE.previewStaleMs,
  });

  const kpiQuery = useQuery({
    queryKey: reportPreviewQueryKey(reportId, filterKey, { mode: 'kpis' }),
    queryFn: () =>
      ReportsApi.kpis(reportId, {
        warehouseId,
        companyId: apiParams.companyId,
        dateFrom: apiParams.dateFrom,
        dateTo: apiParams.dateTo,
      }),
    enabled: enabled && !!loadsKpis,
    staleTime: REPORT_CACHE.kpiStaleMs,
  });

  const activeQuery =
    viewMode === 'table'
      ? tableQuery
      : apiParams.groupBy
        ? aggregateQuery
        : graphTableQuery;

  const rows: ReportRowDto[] = useMemo(() => {
    const items = activeQuery.data?.items ?? [];
    if ((viewMode === 'graph' || viewMode === 'pivot') && apiParams.groupBy && items.length > 0) {
      return items.map((row) => ({
        ...row,
        group: row.group ?? row.id,
      }));
    }
    return items;
  }, [activeQuery.data?.items, viewMode, apiParams.groupBy]);

  return {
    rows,
    total: activeQuery.data?.total ?? 0,
    truncated: activeQuery.data?.truncated ?? false,
    cached: activeQuery.data?.cached ?? false,
    isLoading: activeQuery.isLoading || activeQuery.isFetching,
    error: activeQuery.error instanceof Error ? activeQuery.error.message : null,
    kpis: (kpiQuery.data ?? []) as ReportKpiDto[],
    kpisLoading: kpiQuery.isLoading,
  };
}
