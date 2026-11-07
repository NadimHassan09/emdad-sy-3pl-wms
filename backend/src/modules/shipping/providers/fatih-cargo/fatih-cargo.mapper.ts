import { wireCurrencyCode } from '../../../../common/money/currency';
import { normalizeArabicCompare } from '../../../../common/utils/arabic-text-normalize';
import type {
  NormalizedTrackingStatus,
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
} from '../../shipping-provider.interface';
import { FATIH_CARGO_CODE } from './fatih-cargo.constants';
import type {
  FatihCity,
  FatihCreateShipmentPayload,
  FatihPackageType,
  FatihShipment,
  FatihSizeCategory,
  FatihWeightCategory,
} from './fatih-cargo.types';

export function parseFatihCityIdFromServiceId(serviceId?: string | null): number | null {
  if (!serviceId) return null;
  const prefix = `${FATIH_CARGO_CODE}:`;
  const normalized = serviceId.trim();
  if (normalized.toUpperCase().startsWith(prefix)) {
    const rest = normalized.slice(prefix.length).trim();
    const id = Number(rest);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

export function matchFatihCity(
  cities: FatihCity[],
  destination: {
    city?: string | null;
    governorate?: string | null;
    neighborhood?: string | null;
    address?: string | null;
  },
): FatihCity | null {
  if (!cities?.length) return null;

  const terms = [destination.city, destination.neighborhood, destination.governorate, destination.address]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => normalizeArabicCompare(s));

  for (const term of terms) {
    if (!term) continue;
    const match = cities.find((c) => {
      const name = normalizeArabicCompare(c.name || '');
      const gov = normalizeArabicCompare(c.governorate?.name || '');
      return (
        (name && (name.includes(term) || term.includes(name))) ||
        (gov && (gov.includes(term) || term.includes(gov)))
      );
    });
    if (match) return match;
  }

  return cities.length === 1 ? cities[0] : null;
}

export function formatPhoneForFatih(
  country: string | null | undefined,
  local: string | null | undefined,
): string {
  const digits = `${(country || '').replace(/\D/g, '')}${(local || '').replace(/\D/g, '')}`;
  const localOnly = (local || '').replace(/\D/g, '');
  if (localOnly.startsWith('09') && localOnly.length >= 10) return localOnly;
  if (digits.startsWith('963') && digits.length >= 12) {
    return `0${digits.slice(3)}`;
  }
  return localOnly || digits;
}

export function pickFatihWeightCategory(
  categories: FatihWeightCategory[],
  weightKg: number,
): FatihWeightCategory | null {
  if (!categories?.length) return null;
  const w = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 1;
  const withMax = categories
    .filter((c) => c.max_weight_kg != null && Number.isFinite(Number(c.max_weight_kg)))
    .sort((a, b) => Number(a.max_weight_kg) - Number(b.max_weight_kg));
  for (const c of withMax) {
    if (w <= Number(c.max_weight_kg)) return c;
  }
  if (withMax.length) return withMax[withMax.length - 1];
  return categories.find((c) => (c.fee_effect || 'none') === 'none') || categories[0];
}

export function pickFatihSizeCategory(categories: FatihSizeCategory[]): FatihSizeCategory | null {
  if (!categories?.length) return null;
  return categories.find((c) => (c.fee_effect || 'none') === 'none') || categories[0];
}

export function pickFatihPackageType(
  types: FatihPackageType[],
  packageType: 'box' | 'envelope',
): FatihPackageType | null {
  if (!types?.length) return null;
  const folded = types.map((t) => ({ t, n: normalizeArabicCompare(t.name || '') }));
  if (packageType === 'envelope') {
    const env = folded.find((x) => /ظرف|مظروف|envelope|document|مستند/.test(x.n));
    if (env) return env.t;
  }
  const box = folded.find((x) => /طرد|صندوق|parcel|box|package/.test(x.n));
  return box?.t || types[0];
}

export function mapCreateShipmentPayload(
  input: ShippingCreateShipmentInput,
  cityId: number,
  packageTypeId: number,
  weightCategoryId: number,
  sizeCategoryId: number,
): FatihCreateShipmentPayload {
  const codAmount =
    input.codAmount && Number.isFinite(Number(input.codAmount)) ? Number(input.codAmount) : 0;
  const currency = wireCurrencyCode(input.currency || 'USD');
  const phone = formatPhoneForFatih(input.receiver.phoneCountry, input.receiver.phoneLocal);
  const paidBy: 'sender' | 'recipient' =
    input.payer === 'receiver' ? 'recipient' : 'sender';

  const payload: FatihCreateShipmentPayload = {
    reference: input.reference?.trim() || undefined,
    recipient: {
      name: input.receiver.name.trim(),
      phone,
      city_id: cityId,
      address: input.receiver.address.trim(),
      pickup_at_branch: input.deliveryType === 'hub',
    },
    package: {
      type_id: packageTypeId,
      weight_category_id: weightCategoryId,
      size_category_id: sizeCategoryId,
      count: Array.isArray(input.parts) && input.parts.length > 1 ? input.parts.length : 1,
    },
    shipping_fee_paid_by: paidBy,
    notes: input.contents?.trim() || undefined,
  };

  if (codAmount > 0) {
    payload.cod = { amount: codAmount, currency };
    payload.package.declared_value = { amount: codAmount, currency };
  }

  return payload;
}

export function mapFatihShipmentToResult(shipment: FatihShipment): ShippingCreateShipmentResult {
  const tracking = (shipment.tracking_number || '').trim();
  const id = shipment.id != null ? String(shipment.id) : '';
  return {
    awb: tracking || id,
    trackingNumber: tracking || undefined,
    raw: shipment,
  };
}

export function mapFatihStatusToNormalized(status?: string | null): NormalizedTrackingStatus {
  const s = (status || '').trim().toLowerCase();
  switch (s) {
    case 'pending':
    case 'picked_up':
    case 'in_transit':
      return 'in_transit';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    case 'delivery_failed':
    case 'failed':
      return 'delivery_failed';
    case 'returning':
    case 'return_in_progress':
      return 'returning_to_sender';
    case 'returned':
      return 'returned_to_sender';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    default:
      return 'unknown';
  }
}
