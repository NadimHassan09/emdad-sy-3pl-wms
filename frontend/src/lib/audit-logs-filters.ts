import type { ListAuditLogsParams } from '../api/audit-logs';

export type AuditLogFilters = {
  search: string;
  companyId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  dateFrom: string;
  dateTo: string;
};

/** Canonical list/export query from applied audit-log filters. Paging differs for export. */
export function auditLogsFiltersToParams(
  filters: AuditLogFilters,
  limit: number,
  offset: number,
): ListAuditLogsParams {
  return {
    limit,
    offset,
    search: filters.search.trim() || undefined,
    company_id: filters.companyId.trim() || undefined,
    actor_email: filters.actorEmail.trim() || undefined,
    actor_role: filters.actorRole.trim() || undefined,
    action: filters.action.trim() || undefined,
    resource_type: filters.resourceType.trim() || undefined,
    date_from: filters.dateFrom.trim() || undefined,
    date_to: filters.dateTo.trim() || undefined,
    sort_by: 'created_at',
    sort_dir: 'desc',
  };
}
