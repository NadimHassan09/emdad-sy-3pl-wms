/**
 * Provider lookup outcomes that must not be treated as confirmed cancellation.
 * Babel documents the same `Shipment not found` error for a missing AWB and
 * for a shipment the reseller deleted in the portal.
 */

export const PROVIDER_LOOKUP_NOT_FOUND_EVENT = 'provider.lookup_not_found';

export type ShipmentLookupState = 'ok' | 'not_found' | 'error';
export type ShipmentActivityState = 'active' | 'cancelled' | 'superseded';

export type BabelLookupMeta = {
  state: ShipmentLookupState;
  at: string;
  errorMessage?: string | null;
};

export function isProviderLookupNotFoundEvent(event: { eventType?: string | null }): boolean {
  return (event.eventType || '').trim() === PROVIDER_LOOKUP_NOT_FOUND_EVENT;
}

export function isBabelShipmentNotFoundMessage(message: string | null | undefined): boolean {
  return /shipment not found/i.test((message || '').trim());
}

export function readBabelLookupMeta(meta: unknown): BabelLookupMeta | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const raw = (meta as Record<string, unknown>).babelLookup;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const state = record.state;
  if (state !== 'ok' && state !== 'not_found' && state !== 'error') return null;
  return {
    state,
    at: typeof record.at === 'string' ? record.at : '',
    errorMessage: typeof record.errorMessage === 'string' ? record.errorMessage : null,
  };
}

export function isCancellationUnconfirmed(meta: unknown): boolean {
  return readBabelLookupMeta(meta)?.state === 'not_found';
}

export function inactiveShipmentState(shipment: {
  status?: string | null;
  supersededAt?: Date | string | null;
}): ShipmentActivityState {
  if (shipment.supersededAt) return 'superseded';
  const status = (shipment.status || '').trim();
  if (status === 'failed' || status === 'cancelled') return 'cancelled';
  return 'active';
}
