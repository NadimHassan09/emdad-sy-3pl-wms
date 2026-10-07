import { StatusBadge, type Tone } from '@emdad/ui'

const RETURN_STATUS: Record<string, { en: string; ar: string; tone: Tone }> = {
  draft: { en: 'Draft', ar: 'مسودة', tone: 'neutral' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد', tone: 'progress' },
  receiving: { en: 'Receiving', ar: 'استلام', tone: 'progress' },
  inspecting: { en: 'Inspecting', ar: 'فحص', tone: 'warning' },
  completed: { en: 'Completed', ar: 'مكتمل', tone: 'success' },
  cancelled: { en: 'Cancelled', ar: 'ملغي', tone: 'neutral' },
  pending: { en: 'Pending', ar: 'معلق', tone: 'neutral' },
  received: { en: 'Received', ar: 'مستلم', tone: 'progress' },
  inspected: { en: 'Inspected', ar: 'مفحوص', tone: 'warning' },
  posted: { en: 'Posted', ar: 'مرحّل', tone: 'success' },
}

export function returnStatusLabel(status: string, isArabic: boolean): string {
  const row = RETURN_STATUS[status]
  if (row) return isArabic ? row.ar : row.en
  return status.replace(/_/g, ' ')
}

export function returnStatusTone(status: string): Tone {
  return RETURN_STATUS[status]?.tone ?? 'neutral'
}

export function ReturnStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return (
    <StatusBadge tone={returnStatusTone(status)}>{returnStatusLabel(status, isArabic)}</StatusBadge>
  )
}

export function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">{title}</h2>
}
