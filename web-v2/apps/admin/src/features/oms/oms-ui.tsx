import { Clock, PackageOpen, Truck } from 'lucide-react'
import { StatusBadge, type Tone } from '@emdad/ui'
import type { OmsOrderListItem } from '@/api/oms'
import { mapOmsCommercialDisplayStatus, omsCommercialStatusLabel, type OmsCommercialDisplayStatus } from '@/lib/oms-commercial-status'

/** Single OMS status → tone map (badge, status cards, row accents all read this). */
export const OMS_STATUS_TONE: Record<OmsCommercialDisplayStatus, Tone> = {
  waiting_for_confirmation: 'pending',
  confirmed_waiting_for_admin_approval: 'warning',
  processing: 'progress',
  ready_to_ship: 'ready',
  shipped: 'transit',
  delivered: 'success',
  failed_delivery: 'danger',
  returned: 'returned',
  cancelled: 'neutral',
  legacy: 'neutral',
}

export const omsStatusTone = (status: string): Tone => OMS_STATUS_TONE[mapOmsCommercialDisplayStatus(status)]

export function OmsStatusBadge({ status, isArabic, needsInformation }: { status: string; isArabic: boolean; needsInformation?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {needsInformation ? <StatusBadge tone="warning">{isArabic ? 'طلب غير مكتمل' : 'Incomplete order'}</StatusBadge> : null}
      <StatusBadge tone={omsStatusTone(status)}>{omsCommercialStatusLabel(status, isArabic)}</StatusBadge>
    </span>
  )
}

const PICKING = new Set(['picking', 'draft', 'allocated', 'pending_approval', 'confirmed', 'pending_stock'])

/** Operational stage pill — same decision tree as the classic UI, tones from the shared map. */
export function OmsStageBadge({ order, isArabic }: { order: OmsOrderListItem; isArabic: boolean }) {
  const ob = order.linkedOutboundOrder?.status
  const s = order.status
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  if (s === 'processing' || ob) {
    if (ob && PICKING.has(ob)) return <StatusBadge tone="pending">{t('Picking', 'التقاط')}</StatusBadge>
    if (ob === 'packing') return <StatusBadge tone="progress">{t('Packing', 'تعبئة')}</StatusBadge>
    if (ob === 'waiting_for_shipping_method' || ob === 'waiting_for_shipping_details') {
      const sent = Boolean(order.trackingNumber?.trim() || order.linkedOutboundOrder?.trackingNumber?.trim() || order.linkedOutboundOrder?.hasCarrierShipment)
      return sent ? (
        <StatusBadge tone="ready">{t('Waiting for shipping confirmation', 'بانتظار تأكيد الشحن')}</StatusBadge>
      ) : (
        <StatusBadge tone="transit">{t('Shipping details', 'تفاصيل الشحن')}</StatusBadge>
      )
    }
  }
  if (s === 'waiting_for_confirmation') return <StatusBadge tone="neutral">{t('Confirmation', 'تأكيد العميل')}</StatusBadge>
  if (s === 'confirmed_waiting_for_admin_approval' || s === 'pending_approval' || s === 'pending') return <StatusBadge tone="warning">{t('Admin approval', 'موافقة الإدارة')}</StatusBadge>
  if (s === 'ready_to_ship' || ob === 'ready_to_ship') return <StatusBadge tone="ready">{t('Ready to ship', 'جاهز للشحن')}</StatusBadge>
  if (s === 'shipped' || s === 'out_for_delivery' || ob === 'shipped') return <StatusBadge tone="transit">{t('Out for delivery', 'خرج للتسليم')}</StatusBadge>
  if (s === 'delivered') return <StatusBadge tone="success">{t('Delivered', 'تم التسليم')}</StatusBadge>
  if (s === 'failed_delivery') return <StatusBadge tone="danger">{t('Failed delivery', 'تعذر التسليم')}</StatusBadge>
  if (s === 'returned') return <StatusBadge tone="returned">{t('Returned', 'مرتجع')}</StatusBadge>
  if (s === 'cancelled') return <StatusBadge tone="neutral">{t('Cancelled', 'ملغي')}</StatusBadge>
  return <span className="text-xs text-muted-foreground">—</span>
}

/* ── Carrier cell ─────────────────────────────────────────────── */
type CarrierConfig = { displayName: string; logo: string; isSquare?: boolean }
const CARRIERS: Record<string, CarrierConfig> = {
  'babel express': { displayName: 'Babel Express', logo: '/carrier-logos/babel-express.svg' },
  babel: { displayName: 'Babel Express', logo: '/carrier-logos/babel-express.svg' },
  ترابط: { displayName: 'ترابط', logo: '/carrier-logos/tarabut.jpeg', isSquare: true },
  tarabut: { displayName: 'ترابط', logo: '/carrier-logos/tarabut.jpeg', isSquare: true },
  'ديليفرو جود': { displayName: 'ديليفرو جود', logo: '/carrier-logos/deliveroo-joud.svg' },
  deliveroo: { displayName: 'ديليفرو جود', logo: '/carrier-logos/deliveroo-joud.svg' },
  مسارات: { displayName: 'مسارات', logo: '/carrier-logos/masarat.png' },
  masarat: { displayName: 'مسارات', logo: '/carrier-logos/masarat.png' },
  'كرم للشحن': { displayName: 'كرم للشحن', logo: '/carrier-logos/karam.jpeg', isSquare: true },
  كرم: { displayName: 'كرم للشحن', logo: '/carrier-logos/karam.jpeg', isSquare: true },
  karam: { displayName: 'كرم للشحن', logo: '/carrier-logos/karam.jpeg', isSquare: true },
  مرسال: { displayName: 'مرسال', logo: '/carrier-logos/mersal.jpeg', isSquare: true },
  mersal: { displayName: 'مرسال', logo: '/carrier-logos/mersal.jpeg', isSquare: true },
  تكامل: { displayName: 'تكامل', logo: '/carrier-logos/takamol.svg' },
  takamol: { displayName: 'تكامل', logo: '/carrier-logos/takamol.svg' },
}

function carrierConfig(name?: string | null): CarrierConfig | null {
  if (!name) return null
  const lower = name.trim().toLowerCase()
  for (const [key, cfg] of Object.entries(CARRIERS)) if (lower === key || lower.includes(key)) return cfg
  return null
}

const pill = 'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs font-medium'

export function OmsCarrierCell({
  carrier, shippingMethod, isManualShipping, outboundStatus, isArabic,
}: { carrier?: string | null; shippingMethod?: string | null; isManualShipping?: boolean; outboundStatus?: string | null; isArabic: boolean }) {
  const preShipping = !outboundStatus || ['draft', 'allocated', 'picking', 'packing'].includes(outboundStatus)
  const name = carrier?.trim()
  const manual = !preShipping && (isManualShipping || shippingMethod === 'manual')

  if (preShipping || (!name && !manual)) {
    return (
      <span className={`${pill} text-muted-foreground`} title={isArabic ? 'قيد التحديد / لم يحدد بعد' : 'To be determined'}>
        <Clock className="size-3.5" aria-hidden />
        {isArabic ? 'قيد التحديد' : 'To be determined'}
      </span>
    )
  }
  if (manual) {
    return (
      <span className={`${pill} border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg`}>
        <PackageOpen className="size-3.5" aria-hidden />
        {isArabic ? 'شحن يدوي' : 'Manual shipping'}
      </span>
    )
  }
  const cfg = carrierConfig(name)
  if (!cfg) {
    return (
      <span className={pill} title={name}>
        <Truck className="size-3.5 text-primary" aria-hidden />
        <span className="max-w-32 truncate">{name}</span>
      </span>
    )
  }
  return (
    <span className={pill} title={name}>
      <img src={cfg.logo} alt="" className={cfg.isSquare ? 'size-5 shrink-0 rounded object-cover' : 'h-4 max-w-14 shrink-0 object-contain'} loading="lazy" />
      <span className="max-w-32 truncate">{name}</span>
    </span>
  )
}
