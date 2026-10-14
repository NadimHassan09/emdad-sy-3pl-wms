const CONFIRMED = new Set([
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
  'returned',
]);

export type LabelReadiness = 'ready' | 'not_confirmed' | 'no_label';

/** A confirmed shipping method is not the same thing as a printable label. */
export function shippingLabelReadiness(input: {
  status?: string | null;
  outboundStatus?: string | null;
  trackingNumber?: string | null;
  hasCreatedCarrierShipment?: boolean;
}): LabelReadiness {
  const confirmed = CONFIRMED.has(input.status ?? '') || CONFIRMED.has(input.outboundStatus ?? '');
  if (!confirmed) return 'not_confirmed';
  const tracking = input.trackingNumber?.trim();
  if (tracking || input.hasCreatedCarrierShipment) return 'ready';
  return 'no_label';
}
