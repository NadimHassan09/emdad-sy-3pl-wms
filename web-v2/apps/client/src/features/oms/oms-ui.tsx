import { StatusBadge } from '@emdad/ui'
import {
  clientOmsCommercialStatusLabel,
} from '@/lib/client-oms-commercial-status'
import { clientOmsStatusTone } from '@/lib/oms-tone'

/** Status badge with optional Incomplete chip (client OMS lists / detail). */
export function OmsStatusBadge({
  status,
  isArabic,
  needsInformation,
}: {
  status: string
  isArabic: boolean
  needsInformation?: boolean
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {needsInformation ? (
        <StatusBadge tone="warning">{isArabic ? 'طلب غير مكتمل' : 'Incomplete order'}</StatusBadge>
      ) : null}
      <StatusBadge tone={clientOmsStatusTone(status)}>
        {clientOmsCommercialStatusLabel(status, isArabic)}
      </StatusBadge>
    </span>
  )
}

export function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</h2>
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value ?? '—'}</div>
    </div>
  )
}

export function fmtMoney(value: string | null | undefined, currency?: string | null): string {
  if (!value) return '—'
  return `${value}${currency ? ` ${currency}` : ''}`
}
