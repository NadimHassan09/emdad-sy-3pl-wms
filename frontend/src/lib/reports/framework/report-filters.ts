import { defaultReportDateRange } from '../format';
import { getReportById } from '../registry';
import { EMPTY_REPORT_FILTERS, type ReportFilterValues } from '../types';
import type { ReportApiParams } from './types';

export function buildInitialReportFilters(reportId: string): ReportFilterValues {
  const { dateFrom, dateTo } = defaultReportDateRange();
  const base = { ...EMPTY_REPORT_FILTERS, dateFrom, dateTo };
  const def = getReportById(reportId);
  if (!def?.filterKeys.includes('dateRange')) {
    return { ...base, dateFrom: '', dateTo: '' };
  }
  const groupBy = def.groupByOptions?.[0]?.value ?? '';
  return { ...base, groupBy };
}

export function filtersToApiParams(
  filters: ReportFilterValues,
  warehouseId: string,
  page: number,
  pageSize: number,
): ReportApiParams & { limit: number; offset: number } {
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

export function filtersToExportParams(
  filters: ReportFilterValues,
  warehouseId: string,
): ReportApiParams {
  return {
    warehouseId,
    companyId: filters.companyId.trim() || undefined,
    status: filters.status.trim() || undefined,
    sku: filters.sku.trim() || undefined,
    dateFrom: filters.dateFrom.trim() || undefined,
    dateTo: filters.dateTo.trim() || undefined,
  };
}

export function filtersCacheKey(filters: ReportFilterValues, warehouseId: string) {
  return {
    warehouseId,
    companyId: filters.companyId,
    status: filters.status,
    sku: filters.sku,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    groupBy: filters.groupBy,
  };
}

export function validateReportGeneration(warehouseId: string | null | undefined): string | null {
  if (!warehouseId?.trim()) {
    return 'Select a warehouse or configure a default warehouse.';
  }
  return null;
}
