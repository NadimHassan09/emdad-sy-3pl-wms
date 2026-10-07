import {
  Box,
  Check,
  CheckSquare,
  Clock,
  PackageOpen,
  Send,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import type { OmsOrderDetail, OmsOrderEvent } from '@/api/oms'

type MilestoneKey =
  | 'waiting_for_confirmation'
  | 'confirmed'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'

type MilestoneDef = { key: MilestoneKey; labelEn: string; labelAr: string; Icon: LucideIcon }

const MILESTONES: MilestoneDef[] = [
  { key: 'waiting_for_confirmation', labelEn: 'Waiting for confirmation', labelAr: 'بانتظار التأكيد', Icon: Clock },
  { key: 'confirmed', labelEn: 'Confirmed', labelAr: 'مؤكد', Icon: CheckSquare },
  { key: 'processing', labelEn: 'Processing', labelAr: 'قيد المعالجة', Icon: PackageOpen },
  { key: 'ready_to_ship', labelEn: 'Ready to ship', labelAr: 'جاهز للشحن', Icon: Send },
  { key: 'shipped', labelEn: 'Out for delivery', labelAr: 'خرج للتسليم', Icon: Truck },
  { key: 'delivered', labelEn: 'Delivered', labelAr: 'تم التسليم', Icon: Box },
]

function resolveCurrentKey(status: string): MilestoneKey {
  switch (status) {
    case 'waiting_for_confirmation':
    case 'draft':
      return 'waiting_for_confirmation'
    case 'confirmed_waiting_for_admin_approval':
    case 'pending_approval':
    case 'confirmed':
      return 'confirmed'
    case 'processing':
    case 'pending':
    case 'approved':
    case 'allocated':
    case 'picking':
    case 'packing':
      return 'processing'
    case 'ready_to_ship':
      return 'ready_to_ship'
    case 'shipped':
    case 'out_for_delivery':
      return 'shipped'
    case 'delivered':
    case 'completed':
    case 'returned':
      return 'delivered'
    default:
      return 'waiting_for_confirmation'
  }
}

function formatStepTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function firstEventAt(timeline: OmsOrderEvent[] | undefined, types: string[]): string | null {
  if (!timeline?.length) return null
  const set = new Set(types)
  const hit = timeline.find((e) => set.has(e.eventType))
  return hit?.createdAt ?? null
}

function stepTimestamp(key: MilestoneKey, order: OmsOrderDetail): string | null {
  const timeline = order.timeline
  switch (key) {
    case 'waiting_for_confirmation':
      return (
        order.submittedAt ??
        firstEventAt(timeline, ['order.waiting_for_confirmation', 'oms.created', 'order.created']) ??
        order.createdAt
      )
    case 'confirmed':
      return (
        order.confirmedAt ??
        firstEventAt(timeline, ['oms.confirmed', 'order.confirmed_waiting_for_admin_approval'])
      )
    case 'processing':
      return (
        order.approvedAt ??
        firstEventAt(timeline, ['oms.approved', 'oms.processing', 'outbound.created'])
      )
    case 'ready_to_ship':
      return firstEventAt(timeline, ['oms.ready_to_ship', 'order.ready_to_ship'])
    case 'shipped':
      return (
        order.outForDeliveryAt ??
        firstEventAt(timeline, ['oms.shipped', 'oms.out_for_delivery', 'order.shipped'])
      )
    case 'delivered':
      return order.deliveredAt ?? firstEventAt(timeline, ['oms.delivered', 'order.delivered'])
    default:
      return null
  }
}

type Props = { order: OmsOrderDetail; isArabic: boolean }

export function OmsOrderTrackingPanel({ order, isArabic }: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const isReturned = order.status === 'returned'
  const isRejected = order.status === 'rejected'
  const isFailed = order.status === 'failed_delivery'
  const isCancelled = order.status === 'cancelled'
  const terminalBad = isReturned || isRejected || isFailed
  const currentKey = resolveCurrentKey(order.status)
  const currentIdx = Math.max(0, MILESTONES.findIndex((m) => m.key === currentKey))
  const isFullyDelivered = order.status === 'delivered' || order.status === 'completed'

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="size-4 text-muted-foreground" aria-hidden />
          {t('Order tracking', 'تتبع الطلب')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {isCancelled ? (
          <p className="text-sm text-muted-foreground">{t('This order was cancelled.', 'تم إلغاء هذا الطلب.')}</p>
        ) : (
          <div className="overflow-x-auto pb-1">
            <ol
              className="flex min-w-[720px] items-start"
              aria-label={t(
                `Step ${currentIdx + 1} of ${MILESTONES.length}`,
                `الخطوة ${currentIdx + 1} من ${MILESTONES.length}`,
              )}
            >
              {MILESTONES.map((step, idx) => {
                const isCurrent = idx === currentIdx && !isFullyDelivered
                const isDone = idx < currentIdx || (isFullyDelivered && idx <= currentIdx)
                const filled = isDone || isCurrent
                const ts = formatStepTime(stepTimestamp(step.key, order))
                const Icon = step.Icon
                return (
                  <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                    <div className="flex w-full items-center">
                      <div
                        className={`h-0 flex-1 border-t-2 ${idx === 0 ? 'border-transparent' : filled ? 'border-primary border-solid' : 'border-dashed border-muted'}`}
                        aria-hidden
                      />
                      <span
                        className={`relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full ${
                          filled && terminalBad && isCurrent
                            ? 'bg-destructive text-destructive-foreground'
                            : filled
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground ring-1 ring-border'
                        }`}
                      >
                        <Icon className="size-4" aria-hidden />
                        {step.key === 'delivered' ? (
                          <Check
                            className={`absolute bottom-1 end-1 size-3 ${filled ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                            aria-hidden
                          />
                        ) : null}
                      </span>
                      <div
                        className={`h-0 flex-1 border-t-2 ${
                          idx === MILESTONES.length - 1
                            ? 'border-transparent'
                            : idx < currentIdx || isCurrent || isFullyDelivered
                              ? 'border-primary border-solid'
                              : 'border-dashed border-muted'
                        }`}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-3 max-w-36 px-1 text-center">
                      <div
                        className={`text-sm leading-snug ${filled ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}
                      >
                        {isArabic ? step.labelAr : step.labelEn}
                      </div>
                      <div className="mt-1 text-xs tabular-nums text-muted-foreground">{ts}</div>
                    </div>
                  </li>
                )
              })}
            </ol>
            {terminalBad ? (
              <p
                className="mt-4 inline-flex rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
                role="status"
              >
                {isRejected
                  ? t('Rejected', 'مرفوض')
                  : isFailed
                    ? t('Failed delivery', 'تعذر التسليم')
                    : t('Returned', 'مرتجع')}
              </p>
            ) : null}
          </div>
        )}

        <div className="border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('Timeline', 'السجل')}
          </h3>
          {order.timeline && order.timeline.length > 0 ? (
            <ol className="mt-2 list-none space-y-0 p-0">
              {order.timeline.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b py-3 last:border-b-0"
                >
                  <span className="text-sm font-medium">
                    {ev.eventType.replace(/\./g, ' ')}
                    {ev.creator?.fullName ? (
                      <span className="ms-2 text-xs font-normal text-muted-foreground">· {ev.creator.fullName}</span>
                    ) : null}
                  </span>
                  <time className="text-xs tabular-nums text-muted-foreground" dateTime={ev.createdAt}>
                    {new Date(ev.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t('No tracking events yet.', 'لا أحداث تتبع بعد.')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
