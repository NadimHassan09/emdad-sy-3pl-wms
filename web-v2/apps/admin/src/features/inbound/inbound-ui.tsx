import { StatusBadge, type Tone } from '@emdad/ui'
import type { InboundOrderStatus } from '@/api/inbound'

export const INBOUND_STATUS_TONE: Record<InboundOrderStatus, Tone> = {
  draft: 'neutral',
  pending_approval: 'warning',
  confirmed: 'progress',
  in_progress: 'progress',
  partially_received: 'ready',
  completed: 'success',
  cancelled: 'neutral',
}

const LABEL_EN: Record<InboundOrderStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  partially_received: 'Partially received',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const LABEL_AR: Record<InboundOrderStatus, string> = {
  draft: 'مسودة',
  pending_approval: 'بانتظار الموافقة',
  confirmed: 'مؤكد',
  in_progress: 'قيد التنفيذ',
  partially_received: 'مستلم جزئياً',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

export function inboundStatusLabel(status: InboundOrderStatus, isArabic: boolean): string {
  return isArabic ? LABEL_AR[status] : LABEL_EN[status]
}

export function inboundStatusTone(status: string): Tone {
  return INBOUND_STATUS_TONE[status as InboundOrderStatus] ?? 'neutral'
}

function longestStatusLabel(isArabic: boolean): string {
  const labels = Object.values(isArabic ? LABEL_AR : LABEL_EN)
  return labels.reduce((best, cur) => (cur.length > best.length ? cur : best))
}

/**
 * Uniform badge width = longest inbound status label (+ built-in StatusBadge padding),
 * so short labels like "Completed" don't stretch to the full table column.
 */
export function InboundStatusBadge({ status, isArabic }: { status: InboundOrderStatus | string; isArabic: boolean }) {
  const key = status as InboundOrderStatus
  const longest = longestStatusLabel(isArabic)
  return (
    <span className="inline-grid max-w-full justify-items-stretch">
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5"
      >
        <span className="size-1.5 shrink-0" />
        {longest}
      </span>
      <StatusBadge tone={inboundStatusTone(status)} className="col-start-1 row-start-1 w-full justify-center">
        {inboundStatusLabel(key, isArabic)}
      </StatusBadge>
    </span>
  )
}
