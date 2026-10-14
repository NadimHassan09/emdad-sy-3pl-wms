import { mapOmsCommercialDisplayStatus } from './oms-commercial-status';

/** Warehouse stages that are meaningful only under commercial Processing. */
export const OMS_OPERATIONAL_STAGES = [
  'picking',
  'packing',
  'shipping_details',
  'shipping_confirmation',
] as const;

export type OmsOperationalStage = (typeof OMS_OPERATIONAL_STAGES)[number];

const PICKING_OUTBOUND = new Set([
  'picking',
  'draft',
  'allocated',
  'pending_approval',
  'confirmed',
  'pending_stock',
]);

const SHIPPING_OUTBOUND = new Set([
  'waiting_for_shipping_method',
  'waiting_for_shipping_details',
]);

const STAGE_LABELS: Record<OmsOperationalStage, { en: string; ar: string }> = {
  picking: { en: 'Waiting for picking', ar: 'بانتظار الالتقاط' },
  packing: { en: 'Waiting for packing', ar: 'بانتظار التغليف' },
  shipping_details: { en: 'Shipping details', ar: 'تفاصيل الشحن' },
  shipping_confirmation: { en: 'Waiting for shipping confirmation', ar: 'بانتظار تأكيد الشحن' },
};

export function isOmsOperationalStage(value: string): value is OmsOperationalStage {
  return (OMS_OPERATIONAL_STAGES as readonly string[]).includes(value);
}

export function omsOperationalStageLabel(stage: string, isArabic = false): string {
  if (!isOmsOperationalStage(stage)) return stage;
  const labels = STAGE_LABELS[stage];
  return isArabic ? labels.ar : labels.en;
}

export type OmsStageSource = {
  status: string;
  trackingNumber?: string | null;
  linkedOutboundOrder?: {
    status?: string | null;
    trackingNumber?: string | null;
    hasCarrierShipment?: boolean;
  } | null;
};

/**
 * Meaningful operational stage for an order.
 * Returns null when the general status has only one implied stage.
 */
export function orderOperationalStage(order: OmsStageSource): OmsOperationalStage | null {
  if (mapOmsCommercialDisplayStatus(order.status) !== 'processing') return null;
  const outbound = order.linkedOutboundOrder?.status;
  if (!outbound) return null;
  if (PICKING_OUTBOUND.has(outbound)) return 'picking';
  if (outbound === 'packing') return 'packing';
  if (!SHIPPING_OUTBOUND.has(outbound)) return null;

  const shipmentSent = Boolean(
    order.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.hasCarrierShipment,
  );
  return shipmentSent ? 'shipping_confirmation' : 'shipping_details';
}

/** Stage column is useful for all statuses, or when the selected status has multiple stages. */
export function shouldShowOmsStageColumn(selectedStatus: string): boolean {
  const status = selectedStatus.trim();
  if (!status) return true;
  return status === 'processing';
}

export function statusHasOperationalStages(selectedStatus: string): boolean {
  return selectedStatus.trim() === 'processing';
}
