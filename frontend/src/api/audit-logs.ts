import { api, type PageResult } from './client';

export type AuditLogSummary = {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  companyId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string | null;
  createdAt: string;
};

export type AuditLogDetail = AuditLogSummary & {
  previousState: unknown;
  newState: unknown;
  userAgent: string | null;
};

export type AuditLogListResult = PageResult<AuditLogSummary> & {
  nextCursor: string | null;
  totalCapped?: boolean;
  retentionCutoffIso?: string | null;
};

export type AuditLogPolicy = {
  retentionDays: number;
  retentionCutoffIso: string;
  queryMaxLimit: number;
  queryMaxOffset: number;
  queryMaxDateRangeDays: number;
  queryDefaultWindowDays: number;
  queryCountCap: number;
  exportMaxRows: number;
  exportMaxDateRangeDays: number;
  exportEnabled: boolean;
};

export type ExportAuditLogsParams = ListAuditLogsParams & {
  format?: 'csv' | 'json';
};

export type ListAuditLogsParams = {
  limit?: number;
  offset?: number;
  cursor?: string;
  actor_id?: string;
  actor_email?: string;
  actor_role?: string;
  company_id?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: 'created_at' | 'action' | 'actor_email' | 'actor_role' | 'resource_type';
  sort_dir?: 'asc' | 'desc';
};

function compactParams(params: ListAuditLogsParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

export const AuditLogsApi = {
  policy(): Promise<AuditLogPolicy> {
    return api.get<AuditLogPolicy>('/audit-logs/policy').then((r) => r.data);
  },

  list(params: ListAuditLogsParams = {}): Promise<AuditLogListResult> {
    return api
      .get<AuditLogListResult>('/audit-logs', { params: compactParams(params) })
      .then((r) => r.data);
  },

  getById(id: string): Promise<AuditLogDetail> {
    return api.get<AuditLogDetail>(`/audit-logs/${id}`).then((r) => r.data);
  },

  /** Downloads capped CSV export (requires date_from + date_to). */
  async exportDownload(params: ExportAuditLogsParams): Promise<void> {
    const response = await api.get<Blob>('/audit-logs/export', {
      params: compactParams({ format: 'csv', ...params }),
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
