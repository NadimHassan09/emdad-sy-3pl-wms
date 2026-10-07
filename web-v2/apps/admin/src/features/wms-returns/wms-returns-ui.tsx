import { StatusBadge, type Tone } from '@emdad/ui'
import type { ReturnLineStatus, ReturnOrderStatus } from '@/api/returns'

const RETURN_STATUS: Record<ReturnOrderStatus, { en: string; ar: string; tone: Tone }> = {
  draft: { en: 'Draft', ar: 'مسودة', tone: 'neutral' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد', tone: 'progress' },
  receiving: { en: 'Receiving', ar: 'استلام', tone: 'progress' },
  inspecting: { en: 'Inspecting', ar: 'فحص', tone: 'warning' },
  completed: { en: 'Completed', ar: 'مكتمل', tone: 'success' },
  cancelled: { en: 'Cancelled', ar: 'ملغي', tone: 'neutral' },
}

const LINE_STATUS: Record<ReturnLineStatus, { en: string; ar: string; tone: Tone }> = {
  pending: { en: 'Pending', ar: 'معلق', tone: 'neutral' },
  received: { en: 'Received', ar: 'مستلم', tone: 'progress' },
  inspected: { en: 'Inspected', ar: 'مفحوص', tone: 'warning' },
  posted: { en: 'Posted', ar: 'مرحّل', tone: 'success' },
}

export function ReturnOrderStatusBadge({ status, isArabic }: { status: ReturnOrderStatus; isArabic: boolean }) {
  const row = RETURN_STATUS[status] ?? { en: status, ar: status, tone: 'neutral' as Tone }
  return <StatusBadge tone={row.tone}>{isArabic ? row.ar : row.en}</StatusBadge>
}

export function ReturnLineStatusBadge({ status, isArabic }: { status: ReturnLineStatus; isArabic: boolean }) {
  const row = LINE_STATUS[status] ?? { en: status, ar: status, tone: 'neutral' as Tone }
  return <StatusBadge tone={row.tone}>{isArabic ? row.ar : row.en}</StatusBadge>
}
