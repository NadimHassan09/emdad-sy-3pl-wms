import { StatusBadge, type Tone } from '@emdad/ui'
import {
  clientOutboundStatusLabel,
  mapClientOutboundDisplayStatus,
  type ClientOutboundDisplayStatus,
} from '@/lib/client-outbound-status'

const DISPLAY_TONE: Record<ClientOutboundDisplayStatus, Tone> = {
  pending_approval: 'warning',
  in_progress: 'progress',
  shipped: 'success',
  cancelled: 'neutral',
}

/** Client-facing outbound status badge (4 buckets). */
export function OutboundStatusBadge({
  status,
  isArabic,
}: {
  status: string
  isArabic: boolean
}) {
  const mapped = mapClientOutboundDisplayStatus(status)
  return (
    <StatusBadge tone={DISPLAY_TONE[mapped]}>
      {clientOutboundStatusLabel(status, isArabic)}
    </StatusBadge>
  )
}

export function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">{title}</h2>
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value ?? '—'}</div>
    </div>
  )
}

export function fmtQty(s: string): string {
  const n = Number(s)
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return s
}
