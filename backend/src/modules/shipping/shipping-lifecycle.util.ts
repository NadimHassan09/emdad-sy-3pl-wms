import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

import { normalizeCourierDisplayName } from './shipping-carrier-resolver';

export const PRE_DISPATCH_UNLOCK_OMS = new Set<string>([
  OmsOrderStatus.processing,
  OmsOrderStatus.pending,
  OmsOrderStatus.approved,
  OmsOrderStatus.confirmed,
  OmsOrderStatus.allocated,
  OmsOrderStatus.picking,
  OmsOrderStatus.packing,
  OmsOrderStatus.ready_to_ship,
]);

export const TERMINAL_NO_UNLOCK_OMS = new Set<string>([
  OmsOrderStatus.out_for_delivery,
  OmsOrderStatus.shipped,
  OmsOrderStatus.delivered,
  OmsOrderStatus.returned,
  OmsOrderStatus.cancelled,
  OmsOrderStatus.completed,
]);

export type CarrierShipmentActivity = {
  status?: string | null;
  supersededAt?: Date | string | null;
  trackingNumber?: string | null;
  externalAwb?: string | null;
};

export const INACTIVE_CARRIER_SHIPMENT_STATUSES = ['failed'] as const;

/** Prisma filter for the live shipment — excludes failed, cancelled, and superseded rows. */
export const ACTIVE_CARRIER_SHIPMENT_WHERE = {
  supersededAt: null,
  status: { notIn: [...INACTIVE_CARRIER_SHIPMENT_STATUSES] },
};

export function isActiveCarrierShipment(shipment: CarrierShipmentActivity | null | undefined): boolean {
  if (!shipment) return false;
  if (shipment.supersededAt) return false;
  const status = (shipment.status || '').trim();
  if (status === 'failed' || status === 'cancelled') return false;
  return true;
}

export function pickActiveCarrierShipment<T extends CarrierShipmentActivity>(
  shipments: T[] | null | undefined,
): T | null {
  if (!shipments?.length) return null;
  return shipments.find((shipment) => isActiveCarrierShipment(shipment)) ?? null;
}

export function isAwbPendingReassignment(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  return Boolean((meta as Record<string, unknown>).awbPendingReassignment);
}

export function normalizeWaybillScanCode(raw: string): string {
  let clean = raw.trim();
  if (!clean) return '';
  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const url = new URL(clean);
      const segments = url.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) clean = decodeURIComponent(last);
    }
  } catch {
    /* keep the raw code */
  }
  return clean.trim();
}

export function waybillScanAttempts(code: string): string[] {
  const attempts = [code];
  const stripped = code.replace(/^emd-/i, '');
  if (stripped && stripped !== code) attempts.push(stripped);
  return attempts;
}

export function shipmentScanValues(shipment: {
  trackingNumber?: string | null;
  externalAwb?: string | null;
}): string[] {
  return [shipment.trackingNumber, shipment.externalAwb]
    .map((value) => (value || '').trim().toLowerCase())
    .filter(Boolean);
}

/** Delayed events from a failed/superseded shipment must not mutate the live order. */
export function shouldApplyTrackingToOrder(
  shipment: CarrierShipmentActivity | null | undefined,
): boolean {
  return isActiveCarrierShipment(shipment);
}

export function isSilaPendingCancelMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object') return false;
  const record = meta as Record<string, unknown>;
  const nested =
    record.silaCancel && typeof record.silaCancel === 'object'
      ? (record.silaCancel as Record<string, unknown>)
      : record;
  return String(nested.state || '').trim() === 'pending_confirmation';
}

export function mayUnlockToShippingDetails(omsStatus?: string | null): boolean {
  const status = (omsStatus || '').trim();
  if (!status) return true;
  if (TERMINAL_NO_UNLOCK_OMS.has(status)) return false;
  return PRE_DISPATCH_UNLOCK_OMS.has(status) || status === 'waiting_for_confirmation';
}

/** Fields cleared on the live order after a verified pre-dispatch carrier cancel. */
export function carrierUnlinkPatch(): {
  trackingNumber: null;
  carrier: null;
  shippingProviderCode: null;
  shippingServiceId: null;
  shippingHubId: null;
} {
  return {
    trackingNumber: null,
    carrier: null,
    shippingProviderCode: null,
    shippingServiceId: null,
    shippingHubId: null,
  };
}

export function omsStatusAfterPreDispatchUnlock(
  current: string | null | undefined,
): OmsOrderStatus {
  if (current === OmsOrderStatus.ready_to_ship) return OmsOrderStatus.ready_to_ship;
  if (current && (Object.values(OmsOrderStatus) as string[]).includes(current)) {
    return current as OmsOrderStatus;
  }
  return OmsOrderStatus.ready_to_ship;
}

export function outboundStatusAfterPreDispatchUnlock(
  current: string | null | undefined,
): OutboundOrderStatus {
  if (current === OutboundOrderStatus.ready_to_ship) {
    return OutboundOrderStatus.waiting_for_shipping_details;
  }
  if (current && (Object.values(OutboundOrderStatus) as string[]).includes(current)) {
    return current as OutboundOrderStatus;
  }
  return OutboundOrderStatus.waiting_for_shipping_details;
}

export type ConfirmedCourier = {
  courierId: string | null;
  courierName: string | null;
};

export function confirmedCourierReassignment(params: {
  storedCourierId?: string | null;
  storedCarrierName?: string | null;
  confirmed: ConfirmedCourier;
}): { changed: boolean; courierId: string | null; displayName: string | null } {
  const confirmedId = params.confirmed.courierId?.trim() || null;
  const confirmedName = params.confirmed.courierName?.trim() || null;
  if (!confirmedId && !confirmedName) {
    return { changed: false, courierId: null, displayName: null };
  }
  const storedId = params.storedCourierId?.trim().toLowerCase() || '';
  const idChanged =
    Boolean(confirmedId) && storedId !== '' && storedId !== confirmedId!.toLowerCase();
  const storedName = params.storedCarrierName
    ? normalizeCourierDisplayName(params.storedCarrierName).toLowerCase()
    : '';
  const confirmedNorm = confirmedName ? normalizeCourierDisplayName(confirmedName).toLowerCase() : '';
  const nameChanged =
    Boolean(confirmedNorm) &&
    storedName !== '' &&
    storedName !== confirmedNorm &&
    !storedName.includes('sila');
  return {
    changed: idChanged || (Boolean(confirmedId) && storedId === '') || nameChanged,
    courierId: confirmedId,
    displayName: confirmedName,
  };
}

export function hubIdFromFingerprint(hubId?: string | null): string {
  return (hubId || '').trim();
}

export function requireHubSelection(params: {
  deliveryType?: string | null;
  hubs: Array<{ id: string }>;
  selectedHubId?: string | null;
  nearestDetermined: boolean;
}): string | null {
  const delivery = (params.deliveryType || '').trim();
  if (delivery !== 'hub') return null;
  if (params.hubs.length === 0) return null;
  const selected = params.selectedHubId?.trim() || '';
  if (selected && params.hubs.some((hub) => hub.id === selected)) return null;
  if (params.hubs.length === 1) return null;
  if (!params.nearestDetermined || !selected) {
    return 'Select a delivery hub before creating the shipment. The nearest hub could not be used automatically.';
  }
  return null;
}

/** Blocks send when the quote failed, the hub changed, or hub selection is missing. */
export function shipmentSendGuard(params: {
  quoteError?: string | null;
  deliveryType?: string | null;
  hubs?: Array<{ id: string }>;
  selectedHubId?: string | null;
  fingerprintHubId?: string | null;
  nearestDetermined?: boolean;
}): string | null {
  const quoteError = (params.quoteError || '').trim();
  if (quoteError) {
    return quoteError;
  }
  const delivery = (params.deliveryType || '').trim();
  const selectedHub = hubIdFromFingerprint(params.selectedHubId);
  const fingerprintHub = hubIdFromFingerprint(params.fingerprintHubId);
  if (delivery === 'hub' && selectedHub !== fingerprintHub) {
    return 'Quote is stale after hub selection changed. Refresh the quote and confirm the new rate before sending.';
  }
  return requireHubSelection({
    deliveryType: delivery,
    hubs: params.hubs ?? [],
    selectedHubId: selectedHub,
    nearestDetermined: Boolean(params.nearestDetermined),
  });
}
