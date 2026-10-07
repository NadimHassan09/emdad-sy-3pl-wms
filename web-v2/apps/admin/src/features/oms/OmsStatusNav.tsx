import { StatusCards, type StatusCardItem, type Tone, cn } from '@emdad/ui'
import type { OmsOrdersNavCounts } from '@/api/oms'
import { omsCommercialStatusLabel } from '@/lib/oms-commercial-status'
import { OMS_OPERATIONAL_STAGES, omsOperationalStageLabel, type OmsOperationalStage } from '@/lib/oms-operational-stage'
import { omsStatusTone } from './oms-ui'

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

/** Status summary cards that filter the list (same behaviour as the classic page, soft tones). */
export function OmsStatusNav({
  isArabic, status, operationalStage, counts, onStatusChange, onStageChange,
}: {
  isArabic: boolean
  status: string
  operationalStage: string
  counts?: OmsOrdersNavCounts | null
  onStatusChange: (status: string) => void
  onStageChange: (stage: string) => void
}) {
  const showStages = status === 'processing'
  const items: StatusCardItem[] = CARDS.map((c) => ({
    key: c.value || '__all__',
    label: isArabic ? c.ar : c.en,
    count: fmt(c.value === '' ? counts?.total : counts?.byStatus?.[c.value]),
    tone: (c.value === '' ? 'neutral' : omsStatusTone(c.value)) as Tone,
  }))
  return (
    <div className="space-y-3">
      <section aria-label={isArabic ? 'الحالات العامة' : 'General statuses'}>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{isArabic ? 'الحالات العامة' : 'General statuses'}</h2>
        <StatusCards
          items={items}
          selectedKey={status || '__all__'}
          onSelect={(k) => onStatusChange(k === '__all__' ? '' : k)}
          ariaLabel={isArabic ? 'الحالات العامة' : 'General statuses'}
        />
      </section>
      {showStages ? (
        <section aria-label={isArabic ? 'المراحل التشغيلية' : 'Operational stages'}>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">{isArabic ? 'المراحل التشغيلية' : 'Operational stages'}</h2>
          <div className="flex flex-wrap items-center gap-2" role="group">
            <Chip label={isArabic ? 'الكل' : 'All'} count={counts?.byStatus?.processing} active={!operationalStage} onClick={() => onStageChange('')} />
            {OMS_OPERATIONAL_STAGES.map((stage) => (
              <Chip
                key={stage}
                label={omsOperationalStageLabel(stage, isArabic)}
                count={counts?.stages?.[stage as OmsOperationalStage]}
                active={operationalStage === stage}
                onClick={() => onStageChange(stage)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Chip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
      )}
    >
      {label}
      <span className={cn('tabular rounded-full px-2 text-xs', active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>{fmt(count)}</span>
    </button>
  )
}

export { omsCommercialStatusLabel }
