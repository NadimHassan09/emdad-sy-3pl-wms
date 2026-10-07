import { StatusBadge, type Tone } from '@emdad/ui'
import type { CompanyStatus } from '@/api/companies'

const STATUS: Record<
  CompanyStatus,
  { tone: Tone; en: string; ar: string }
> = {
  active: { tone: 'success', en: 'Active', ar: 'نشط' },
  paused: { tone: 'warning', en: 'Paused', ar: 'موقوف' },
  offboarding: { tone: 'pending', en: 'Offboarding', ar: 'إنهاء' },
  closed: { tone: 'neutral', en: 'Closed', ar: 'مغلق' },
  restricted: { tone: 'warning', en: 'Restricted', ar: 'مقيّد' },
  suspended: { tone: 'danger', en: 'Suspended', ar: 'معلّق' },
  archived: { tone: 'neutral', en: 'Archived', ar: 'مؤرشف' },
  purged: { tone: 'neutral', en: 'Purged', ar: 'محذوف' },
}

export function CompanyStatusBadge({ status, isArabic }: { status: CompanyStatus; isArabic: boolean }) {
  const row = STATUS[status] ?? { tone: 'neutral' as Tone, en: status, ar: status }
  return <StatusBadge tone={row.tone}>{isArabic ? row.ar : row.en}</StatusBadge>
}
