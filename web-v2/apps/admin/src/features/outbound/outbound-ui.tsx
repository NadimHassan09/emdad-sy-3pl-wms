import { StatusBadge, type Tone } from '@emdad/ui'

/** Backend may emit `waiting_for_shipping_method` before details (not always in the TS union). */
export const OUTBOUND_STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  pending_approval: 'warning',
  pending_stock: 'pending',
  confirmed: 'progress',
  allocated: 'progress',
  picking: 'progress',
  packing: 'progress',
  waiting_for_shipping_method: 'transit',
  waiting_for_shipping_details: 'transit',
  ready_to_ship: 'ready',
  out_for_delivery: 'transit',
  shipped: 'success',
  externally_fulfilled: 'success',
  delivered: 'success',
  returned: 'returned',
  cancelled: 'neutral',
}

const STATUS_LABEL_EN: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  pending_stock: 'Pending stock',
  confirmed: 'Confirmed',
  allocated: 'Allocated',
  picking: 'Picking',
  packing: 'Packing',
  waiting_for_shipping_method: 'Waiting for shipping method',
  waiting_for_shipping_details: 'Waiting for shipping details',
  ready_to_ship: 'Waiting for dispatch',
  out_for_delivery: 'Out for delivery',
  shipped: 'Shipped',
  externally_fulfilled: 'Fulfilled outside warehouse',
  delivered: 'Delivered',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

const STATUS_LABEL_AR: Record<string, string> = {
  draft: 'مسودة',
  pending_approval: 'بانتظار الموافقة',
  pending_stock: 'بانتظار المخزون',
  confirmed: 'مؤكد',
  allocated: 'مخصص',
  picking: 'التقاط',
  packing: 'تعبئة',
  waiting_for_shipping_method: 'بانتظار طريقة الشحن',
  waiting_for_shipping_details: 'بانتظار تفاصيل الشحن',
  ready_to_ship: 'بانتظار الإرسال',
  out_for_delivery: 'خرج للتسليم',
  shipped: 'تم الشحن',
  externally_fulfilled: 'منفّذ خارج المستودع',
  delivered: 'تم التسليم',
  returned: 'مرتجع',
  cancelled: 'ملغي',
}

export function outboundStatusTone(status: string): Tone {
  return OUTBOUND_STATUS_TONE[status] ?? 'neutral'
}

export function outboundStatusLabel(status: string, isArabic: boolean): string {
  if (isArabic && STATUS_LABEL_AR[status]) return STATUS_LABEL_AR[status]
  if (STATUS_LABEL_EN[status]) return STATUS_LABEL_EN[status]
  return status.replace(/_/g, ' ')
}

/** Operational headline shown on the detail header (legacy parity). */
export function outboundStatusHeadline(status: string, isArabic: boolean): string | null {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  switch (status) {
    case 'pending_approval':
      return t('Waiting for approval', 'بانتظار الموافقة')
    case 'picking':
      return t('Waiting for picking', 'بانتظار الالتقاط')
    case 'packing':
      return t('Waiting for packing', 'بانتظار التعبئة')
    case 'waiting_for_shipping_method':
      return t('Waiting for shipping method', 'بانتظار طريقة الشحن')
    case 'waiting_for_shipping_details':
      return t('Waiting for shipping details', 'بانتظار تفاصيل الشحن')
    case 'ready_to_ship':
      return t('Waiting for dispatch', 'بانتظار الإرسال')
    case 'externally_fulfilled':
      return t('Fulfilled outside warehouse', 'منفّذ خارج المستودع')
    default:
      return null
  }
}

export function OutboundStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return (
    <StatusBadge tone={outboundStatusTone(status)}>
      {outboundStatusLabel(status, isArabic)}
    </StatusBadge>
  )
}

export const OUTBOUND_STATUS_FILTER_OPTIONS: Array<{ value: string; labelEn: string; labelAr: string }> = [
  { value: '', labelEn: 'All statuses', labelAr: 'كل الحالات' },
  { value: 'draft', labelEn: 'Draft', labelAr: 'مسودة' },
  { value: 'pending_approval', labelEn: 'Pending approval', labelAr: 'بانتظار الموافقة' },
  { value: 'pending_stock', labelEn: 'Pending stock', labelAr: 'بانتظار المخزون' },
  { value: 'confirmed', labelEn: 'Confirmed', labelAr: 'مؤكد' },
  { value: 'picking', labelEn: 'Picking', labelAr: 'التقاط' },
  { value: 'packing', labelEn: 'Packing', labelAr: 'تعبئة' },
  { value: 'waiting_for_shipping_method', labelEn: 'Waiting for shipping method', labelAr: 'بانتظار طريقة الشحن' },
  { value: 'waiting_for_shipping_details', labelEn: 'Waiting for shipping details', labelAr: 'بانتظار تفاصيل الشحن' },
  { value: 'ready_to_ship', labelEn: 'Waiting for dispatch', labelAr: 'بانتظار الإرسال' },
  { value: 'shipped', labelEn: 'Shipped', labelAr: 'تم الشحن' },
  { value: 'externally_fulfilled', labelEn: 'Fulfilled outside warehouse', labelAr: 'منفّذ خارج المستودع' },
  { value: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغي' },
]
