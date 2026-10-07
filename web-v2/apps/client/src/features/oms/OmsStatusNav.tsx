import { StatusCards, type StatusCardItem, type Tone } from '@emdad/ui'
import { clientOmsStatusTone } from '@/lib/oms-tone'
import type { ClientOmsOrdersNavCounts } from '@/services/clientOmsOrdersService'

const CARDS: { value: string; ar: string; en: string }[] = [
  { value: '', ar: 'جميع الحالات', en: 'All statuses' },
  { value: 'waiting_for_confirmation', ar: 'بانتظار التأكيد', en: 'Waiting for confirmation' },
  { value: 'confirmed_waiting_for_admin_approval', ar: 'بانتظار الإدارة', en: 'Waiting for admin' },
  { value: 'processing', ar: 'قيد المعالجة', en: 'Processing' },
  { value: 'ready_to_ship', ar: 'جاهز للشحن', en: 'Ready to ship' },
  { value: 'shipped', ar: 'خارج للتسليم', en: 'Out for delivery' },
  { value: 'delivered', ar: 'تم التسليم', en: 'Delivered' },
  { value: 'failed_delivery', ar: 'فشل التسليم', en: 'Failed delivery' },
  { value: 'returned', ar: 'مرتجع', en: 'Returned' },
  { value: 'cancelled', ar: 'ملغي', en: 'Cancelled' },
]

const fmt = (v: number | undefined) => (v == null || Number.isNaN(v) ? '—' : v.toLocaleString('en-US'))

/** Commercial status filter cards (All + display statuses). Counts from nav-counts API. */
export function OmsStatusNav({
  isArabic,
  status,
  counts,
  onStatusChange,
}: {
  isArabic: boolean
  status: string
  counts?: ClientOmsOrdersNavCounts | null
  onStatusChange: (status: string) => void
}) {
  const items: StatusCardItem[] = CARDS.map((c) => ({
    key: c.value || '__all__',
    label: isArabic ? c.ar : c.en,
    count: fmt(c.value === '' ? counts?.total : counts?.byStatus?.[c.value]),
    tone: (c.value === '' ? 'neutral' : clientOmsStatusTone(c.value)) as Tone,
  }))

  return (
    <section aria-label={isArabic ? 'الحالات العامة' : 'General statuses'} className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {isArabic ? 'الحالات العامة' : 'General statuses'}
      </h2>
      <StatusCards
        items={items}
        selectedKey={status || '__all__'}
        onSelect={(k) => onStatusChange(k === '__all__' ? '' : k)}
        ariaLabel={isArabic ? 'الحالات العامة' : 'General statuses'}
      />
    </section>
  )
}
