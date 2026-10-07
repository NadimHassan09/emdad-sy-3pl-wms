import type { ReactNode } from 'react'
import { StatusBadge, type Tone, cn } from '@emdad/ui'
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
} from '@/lib/billing-display'

export const BILLING_CURRENCY = 'USD'
export const SALES_EMAIL = 'sales@emdadsy.com'

const INVOICE_TONE: Record<string, Tone> = {
  draft: 'neutral',
  unpaid: 'progress',
  open: 'progress',
  overdue: 'warning',
  paid: 'success',
  cancelled: 'returned',
}

const ACCOUNT_TONE: Record<string, Tone> = {
  active: 'success',
  expiring: 'warning',
  restricted: 'danger',
  no_plan: 'danger',
}

export { formatCycleLabel, formatDate, formatDecimal, humanizeInvoiceStatus }

export function invoiceStatusTone(status: string): Tone {
  return INVOICE_TONE[status] ?? 'neutral'
}

export function accountStatusTone(status: string): Tone {
  return ACCOUNT_TONE[status] ?? 'neutral'
}

export function invoiceStatusLabel(status: string, isArabic: boolean): string {
  if (isArabic) {
    const ar: Record<string, string> = {
      draft: 'مسودة',
      unpaid: 'قيد الانتظار',
      open: 'قيد الانتظار',
      overdue: 'متأخرة',
      paid: 'مدفوعة',
      cancelled: 'ملغاة',
    }
    if (ar[status]) return ar[status]
  }
  return humanizeInvoiceStatus(status)
}

export function accountStatusLabel(status: string, isArabic: boolean): string {
  if (status === 'restricted') return isArabic ? 'موقوف' : 'Suspended'
  if (status === 'expiring') return isArabic ? 'ينتهي قريبًا' : 'Expiring'
  if (status === 'no_plan') return isArabic ? 'بدون خطة' : 'No plan'
  return isArabic ? 'نشط' : 'Active'
}

export function InvoiceStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return (
    <StatusBadge tone={invoiceStatusTone(status)}>{invoiceStatusLabel(status, isArabic)}</StatusBadge>
  )
}

export function AccountStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return (
    <StatusBadge tone={accountStatusTone(status)}>{accountStatusLabel(status, isArabic)}</StatusBadge>
  )
}

export function cycleCadence(days: number | undefined, isArabic: boolean): string {
  if (days == null) return '—'
  if (days === 30 || days === 31) return isArabic ? 'شهري' : 'Monthly'
  if (days === 90) return isArabic ? 'ربع سنوي' : 'Quarterly'
  if (days === 365 || days === 366) return isArabic ? 'سنوي' : 'Yearly'
  return isArabic ? `${days} يوم` : `${days} days`
}

export function planDisplayName(days: number | undefined, isArabic: boolean): string {
  if (days === 30 || days === 31) return isArabic ? 'الخطة الشهرية' : 'Monthly Plan'
  if (days === 90) return isArabic ? 'الخطة الربع سنوية' : 'Quarterly Plan'
  if (days === 365 || days === 366) return isArabic ? 'الخطة السنوية' : 'Yearly Plan'
  return isArabic ? 'خطة المستودع' : 'Warehouse Plan'
}

export function inCycle(iso: string, start?: string | null, end?: string | null): boolean {
  if (!start || !end) return true
  const t = new Date(iso).getTime()
  return t >= new Date(start).getTime() && t <= new Date(end).getTime()
}

export function paymentDateFor(invoice: { status: string; updatedAt: string }): string {
  if (invoice.status !== 'paid') return '—'
  return formatDate(invoice.updatedAt)
}

export function DetailField({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value?: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-sm text-foreground', mono && 'font-mono')}>{value ?? '—'}</dd>
    </div>
  )
}

export function ChargeRow({
  label,
  amount,
  emphasize,
}: {
  label: string
  amount: string
  emphasize?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2.5',
        emphasize
          ? 'mt-2 border-t-2 border-border pt-3 font-semibold'
          : 'border-b border-border/60',
      )}
    >
      <span className={emphasize ? 'text-foreground' : 'text-sm text-muted-foreground'}>{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground" dir="ltr">
        {formatDecimal(amount)} {BILLING_CURRENCY}
      </span>
    </div>
  )
}

export function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <li className="relative ms-1.5 border-s border-border ps-5 pb-4 last:pb-0">
      <span className="absolute start-0 top-1.5 size-2.5 -translate-x-1/2 rounded-full bg-primary ring-4 ring-brand-50 rtl:translate-x-1/2" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
    </li>
  )
}

export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}
