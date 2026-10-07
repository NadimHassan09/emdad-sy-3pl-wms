import type { ReactNode } from 'react'
import { StatusBadge, type Tone } from '@emdad/ui'
import type { BillingCycleStatus, BillingInvoiceStatus } from '@/api/billing'
import type { BillingCycleStatusDisplay, BillingStatusDisplay } from '@/lib/billing-plan-overview'
import { humanizeInvoiceStatus } from '@/lib/billing-invoice-display'

export const BILLING_CURRENCY = 'USD'

export function canMutateBilling(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'wh_manager'
}

const INVOICE_TONE: Record<string, Tone> = {
  draft: 'neutral',
  unpaid: 'progress',
  open: 'progress',
  overdue: 'warning',
  paid: 'success',
  cancelled: 'returned',
}

const CYCLE_TONE: Record<BillingCycleStatus, Tone> = {
  active: 'success',
  renewed: 'transit',
  expired: 'danger',
}

const CYCLE_DISPLAY_TONE: Record<BillingCycleStatusDisplay, Tone> = {
  active: 'success',
  renewed: 'transit',
  expired: 'danger',
  none: 'neutral',
}

const BILLING_STATUS_TONE: Record<BillingStatusDisplay, Tone> = {
  operational: 'success',
  restricted: 'danger',
  inactive: 'neutral',
}

export function invoiceStatusTone(status: BillingInvoiceStatus | string): Tone {
  return INVOICE_TONE[status] ?? 'neutral'
}

export function cycleStatusTone(status: BillingCycleStatus | string): Tone {
  return CYCLE_TONE[status as BillingCycleStatus] ?? 'neutral'
}

export function cycleDisplayTone(status: BillingCycleStatusDisplay): Tone {
  return CYCLE_DISPLAY_TONE[status]
}

export function billingStatusTone(status: BillingStatusDisplay): Tone {
  return BILLING_STATUS_TONE[status]
}

export function invoiceStatusLabel(status: string, isArabic: boolean): string {
  if (isArabic) {
    const ar: Record<string, string> = {
      draft: 'مسودة',
      unpaid: 'غير مدفوعة',
      open: 'غير مدفوعة',
      paid: 'مدفوعة',
      cancelled: 'ملغاة',
      overdue: 'متأخرة',
    }
    if (ar[status]) return ar[status]
  }
  return humanizeInvoiceStatus(status)
}

export function cycleStatusLabel(status: string, isArabic: boolean): string {
  if (isArabic) {
    const ar: Record<string, string> = {
      active: 'نشطة',
      renewed: 'مجدولة للتجديد',
      expired: 'منتهية',
      none: 'لا دورة',
    }
    if (ar[status]) return ar[status]
  }
  if (status === 'renewed') return 'Marked for renewal'
  if (status === 'active') return 'Active'
  if (status === 'expired') return 'Expired'
  if (status === 'none') return 'No cycle'
  return status
}

export function planActiveLabel(active: boolean, isArabic: boolean): string {
  return active ? (isArabic ? 'نشطة' : 'Active') : isArabic ? 'موقوفة' : 'Inactive'
}

export function InvoiceStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return <StatusBadge tone={invoiceStatusTone(status)}>{invoiceStatusLabel(status, isArabic)}</StatusBadge>
}

export function CycleStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return <StatusBadge tone={cycleStatusTone(status)}>{cycleStatusLabel(status, isArabic)}</StatusBadge>
}

export function PlanActiveBadge({ active, isArabic }: { active: boolean; isArabic: boolean }) {
  return (
    <StatusBadge tone={active ? 'success' : 'neutral'}>{planActiveLabel(active, isArabic)}</StatusBadge>
  )
}

export function DaysRemainingBadge({
  daysRemaining,
  isArabic,
}: {
  daysRemaining: number | null
  isArabic: boolean
}) {
  if (daysRemaining == null) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  if (daysRemaining < 0) {
    return (
      <StatusBadge tone="danger">{isArabic ? 'منتهية' : 'Expired'}</StatusBadge>
    )
  }
  if (daysRemaining === 0) {
    return (
      <StatusBadge tone="warning">{isArabic ? 'آخر يوم' : 'Last day'}</StatusBadge>
    )
  }
  const text = isArabic
    ? `${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'}`
    : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
  if (daysRemaining <= 3) return <StatusBadge tone="danger">{text}</StatusBadge>
  if (daysRemaining <= 7) return <StatusBadge tone="warning">{text}</StatusBadge>
  return <span className="text-sm">{text}</span>
}

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}
