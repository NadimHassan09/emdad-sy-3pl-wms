import type {
  ShippingCreateShipmentInput,
  ShippingQuoteInput,
} from '../../shipping-provider.interface';
import { normalizeShippingPhoneCountry } from '../../shipping-config.util';
import { isBabelAddressDeliveryAvailable } from './babel-quote.util';

export { isBabelAddressDeliveryAvailable } from './babel-quote.util';
export {
  isBabelCalculatePriceShippable,
  type BabelCalculatePriceRaw,
} from './babel-quote.util';

export function resolveBabelPickupType(
  pickupType: ShippingCreateShipmentInput['pickupType'],
): ShippingCreateShipmentInput['pickupType'] {
  // Warehouse/reseller handoff: no sender block → courier address pickup is invalid.
  return pickupType === 'address' ? 'hub' : pickupType;
}

/**
 * Babel currently rejects `payer: sender`
 * ("Payer as sender is not available right now, please choose receiver or reseller").
 * EMDAD shipping fee is collected from the receiver — never billed as sender.
 */
export function resolveBabelPayer(
  payer: ShippingCreateShipmentInput['payer'],
): Exclude<ShippingCreateShipmentInput['payer'], 'sender'> {
  return payer === 'reseller' ? 'reseller' : 'receiver';
}

/**
 * Babel OpenAPI accepts COD currency (example uses USD; amount 0 disables COD).
 * Pass through the order's business currency — do NOT force SYP when COD is USD
 * (that would send "50 SYP" for a 50 USD COD and trip Babel's SYP minimum).
 * Shipping *rate* quotes may still return SYP; that is separate from COD currency.
 */
export function resolveBabelCodCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase();
  if (normalized === 'USD' || normalized === 'SYP') return normalized;
  // Unknown / missing: Babel docs example defaults COD to USD; EMDAD business currency is USD.
  return 'USD';
}

function resolveParts(
  input: Pick<ShippingCreateShipmentInput, 'parts' | 'weightKg' | 'packageType'>,
): Array<{ weight: number }> {
  if (input.packageType === 'envelope') {
    return [{ weight: 1 }];
  }
  if (input.parts && input.parts.length > 0) {
    return input.parts.map((p) => ({
      weight: Math.max(0.1, Number(p.weight) || 0.1),
    }));
  }
  const w = Number(input.weightKg);
  return [{ weight: Number.isFinite(w) && w > 0 ? w : 0.1 }];
}

function resolveNeighbourhood(input: {
  neighbourhoodId?: number | null;
  lat?: number;
  lng?: number;
  receiverLat?: number;
  receiverLng?: number;
}):
  | { id: number }
  | { coordinates: { lat: number; lng: number } } {
  if (input.neighbourhoodId != null && Number.isFinite(Number(input.neighbourhoodId))) {
    return { id: Number(input.neighbourhoodId) };
  }
  const lat = input.lat ?? input.receiverLat;
  const lng = input.lng ?? input.receiverLng;
  return {
    coordinates: {
      lat: Number(lat),
      lng: Number(lng),
    },
  };
}

export function mapCreateShipmentPayload(input: ShippingCreateShipmentInput) {
  const neighbourhood = resolveNeighbourhood({
    neighbourhoodId: input.receiver.neighbourhoodId,
    lat: input.receiver.lat,
    lng: input.receiver.lng,
  });

  return {
    shipment: {
      receiver: {
        name: input.receiver.name,
        phone: {
          country: input.receiver.phoneCountry,
          phone: input.receiver.phoneLocal,
        },
        address: input.receiver.address,
        neighbourhood,
      },
      type: input.packageType,
      parts: resolveParts(input),
      contents: input.contents,
      deliveryType: input.deliveryType,
      pickupType: resolveBabelPickupType(input.pickupType),
      cod: {
        amount: input.codAmount,
        currency: resolveBabelCodCurrency(input.currency),
      },
      payer: resolveBabelPayer(input.payer),
      ...(input.reference ? { reference: input.reference } : {}),
    },
  };
}

export function mapCalculatePricePayload(input: ShippingQuoteInput) {
  const neighbourhood = resolveNeighbourhood({
    neighbourhoodId: input.neighbourhoodId,
    receiverLat: input.receiverLat,
    receiverLng: input.receiverLng,
  });
  const parts =
    input.parts && input.parts.length > 0
      ? input.parts.map((p) => ({ weight: Math.max(0.1, Number(p.weight) || 0.1) }))
      : resolveParts({
          packageType: input.packageType,
          weightKg: input.weightKg,
          parts: undefined,
        });

  return {
    delivery: {
      receiver: {
        neighbourhood,
      },
      type: input.packageType,
      parts: input.packageType === 'envelope' ? [{ weight: 1 }] : parts,
      deliveryType: input.deliveryType,
      // Reseller warehouse: always hub pickup for quote/create consistency.
      pickupType: resolveBabelPickupType(input.pickupType ?? 'hub'),
    },
  };
}

/**
 * Split recipient phone into Babel dial-code + local number.
 * Prefers explicit shippingPhoneCountry when provided.
 */
export function parsePhoneForBabel(
  recipientPhone: string | null | undefined,
  shippingPhoneCountry?: string | null,
): { country: string; phone: string } | null {
  const countryHint = normalizeShippingPhoneCountry(shippingPhoneCountry);
  const raw = (recipientPhone ?? '').trim();
  if (!raw && !countryHint) return null;

  const digits = raw.replace(/[^\d+]/g, '');
  let local = digits.replace(/^\+/, '');

  if (countryHint) {
    if (local.startsWith(countryHint)) {
      local = local.slice(countryHint.length);
    }
    local = local.replace(/^0+/, '');
    if (!local) return null;
    return { country: countryHint, phone: local };
  }

  // Common Syria formats: +9639…, 00963…, 963…, 09…
  if (local.startsWith('00963')) local = local.slice(5);
  else if (local.startsWith('963')) local = local.slice(3);
  else if (local.startsWith('0') && local.length >= 9) {
    return { country: '963', phone: local.replace(/^0+/, '') };
  } else if (local.length >= 7) {
    // Default to Syria for unrecognized formats
    return { country: '963', phone: local.replace(/^0+/, '') };
  } else {
    return null;
  }

  local = local.replace(/^0+/, '');
  if (!local) return null;
  return { country: '963', phone: local };
}
