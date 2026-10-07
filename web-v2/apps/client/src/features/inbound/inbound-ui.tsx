import type { ReactNode } from 'react'
import { StatusBadge, type Tone } from '@emdad/ui'
import {
  clientInboundStatusLabel,
  mapClientInboundDisplayStatus,
  type ClientInboundDisplayStatus,
} from '@/lib/client-inbound-status'

const DISPLAY_TONE: Record<ClientInboundDisplayStatus, Tone> = {
  pending_approval: 'warning',
  in_progress: 'progress',
  completed: 'success',
  cancelled: 'neutral',
}

export function inboundDisplayTone(status: string): Tone {
  return DISPLAY_TONE[mapClientInboundDisplayStatus(status)]
}

export function InboundStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return (
    <StatusBadge tone={inboundDisplayTone(status)}>
      {clientInboundStatusLabel(status, isArabic)}
    </StatusBadge>
  )
}

export function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</h2>
}

export function DetailRow({
  label,
  value,
  className,
  preWrap,
}: {
  label: string
  value?: ReactNode
  className?: string
  preWrap?: boolean
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm text-foreground ${preWrap ? 'whitespace-pre-wrap' : ''}`}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

export function fmtQty(s: string): string {
  const n = Number(s)
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return s
}

export function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value)
}

export function sanitizePositiveIntegerInput(raw: string): string | null {
  if (raw === '') return ''
  if (!/^[1-9]\d*$/.test(raw)) return null
  return raw
}
