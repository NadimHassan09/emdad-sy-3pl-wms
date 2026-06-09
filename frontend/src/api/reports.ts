import { api } from './client';

export type ReportRunParams = {
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

export type ReportRowDto = Record<string, string | number | boolean | null | undefined> & {
  id?: string;
};

export type ReportRunResult = {
  items: ReportRowDto[];
  total: number;
  limit: number;
  offset: number;
  truncated: boolean;
  cached: boolean;
};

export type ReportKpiDto = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export type ReportPolicy = {
  previewMaxLimit: number;
  previewMaxOffset: number;
  exportMaxRows: number;
  cacheTtlSec: number;
  aggregateMaxRows: number;
  supportedFormats: readonly ('csv' | 'xls')[];
  reportIds: readonly string[];
};

function compactParams(params: ReportRunParams & { format?: string }): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

export const ReportsApi = {
  policy(): Promise<ReportPolicy> {
    return api.get<ReportPolicy>('/reports/policy').then((r) => r.data);
  },

  run(reportId: string, params: ReportRunParams = {}): Promise<ReportRunResult> {
    return api
      .get<ReportRunResult>(`/reports/${reportId}/run`, { params: compactParams(params) })
      .then((r) => r.data);
  },

  aggregate(reportId: string, params: ReportRunParams): Promise<ReportRunResult> {
    return api
      .get<ReportRunResult>(`/reports/${reportId}/aggregate`, { params: compactParams(params) })
      .then((r) => r.data);
  },

  kpis(reportId: string, params: ReportRunParams): Promise<ReportKpiDto[]> {
    return api
      .get<ReportKpiDto[]>(`/reports/${reportId}/kpis`, { params: compactParams(params) })
      .then((r) => r.data);
  },

  async exportDownload(reportId: string, params: ReportRunParams & { format?: 'csv' | 'xls' }): Promise<void> {
    const format = params.format ?? 'csv';
    const response = await api.get<Blob>(`/reports/${reportId}/export`, {
      params: compactParams({ ...params, format }),
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = match?.[1] ?? `${reportId}-${stamp}.${format === 'xls' ? 'xls' : 'csv'}`;
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
