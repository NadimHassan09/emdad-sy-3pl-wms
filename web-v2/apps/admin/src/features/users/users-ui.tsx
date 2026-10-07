import { StatusBadge, type Tone } from '@emdad/ui'
import type { UserRole, UserStatus } from '@/api/users'

export function userRoleLabel(role: UserRole, isArabic: boolean): string {
  const map: Record<UserRole, [string, string]> = {
    super_admin: ['Super admin', 'مدير عام'],
    wh_manager: ['Admin', 'مدير'],
    wh_operator: ['Worker', 'عامل'],
    finance: ['Finance', 'مالية'],
    client_admin: ['Client admin', 'مدير عميل'],
    client_staff: ['Client staff', 'موظف عميل'],
  }
  const row = map[role]
  return row ? (isArabic ? row[1] : row[0]) : role
}

export function UserStatusBadge({ status, isArabic }: { status: UserStatus; isArabic: boolean }) {
  const tone: Tone = status === 'active' ? 'success' : 'neutral'
  const label = status === 'active' ? (isArabic ? 'نشط' : 'Active') : isArabic ? 'غير نشط' : 'Inactive'
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

export function formatLastLogin(iso: string | null | undefined, locale?: string): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

const ONLINE_IDLE_MS = 5 * 60 * 1000

export function UserActivityBadge({
  userId,
  status,
  lastActivityAt,
  onlineUserIds,
  isArabic,
}: {
  userId: string
  status: UserStatus
  lastActivityAt: string | null
  onlineUserIds?: Set<string>
  isArabic: boolean
}) {
  const offline = isArabic ? 'غير متصل' : 'Offline'
  const online = isArabic ? 'متصل' : 'Online'
  if (status !== 'active') {
    return <StatusBadge tone="neutral">{offline}</StatusBadge>
  }
  if (onlineUserIds?.has(userId)) {
    return <StatusBadge tone="success">{online}</StatusBadge>
  }
  const t = lastActivityAt ? new Date(lastActivityAt).getTime() : NaN
  const isOnline = !Number.isNaN(t) && Date.now() - t < ONLINE_IDLE_MS
  return <StatusBadge tone={isOnline ? 'success' : 'neutral'}>{isOnline ? online : offline}</StatusBadge>
}
