import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ReportsApi, type ReportKpiDto, type ReportRowDto } from '../api/reports';
import { QK } from '../constants/query-keys';
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

function toApiParams(
  filters: ReportFilterValues,
  warehouseId: string,
  page: number,
  pageSize: number,
): ReportQueryParams & { limit: number; offset: number } {
  return {
    warehouseId,
    companyId: filters.companyId.trim() || undefined,
    status: filters.status.trim() || undefined,
    sku: filters.sku.trim() || undefined,
    dateFrom: filters.dateFrom.trim() || undefined,
    dateTo: filters.dateTo.trim() || undefined,
    groupBy: filters.groupBy.trim() || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

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
    () => toApiParams(filters, warehouseId, page, pageSize),
    [filters, warehouseId, page, pageSize],
  );

  const filterKey = useMemo(
    () => ({
      warehouseId,
      companyId: filters.companyId,
      status: filters.status,
      sku: filters.sku,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      groupBy: filters.groupBy,
    }),
    [filters, warehouseId],
  );

  const tableQuery = useQuery({
    queryKey: QK.reports.preview(reportId, { ...filterKey, page, pageSize, mode: 'table' }),
    queryFn: () => ReportsApi.run(reportId, apiParams),
    enabled: enabled && viewMode === 'table',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const aggregateQuery = useQuery({
    queryKey: QK.reports.preview(reportId, { ...filterKey, mode: 'aggregate' }),
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
    staleTime: 30_000,
  });

  const graphTableQuery = useQuery({
    queryKey: QK.reports.preview(reportId, { ...filterKey, mode: 'graph-full' }),
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
    staleTime: 30_000,
  });

  const kpiQuery = useQuery({
    queryKey: QK.reports.preview(reportId, { ...filterKey, mode: 'kpis' }),
    queryFn: () =>
      ReportsApi.kpis(reportId, {
        warehouseId,
        companyId: apiParams.companyId,
        dateFrom: apiParams.dateFrom,
        dateTo: apiParams.dateTo,
      }),
    enabled: enabled && !!loadsKpis,
    staleTime: 60_000,
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
