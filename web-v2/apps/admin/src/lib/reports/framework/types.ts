import type { ReportFilterValues, ReportViewMode } from '../types';

export type ReportApiParams = {
  warehouseId?: string;
  companyId?: string;
  status?: string;
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: string;
  limit?: number;
  offset?: number;
};

export type ReportFrameworkState = {
  reportId: string;
  filters: ReportFilterValues;
  warehouseId: string;
  hasGenerated: boolean;
  viewMode: ReportViewMode;
  page: number;
  pageSize: number;
};

export type ReportCacheConfig = {
  previewStaleMs: number;
  kpiStaleMs: number;
  policyStaleMs: number;
};
