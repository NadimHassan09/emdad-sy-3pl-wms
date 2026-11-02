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

const STAGE_LABELS: Record<OmsOperationalStage, { en: string; ar: string }> = {
  picking: { en: 'Waiting for picking', ar: 'بانتظار الالتقاط' },
  packing: { en: 'Waiting for packing', ar: 'بانتظار التغليف' },
  shipping_details: { en: 'Shipping details', ar: 'تفاصيل الشحن' },
  shipping_confirmation: { en: 'Waiting for shipping confirmation', ar: 'بانتظار تأكيد الشحن' },
};

export const PROCESSING_OPERATIONAL_STAGES: readonly OmsOperationalStage[] = [
  'picking',
  'packing',
] as const;

export const READY_TO_SHIP_OPERATIONAL_STAGES: readonly OmsOperationalStage[] = [
  'shipping_details',
  'shipping_confirmation',
] as const;

export function operationalStagesForStatus(status: string): readonly OmsOperationalStage[] {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'processing') return PROCESSING_OPERATIONAL_STAGES;
  if (normalized === 'ready_to_ship') return READY_TO_SHIP_OPERATIONAL_STAGES;
  return [];
}

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
 * Meaningful operational stage for an order:
 * Processing: picking, packing
 * Ready to Ship: shipping_details, shipping_confirmation
 */
export function orderOperationalStage(order: OmsStageSource): OmsOperationalStage | null {
  const outbound = order.linkedOutboundOrder?.status;
  const shipmentSent = Boolean(
    order.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.hasCarrierShipment,
  );

  if (
    outbound === 'waiting_for_shipping_method' ||
    outbound === 'waiting_for_shipping_details' ||
    outbound === 'ready_to_ship'
  ) {
    return shipmentSent ? 'shipping_confirmation' : 'shipping_details';
  }

  if (outbound && PICKING_OUTBOUND.has(outbound)) return 'picking';
  if (outbound === 'packing') return 'packing';

  const displayStatus = mapOmsCommercialDisplayStatus(order.status);
  if (displayStatus === 'ready_to_ship') {
    return shipmentSent ? 'shipping_confirmation' : 'shipping_details';
  }
  if (displayStatus === 'processing') {
    return 'picking';
  }

  return null;
}

/**
 * Enforce canonical main status based on operational stage:
 * - Picking / Packing -> processing
 * - Shipping Details / Shipping Confirmation -> ready_to_ship
 */
export function orderMainStatus(order: OmsStageSource): string {
  const stage = orderOperationalStage(order);
  if (stage === 'shipping_details' || stage === 'shipping_confirmation') {
    return 'ready_to_ship';
  }
  if (stage === 'picking' || stage === 'packing') {
    return 'processing';
  }
  return mapOmsCommercialDisplayStatus(order.status);
}

/** Stage column is useful for all statuses, or when the selected status has multiple stages. */
export function shouldShowOmsStageColumn(selectedStatus: string): boolean {
  const status = selectedStatus.trim();
  if (!status) return true;
  return status === 'processing' || status === 'ready_to_ship';
}

export function statusHasOperationalStages(selectedStatus: string): boolean {
  const status = selectedStatus.trim();
  return status === 'processing' || status === 'ready_to_ship';
}
