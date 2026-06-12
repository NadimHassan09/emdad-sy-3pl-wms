import type { InternalRole } from '../../rbac';

const REPORT_VIEW_ROLES: InternalRole[] = ['super_admin', 'wh_manager', 'finance'];

/** Aligns with backend `report-registry.config` allowedRoles. */
export function canViewReports(role: string | undefined): boolean {
  if (!role) return false;
  return REPORT_VIEW_ROLES.includes(role as InternalRole);
}

export function canViewReport(role: string | undefined, _reportId: string): boolean {
  return canViewReports(role);
}
