import type {
  ShippingCreateShipmentInput,
  ShippingQuoteInput,
} from '../../shipping-provider.interface';
import { normalizeShippingPhoneCountry } from '../../shipping-config.util';

/** Babel returns dropoff=null when door delivery is not offered for the coordinates. */
export function isBabelAddressDeliveryAvailable(details: unknown): boolean {
  if (!details || typeof details !== 'object') return true;
  const record = details as Record<string, unknown>;
  const dropoff = record.dropoff ?? record.dropOff;
  return dropoff !== null && dropoff !== undefined;
}

export function resolveBabelPickupType(
  pickupType: ShippingCreateShipmentInput['pickupType'],
): ShippingCreateShipmentInput['pickupType'] {
  // Warehouse/reseller handoff: no sender block → courier address pickup is invalid.
  return pickupType === 'address' ? 'hub' : pickupType;
}

/** Babel requires cod.currency; quotes are returned in SYP for Syria. */
export function resolveBabelCodCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase();
  if (normalized === 'SYP') return 'SYP';
  return 'SYP';
}

export function mapCreateShipmentPayload(input: ShippingCreateShipmentInput) {
  const neighbourhood =
    input.receiver.neighbourhoodId != null
      ? { id: input.receiver.neighbourhoodId }
      : {
          coordinates: {
            lat: input.receiver.lat,
            lng: input.receiver.lng,
          },
        };

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
      parts: [{ weight: input.weightKg }],
      contents: input.contents,
      deliveryType: input.deliveryType,
      pickupType: resolveBabelPickupType(input.pickupType),
      cod: {
        amount: input.codAmount,
        currency: resolveBabelCodCurrency(input.currency),
      },
      payer: input.payer,
      ...(input.reference ? { reference: input.reference } : {}),
    },
  };
}

export function mapCalculatePricePayload(input: ShippingQuoteInput) {
  return {
    delivery: {
      receiver: {
        neighbourhood: {
          coordinates: {
            lat: input.receiverLat,
            lng: input.receiverLng,
          },
        },
      },
      type: input.packageType,
      parts: [{ weight: input.weightKg }],
      deliveryType: input.deliveryType,
      ...(input.pickupType ? { pickupType: input.pickupType } : {}),
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
