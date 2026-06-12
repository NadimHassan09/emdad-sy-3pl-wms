import { QK } from '../../../constants/query-keys';
import type { ReportApiParams } from './types';
import type { ReportCacheConfig } from './types';

export const REPORT_CACHE: ReportCacheConfig = {
  previewStaleMs: 30_000,
  kpiStaleMs: 60_000,
  policyStaleMs: 5 * 60_000,
};

export function reportPreviewQueryKey(
  reportId: string,
  filterKey: Record<string, unknown>,
  extras: Record<string, unknown> = {},
) {
  return QK.reports.preview(reportId, { ...filterKey, ...extras });
}

export function reportPolicyQueryKey() {
  return QK.reports.all;
}

export function aggregateQueryKey(reportId: string, params: ReportApiParams) {
  return reportPreviewQueryKey(reportId, params, { mode: 'aggregate' });
}

export function tableQueryKey(
  reportId: string,
  filterKey: Record<string, unknown>,
  page: number,
  pageSize: number,
) {
  return reportPreviewQueryKey(reportId, filterKey, { page, pageSize, mode: 'table' });
}

export function kpiQueryKey(reportId: string, filterKey: Record<string, unknown>) {
  return reportPreviewQueryKey(reportId, filterKey, { mode: 'kpis' });
}
