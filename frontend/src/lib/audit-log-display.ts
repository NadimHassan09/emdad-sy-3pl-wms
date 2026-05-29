/** Human-readable one-line summary for table scan (no raw JSON). */
export function auditLogSummaryText(action: string, resourceType: string): string {
  const a = action.replace(/_/g, ' ').toLowerCase();
  return `${a} · ${resourceType.replace(/_/g, ' ')}`;
}

export type AuditActionTone = 'success' | 'warning' | 'danger' | 'neutral';

export function auditActionTone(action: string): AuditActionTone {
  const u = action.toUpperCase();
  if (u.includes('FAIL') || u.includes('ERROR') || u.includes('DENIED')) return 'danger';
  if (u.includes('CANCEL') || u.includes('SUSPEND') || u.includes('DELETE')) return 'warning';
  if (u.includes('SUCCESS') || u.includes('COMPLETE') || u.includes('LOGIN')) return 'success';
  return 'neutral';
}

const TONE_CLASS: Record<AuditActionTone, string> = {
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function auditActionBadgeClass(action: string): string {
  return TONE_CLASS[auditActionTone(action)];
}

export function formatAuditActionLabel(action: string): string {
  return action.replace(/_/g, ' ');
}

export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(d);
}

export function formatAuditRole(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super admin',
    wh_manager: 'Admin',
    wh_operator: 'Worker',
    finance: 'Finance',
    client_admin: 'Client admin',
    client_staff: 'Client staff',
  };
  return map[role] ?? role.replace(/_/g, ' ');
}

/** Safe JSON for `<pre>` — never use dangerouslySetInnerHTML. */
export function formatAuditJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function truncateMiddle(value: string, head = 8, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
