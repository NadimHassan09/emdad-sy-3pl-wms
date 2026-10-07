import { toneClasses, type Tone } from '@emdad/ui'
import type { BackupHealthSeverity } from '@/api/backups'

export function backupHealthTone(status: BackupHealthSeverity): Tone {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'warning':
      return 'warning'
    case 'critical':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function healthStatusDotClass(status: BackupHealthSeverity): string {
  return toneClasses[backupHealthTone(status)].dot
}

export function healthStatusSurfaceClass(status: BackupHealthSeverity): string {
  const t = toneClasses[backupHealthTone(status)]
  return `border-2 ${t.border} ${t.bg} ${t.text}`
}

export function formatRelativePast(iso: string | null, isArabic: boolean): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 60_000) return isArabic ? 'الآن' : 'just now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return isArabic ? `منذ ${days} ي` : `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return isArabic ? `منذ ${weeks} أ` : `${weeks}w ago`
  const months = Math.floor(days / 30)
  return isArabic ? `منذ ${months} ش` : `${months}mo ago`
}

export function formatRelativeFuture(iso: string | null, isArabic: boolean): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = d.getTime() - Date.now()
  if (diffMs <= 0) return isArabic ? 'الآن' : 'now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return isArabic ? `خلال ${mins} د` : `In ${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) {
    if (remMins === 0) return isArabic ? `خلال ${hours} س` : `In ${hours}h`
    return isArabic ? `خلال ${hours} س ${remMins} د` : `In ${hours}h ${remMins}m`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  if (remHours === 0) return isArabic ? `خلال ${days} ي` : `In ${days}d`
  return isArabic ? `خلال ${days} ي ${remHours} س` : `In ${days}d ${remHours}h`
}
