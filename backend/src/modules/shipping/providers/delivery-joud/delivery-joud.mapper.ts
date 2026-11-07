import type {
  NormalizedTrackingStatus,
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
} from '../../shipping-provider.interface';
import { normalizeArabicCompare } from '../../../../common/utils/arabic-text-normalize';
import { DELIVERY_JOUD_CODE } from './delivery-joud.constants';
import type { JoudArea, JoudCreateOrderParams, JoudOrder } from './delivery-joud.types';

export function parseJoudAreaFromServiceId(serviceId?: string | null): string | null {
  if (!serviceId) return null;
  const prefix = `${DELIVERY_JOUD_CODE}:`;
  const normalized = serviceId.trim();
  if (normalized.toUpperCase().startsWith(prefix)) {
    const rest = normalized.slice(prefix.length).trim();
    return rest || null;
  }
  return null;
}

export function joudAreaName(area: JoudArea): string {
  return String(area.name || area.area_name || '').trim();
}

export function joudAreaFee(area: JoudArea): number | null {
  const raw = area.delivery_fee ?? area.price;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function matchJoudArea(
  areas: JoudArea[],
  destination: {
    city?: string | null;
    governorate?: string | null;
    neighborhood?: string | null;
    address?: string | null;
    serviceArea?: string | null;
  },
): JoudArea | null {
  if (!areas?.length) return null;

  if (destination.serviceArea) {
    const token = destination.serviceArea.trim();
    const byId = areas.find((a) => String(a.id ?? '') === token);
    if (byId) return byId;
    const folded = normalizeArabicCompare(token);
    const byName = areas.find((a) => normalizeArabicCompare(joudAreaName(a)) === folded);
    if (byName) return byName;
  }

  const terms = [destination.city, destination.neighborhood, destination.governorate, destination.address]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => normalizeArabicCompare(s));

  for (const term of terms) {
    if (!term) continue;
    const match = areas.find((a) => {
      const name = normalizeArabicCompare(joudAreaName(a));
      return name && (name.includes(term) || term.includes(name));
    });
    if (match) return match;
  }

  return areas.length === 1 ? areas[0] : null;
}

export function formatPhoneForJoud(
  country: string | null | undefined,
  local: string | null | undefined,
): string {
  const localDigits = (local || '').replace(/\D/g, '');
  if (localDigits.startsWith('0') && localDigits.length >= 9) return localDigits;
  const countryDigits = (country || '').replace(/\D/g, '');
  if (countryDigits === '963' && localDigits) {
    return `0${localDigits.replace(/^0+/, '')}`;
  }
  const combined = `${countryDigits}${localDigits}`.replace(/\D/g, '');
  if (combined.startsWith('963') && combined.length >= 12) {
    return `0${combined.slice(3)}`;
  }
  return localDigits || combined;
}

export function mapCreateOrderParams(
  input: ShippingCreateShipmentInput,
  areaName: string,
  orderTypeId: string | number = '1',
): Omit<JoudCreateOrderParams, 'login' | 'password' | 'db'> {
  const codAmount =
    input.codAmount && Number.isFinite(Number(input.codAmount)) ? Number(input.codAmount) : 0;
  const feeOnCustomer = input.payer === 'receiver';
  return {
    customer_name: input.receiver.name.trim(),
    customer_mobile: formatPhoneForJoud(input.receiver.phoneCountry, input.receiver.phoneLocal),
    customer_address: input.receiver.address.trim(),
    customer_area: areaName,
    reference_id: input.reference?.trim() || '',
    cost: codAmount,
    order_type_id: orderTypeId,
    note: input.contents?.trim() || undefined,
    paid: codAmount <= 0,
    delivery_fee_on_customer: feeOnCustomer,
    delivery_fee_on_sender: !feeOnCustomer,
    product_note: input.contents?.trim() || undefined,
  };
}

/** Prefer the portal sequence/barcode (e.g. 3960023548), never an OMS reference when a better id exists. */
export function pickJoudPortalBarcode(order: JoudOrder): string {
  const candidates = [
    order.barcode,
    order.tracking_number,
    order.tracking,
    (order as { barcode_number?: unknown }).barcode_number,
    (order as { sequence?: unknown }).sequence,
    order.name,
  ];
  const texts = candidates.map((c) => String(c ?? '').trim()).filter(Boolean);
  const numeric = texts.find((v) => /^\d{6,}$/.test(v));
  if (numeric) return numeric;
  const nonOms = texts.find((v) => !/^OMS-/i.test(v));
  return nonOms || texts[0] || '';
}

export function mapJoudOrderToResult(order: JoudOrder | null | undefined): ShippingCreateShipmentResult {
  if (!order || typeof order !== 'object') {
    return { awb: '', raw: order };
  }
  const barcode = pickJoudPortalBarcode(order);
  const id = order.id != null ? String(order.id) : '';
  const awb = barcode || id;
  return {
    awb,
    trackingNumber: barcode || undefined,
    raw: order,
  };
}

export function mapJoudStatusToNormalized(status?: string | null): NormalizedTrackingStatus {
  const s = normalizeArabicCompare(status || '');
  if (!s) return 'unknown';
  if (/cancel|ملغ|الغاء|إلغاء/.test(s)) return 'cancelled';
  if (/deliver|تم التسليم|مسلّم|مسلم/.test(s) && !/fail|فشل|attempt/.test(s)) return 'delivered';
  if (/out.?for|مع المندوب|للتوصيل/.test(s)) return 'out_for_delivery';
  if (/return|مرتجع|راجع/.test(s)) return 'returning_to_sender';
  if (/fail|رفض|تعذر|failed/.test(s)) return 'delivery_failed';
  if (/transit|ship|قيد|شحن|collected|pickup|استلام/.test(s)) return 'in_transit';
  return 'unknown';
}

/** Unwrap common Olivery list shapes. */
export function unwrapJoudList<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    for (const key of ['areas', 'data', 'result', 'records', 'items', 'order_types', 'statuses']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export function unwrapJoudOrder(result: unknown): JoudOrder | null {
  if (!result) return null;
  if (typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    if (obj.order && typeof obj.order === 'object') return obj.order as JoudOrder;
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) return obj.data as JoudOrder;
    return obj as JoudOrder;
  }
  if (Array.isArray(result) && result[0] && typeof result[0] === 'object') {
    return result[0] as JoudOrder;
  }
  return null;
}
