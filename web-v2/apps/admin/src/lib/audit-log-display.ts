import type { Tone } from '@emdad/ui'

export function auditLogSummaryText(action: string, resourceType: string): string {
  const a = action.replace(/_/g, ' ').toLowerCase()
  return `${a} · ${resourceType.replace(/_/g, ' ')}`
}

export function auditActionTone(action: string): Tone {
  const u = action.toUpperCase()
  if (u.includes('FAIL') || u.includes('ERROR') || u.includes('DENIED')) return 'danger'
  if (u.includes('CANCEL') || u.includes('SUSPEND') || u.includes('DELETE')) return 'warning'
  if (u.includes('SUCCESS') || u.includes('COMPLETE') || u.includes('LOGIN')) return 'success'
  return 'neutral'
}

export function formatAuditActionLabel(action: string): string {
  return action.replace(/_/g, ' ')
}

export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(d)
}

export function formatAuditRole(role: string, isArabic?: boolean): string {
  const mapEn: Record<string, string> = {
    super_admin: 'Super admin',
    wh_manager: 'Admin',
    wh_operator: 'Worker',
    finance: 'Finance',
    client_admin: 'Client admin',
    client_staff: 'Client staff',
  }
  const mapAr: Record<string, string> = {
    super_admin: 'مدير عام',
    wh_manager: 'مدير',
    wh_operator: 'عامل',
    finance: 'مالية',
    client_admin: 'مدير عميل',
    client_staff: 'موظف عميل',
  }
  const map = isArabic ? mapAr : mapEn
  return map[role] ?? role.replace(/_/g, ' ')
}

export function formatAuditJson(value: unknown): string {
  if (value === null || value === undefined) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function truncateMiddle(value: string, head = 8, tail = 4): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

export function auditActionToneLabel(action: string, isArabic: boolean): string {
  const u = action.toUpperCase()
  if (u.includes('FAIL') || u.includes('ERROR')) return isArabic ? 'فشل' : 'Failed'
  if (u.includes('CANCEL') || u.includes('SUSPEND')) return isArabic ? 'تحذير' : 'Warn'
  if (u.includes('SUCCESS') || u.includes('COMPLETE') || u.includes('LOGIN')) {
    return isArabic ? 'نجاح' : 'OK'
  }
  return isArabic ? 'سجل' : 'Log'
}
