import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type {
  NormalizedTrackingEvent,
  NormalizedTrackingStatus,
  ShipmentTrackingResult,
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
  ShippingCredentials,
  ShippingLabelResult,
  ShippingProvider,
  ShippingProviderCapabilities,
  ShippingQuoteInput,
  ShippingQuoteResult,
  ShippingTestResult,
  UnifiedShipmentMovementEvent,
} from '../../shipping-provider.interface';
import { SILA_SY_CODE } from '../../shipping.constants';
import { registerCourierName } from '../../shipping-carrier-resolver';
import { SilaSyApiError, SilaSyHttpClient } from './sila-sy.http-client';

/** Sila-SY courier as returned by POST /cargos/quote */
type SilaCourier = {
  courier_id: string;
  name: string;
  logo?: string | null;
  delivery_fee?: number | null;
  currency?: string | null;
  estimated_days?: number | null;
  coverage_note?: string | null;
  supports_home_delivery?: boolean | null;
  supports_pickup_at_branch?: boolean | null;
};

/** Sila-SY POST /cargos/quote response */
type SilaQuoteData = {
  area_id?: string;
  currency?: string;
  weight_kg?: number;
  couriers?: SilaCourier[];
};

/** Sila-SY GET /cargos item */
type SilaCargoItem = {
  id: string;
  barcode?: string;
  awb_number?: string;
  label_url?: string;
  tracking_url?: string;
};

type SilaCargo = SilaCargoItem;

/** Sila-SY GET /cargos list response */
type SilaCargoListData = {
  data?: SilaCargoItem[];
};

/** Extract the API key from credentials. Sila uses only username (= api key). */
function apiKey(credentials: ShippingCredentials): string {
  const candidates = [credentials.username, credentials.password];
  for (const c of candidates) {
    const s = (c || '').trim();
    if (s.startsWith('sila_live_') || s.startsWith('sila_test_')) return s;
  }
  for (const c of candidates) {
    const s = (c || '').trim();
    if (s && s.toUpperCase() !== 'N/A') return s;
  }
  const key = (credentials.username || credentials.password || '').trim();
  if (!key) {
    throw new BadRequestException('Sila-SY.com API key is missing.');
  }
  return key;
}

/** Build the serviceId token for a Sila sub-carrier. */
export function buildSilaServiceId(courierId: string, areaId?: string): string {
  return areaId ? `${SILA_SY_CODE}:${courierId}:${areaId}` : `${SILA_SY_CODE}:${courierId}`;
}

/** Parse Sila serviceId token into courierId and optional areaId. */
export function parseSilaServiceInfo(
  serviceId: string,
): { courierId: string; areaId?: string } | null {
  const prefix = `${SILA_SY_CODE}:`;
  if (!serviceId || !serviceId.startsWith(prefix)) return null;
  const rest = serviceId.slice(prefix.length).trim();
  if (!rest) return null;
  const parts = rest.split(':');
  return {
    courierId: parts[0].trim(),
    areaId: parts[1]?.trim() || undefined,
  };
}

/** Extract courier_id from a Sila serviceId token. Returns null if format invalid. */
export function parseSilaServiceId(serviceId: string): string | null {
  return parseSilaServiceInfo(serviceId)?.courierId ?? null;
}

type SilaStatusMapping = {
  normalized: NormalizedTrackingStatus;
  labelAr: string;
  color: NonNullable<UnifiedShipmentMovementEvent['color']>;
  carrierReturnStage?: 'return_created' | 'returning_to_sender' | 'returned_to_sender';
};

/**
 * Map Sila cargo/shipment status strings to our normalized tracking model.
 * Kept provider-local so Babel Express mapping is untouched.
 */
function mapSilaStatus(raw: string | null | undefined): SilaStatusMapping {
  const status = (raw || '').toLowerCase().trim();
  switch (status) {
    case 'delivered':
    case 'completed':
      return { normalized: 'delivered', labelAr: 'تم تسليم الشحنة', color: 'success' };
    case 'out_for_delivery':
    case 'delivering':
      return { normalized: 'out_for_delivery', labelAr: 'الشحنة خرجت للتوصيل', color: 'info' };
    case 'return_created':
    case 'return_initiated':
    case 'return_requested':
      return {
        normalized: 'return_created',
        labelAr: 'تم إنشاء طلب إرجاع',
        color: 'warning',
        carrierReturnStage: 'return_created',
      };
    case 'returning':
    case 'returning_to_sender':
    case 'in_return':
      return {
        normalized: 'returning_to_sender',
        labelAr: 'الشحنة في طريق الإرجاع',
        color: 'warning',
        carrierReturnStage: 'returning_to_sender',
      };
    case 'returned':
    case 'returned_to_sender':
      return {
        normalized: 'returned_to_sender',
        labelAr: 'تم إرجاع الشحنة',
        color: 'warning',
        carrierReturnStage: 'returned_to_sender',
      };
    case 'failed':
    case 'undelivered':
    case 'delivery_failed':
    case 'rejected':
      return { normalized: 'delivery_failed', labelAr: 'فشل تسليم الشحنة', color: 'error' };
    case 'cancelled':
    case 'canceled':
      return { normalized: 'cancelled', labelAr: 'تم إلغاء الشحنة', color: 'error' };
    case 'processing':
    case 'pending':
    case 'created':
    case 'confirmed':
      return { normalized: 'in_transit', labelAr: 'تم تكوين الشحنة', color: 'default' };
    case 'in_transit':
    case 'received':
    case 'picked_up':
    case 'at_hub':
      return { normalized: 'in_transit', labelAr: 'الشحنة في الطريق', color: 'info' };
    default:
      return {
        normalized: 'unknown',
        labelAr: status ? `تحديث حالة الشحنة: ${status}` : 'تحديث حالة الشحنة',
        color: 'default',
      };
  }
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Sila list query `cargos?barcode=` does NOT filter — it returns the latest page.
 * The reliable lookup is `GET /cargos/{tracking_token|id}`.
 */
function cargoMatchesToken(cargo: Record<string, any> | null | undefined, token: string): boolean {
  if (!cargo || !token) return false;
  const candidates = [cargo.tracking_token, cargo.barcode, cargo.awb_number, cargo.id, cargo.code];
  return candidates.some((c) => typeof c === 'string' && c.trim() === token);
}

function extractDeliveryRoute(cargo: Record<string, any>): any[] {
  const shipment = Array.isArray(cargo.shipments) ? cargo.shipments[0] : null;
  const remote =
    shipment?.remote_last_status && typeof shipment.remote_last_status === 'object'
      ? shipment.remote_last_status
      : null;
  const route = remote?.deliveryRoute;
  return Array.isArray(route) ? route : [];
}

function buildSilaTimelineEvents(cargo: Record<string, any>): UnifiedShipmentMovementEvent[] {
  const events: UnifiedShipmentMovementEvent[] = [];
  const route = extractDeliveryRoute(cargo);

  for (const step of route) {
    if (!step || typeof step !== 'object') continue;
    const title = firstNonEmptyString(step.arabicName, step.name);
    const timestamp = toIsoOrNull(step.deliveryDate);
    if (!title || !timestamp) continue;
    const arrived = step.isArrived !== false;
    events.push({
      timestamp,
      title,
      location: null,
      color: arrived ? 'info' : 'default',
      code: typeof step.typeKey === 'string' ? step.typeKey : null,
    });
  }

  if (events.length > 0) {
    // Enrich with terminal cargo timestamps when route lacks them.
    const extras: Array<{ at: unknown; title: string; color: UnifiedShipmentMovementEvent['color']; code: string }> = [
      { at: cargo.pod_delivered_at, title: 'تم تسليم الشحنة', color: 'success', code: 'delivered' },
      { at: cargo.rejected_at, title: 'رفض استلام الشحنة', color: 'error', code: 'rejected' },
      {
        at: cargo.return_arrived_at_branch_at,
        title: 'وصلت الشحنة المرتجعة إلى الفرع',
        color: 'warning',
        code: 'return_arrived',
      },
      {
        at: cargo.return_picked_up_at,
        title: 'تم استلام الشحنة المرتجعة',
        color: 'warning',
        code: 'return_picked_up',
      },
      {
        at: cargo.merchant_collected_at,
        title: 'تم استلام المرتجع من التاجر',
        color: 'warning',
        code: 'merchant_collected',
      },
    ];
    for (const extra of extras) {
      const ts = toIsoOrNull(extra.at);
      if (!ts) continue;
      if (events.some((e) => e.timestamp === ts && e.code === extra.code)) continue;
      events.push({
        timestamp: ts,
        title: extra.title,
        location: typeof cargo.city === 'string' ? cargo.city : null,
        color: extra.color,
        code: extra.code,
      });
    }
  } else {
    // Fallback when courier does not expose deliveryRoute: synthesize from cargo timestamps.
    const fallbackSteps: Array<{
      at: unknown;
      title: string;
      color: UnifiedShipmentMovementEvent['color'];
      code: string;
    }> = [
      { at: cargo.created_at, title: 'تم تكوين الشحنة', color: 'default', code: 'created' },
      {
        at: cargo.forwarded_to_courier_at,
        title: 'تم إرسال الشحنة لشركة النقل',
        color: 'info',
        code: 'forwarded',
      },
      { at: cargo.confirmed_at, title: 'تم تأكيد الشحنة', color: 'info', code: 'confirmed' },
      { at: cargo.scanned_at, title: 'تم مسح الشحنة', color: 'info', code: 'scanned' },
      { at: cargo.pod_delivered_at, title: 'تم تسليم الشحنة', color: 'success', code: 'delivered' },
      { at: cargo.rejected_at, title: 'رفض استلام الشحنة', color: 'error', code: 'rejected' },
      {
        at: cargo.return_arrived_at_branch_at,
        title: 'وصلت الشحنة المرتجعة إلى الفرع',
        color: 'warning',
        code: 'return_arrived',
      },
      {
        at: cargo.return_picked_up_at,
        title: 'تم استلام الشحنة المرتجعة',
        color: 'warning',
        code: 'return_picked_up',
      },
      {
        at: cargo.merchant_collected_at,
        title: 'تم استلام المرتجع من التاجر',
        color: 'warning',
        code: 'merchant_collected',
      },
      { at: cargo.updated_at, title: mapSilaStatus(cargo.status).labelAr, color: mapSilaStatus(cargo.status).color, code: String(cargo.status || 'status') },
    ];

    const seen = new Set<string>();
    for (const step of fallbackSteps) {
      const ts = toIsoOrNull(step.at);
      if (!ts) continue;
      const key = `${ts}:${step.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        timestamp: ts,
        title: step.title,
        location: typeof cargo.city === 'string' ? cargo.city : null,
        color: step.color,
        code: step.code,
      });
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

function resolveCargoStatus(cargo: Record<string, any>): string {
  const shipment = Array.isArray(cargo.shipments) ? cargo.shipments[0] : null;
  const cargoStatus = typeof cargo.status === 'string' ? cargo.status.trim() : '';
  const shipmentStatus = typeof shipment?.status === 'string' ? shipment.status.trim() : '';
  const remoteRaw =
    typeof shipment?.remote_status_raw === 'string' ? shipment.remote_status_raw.trim() : '';

  // Prefer concrete cargo/shipment status over vague "processing" when nested data is richer.
  if (cargoStatus && cargoStatus.toLowerCase() !== 'processing') return cargoStatus;
  if (shipmentStatus && shipmentStatus.toLowerCase() !== 'pending') return shipmentStatus;
  if (remoteRaw) {
    const upper = remoteRaw.toUpperCase();
    if (upper.includes('DELIVERED') && !upper.includes('UNDELIVERED')) return 'delivered';
    if (upper.includes('RETURN')) return 'returned';
    if (upper.includes('CANCEL')) return 'cancelled';
    if (upper.includes('FAIL') || upper.includes('REJECT')) return 'delivery_failed';
    if (
      upper.includes('OUT_FOR_DELIVERY') ||
      upper.includes('IN_CAR') ||
      upper.includes('SCANNED_BY_DRIVER') ||
      upper.includes('WITH_DRIVER')
    ) {
      return 'out_for_delivery';
    }
    if (upper.includes('TRANSIT') || upper.includes('HUB') || upper.includes('PICK')) {
      return 'in_transit';
    }
  }
  return cargoStatus || shipmentStatus || remoteRaw || 'processing';
}

@Injectable()
export class SilaSyAdapter implements ShippingProvider {
  private readonly logger = new Logger(SilaSyAdapter.name);

  readonly code = SILA_SY_CODE;
  readonly capabilities: ShippingProviderCapabilities = {
    supportsQuote: true,
    supportsLabelPrinting: true,
    labelDelivery: 'api',
    supportsTracking: true,
    supportsWebhooks: true,
  };

  constructor(private readonly http: SilaSyHttpClient) {}

  // ─── testConnection ────────────────────────────────────────────────────────

  async testConnection(credentials: ShippingCredentials): Promise<ShippingTestResult> {
    try {
      // GET /cargos with small limit — just verifies the API key is valid.
      await this.http.get<SilaCargoListData>('cargos?limit=1', apiKey(credentials));
      return { ok: true, message: 'Sila-SY.com connection OK.' };
    } catch (err) {
      let message =
        err instanceof SilaSyApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Connection test failed.';
      if (/invalid api key|sila_live_/i.test(message)) {
        message =
          'Sila-SY.com rejected these credentials. Make sure your API key starts with "sila_live_" and was copied correctly from the Sila dashboard.';
      }
      return { ok: false, message };
    }
  }

  // ─── getServiceOptions ─────────────────────────────────────────────────────

  /**
   * Returns ALL available sub-carriers from Sila for the given destination.
   * The service layer — not this adapter — decides which to expose or how to sort.
   */
  async getServiceOptions(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]> {
    const rawGov = (input.governorate ?? '').trim();
    const rawCity = (input.city ?? '').trim();
    const rawHood = (input.neighborhood ?? '').trim();

    const province = rawGov || rawCity || rawHood;
    const district = rawHood || rawCity || province;

    if (!province) {
      // Cannot quote without at least a province or city name
      return [];
    }

    let resolvedAreaId: string | undefined;

    const fetchQuoteSingle = async (
      p: string,
      d: string,
      currency?: string,
    ): Promise<{ areaId?: string; couriers: SilaCourier[] }> => {
      try {
        const payload: Record<string, any> = {
          province: p,
          district: d,
          weight_kg: Number.isFinite(input.weightKg) && input.weightKg > 0 ? input.weightKg : 1,
        };
        if (currency) {
          payload.currency = currency;
        }
        if (input.deliveryType === 'hub') {
          payload.service_type = 'pickup_at_branch';
        }
        const quoteRes = await this.http.post<any>('cargos/quote', apiKey(credentials), payload);
        const quoteData = quoteRes?.data ?? quoteRes;
        const areaId =
          typeof quoteData?.area_id === 'string' && quoteData.area_id.trim()
            ? quoteData.area_id.trim()
            : undefined;
        const couriers = quoteData?.couriers ?? [];
        return {
          areaId,
          couriers: Array.isArray(couriers) ? couriers : [],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Sila-SY cargos/quote request for province=${p}, district=${d}, currency=${currency ?? 'default'} failed: ${msg}`,
        );
        return { couriers: [] };
      }
    };

    const fetchMergedQuotes = async (p: string, d: string): Promise<SilaCourier[]> => {
      const [usdRes, defaultRes] = await Promise.all([
        fetchQuoteSingle(p, d, 'USD'),
        fetchQuoteSingle(p, d, undefined),
      ]);

      if (usdRes.areaId) resolvedAreaId = usdRes.areaId;
      if (defaultRes.areaId && !resolvedAreaId) resolvedAreaId = defaultRes.areaId;

      const preferSyp = input.currency?.toUpperCase() === 'SYP';
      const courierMap = new Map<string, SilaCourier>();

      // Populate secondary currency first, then overwrite with preferred currency
      const secondaryList = preferSyp ? usdRes.couriers : defaultRes.couriers;
      const primaryList = preferSyp ? defaultRes.couriers : usdRes.couriers;

      for (const c of secondaryList) {
        if (c?.courier_id) courierMap.set(c.courier_id, c);
      }
      for (const c of primaryList) {
        if (c?.courier_id) courierMap.set(c.courier_id, c);
      }

      return Array.from(courierMap.values());
    };

    let couriers = await fetchMergedQuotes(province, district);
    if (couriers.length === 0 && district !== province) {
      couriers = await fetchMergedQuotes(province, province);
    }

    if (!Array.isArray(couriers) || couriers.length === 0) {
      return [];
    }

    const results: ShippingQuoteResult[] = [];
    for (const courier of couriers) {
      // Skip couriers that are unpriced or not serviced
      if (
        courier.coverage_note &&
        (courier.coverage_note.startsWith('not_') || courier.coverage_note === 'unpriced')
      ) {
        continue;
      }
      const fee = typeof courier.delivery_fee === 'number' ? courier.delivery_fee : null;
      if (fee == null || !Number.isFinite(fee)) {
        continue;
      }
      const courierId = courier.courier_id?.trim();
      if (!courierId) continue;
      if (courier.name) registerCourierName(courierId, courier.name);

      const effectiveDeliveryType: 'address' | 'hub' =
        !courier.supports_home_delivery && courier.supports_pickup_at_branch
          ? 'hub'
          : input.deliveryType === 'hub'
            ? 'hub'
            : 'address';

      results.push({
        price: fee,
        currency: (typeof courier.currency === 'string' && courier.currency.trim()) || 'USD',
        serviceId: buildSilaServiceId(courierId, resolvedAreaId),
        serviceName: courier.name ?? 'Sila carrier',
        shippable: true,
        effectiveDeliveryType,
        estimatedDeliveryMin:
          typeof courier.estimated_days === 'number' && courier.estimated_days > 1
            ? Math.max(1, courier.estimated_days - 1)
            : 2,
        estimatedDeliveryMax:
          typeof courier.estimated_days === 'number' && courier.estimated_days > 0
            ? courier.estimated_days
            : 4,
        providerName: 'Sila-SY.com',
        logoUrl:
          typeof courier.logo === 'string' && courier.logo.trim() ? courier.logo.trim() : undefined,
      });
    }
    return results;
  }

  // ─── getQuote ──────────────────────────────────────────────────────────────

  /**
   * Returns the cheapest available carrier from Sila.
   * Used by assertLiveCarrierSelection for validation — not for UI display.
   */
  async getQuote(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    const options = await this.getServiceOptions(credentials, input);
    if (options.length === 0) {
      throw new SilaSyApiError(
        'No shipping service available from Sila-SY.com for this destination / shipment configuration.',
      );
    }
    // Return cheapest
    return options.reduce((cheapest, current) =>
      current.price < cheapest.price ? current : cheapest,
    );
  }

  // ─── resolveAreaId ──────────────────────────────────────────────────────────

  /**
   * Resolves Sila-SY area_id for a given province, district/city, and neighborhood.
   * Uses GET /regions/areas?search=... first, then falls back to cargos/quote.
   */
  async resolveAreaId(
    credentials: ShippingCredentials,
    province: string,
    district: string,
    neighborhood?: string,
  ): Promise<string | null> {
    const key = apiKey(credentials);

    const terms = [
      (neighborhood ?? '').trim(),
      district.trim(),
      province.trim(),
    ].filter(Boolean);

    // 1. Try search via GET /regions/areas?search=...
    for (const term of terms) {
      try {
        const res = await this.http.get<any>(
          `regions/areas?search=${encodeURIComponent(term)}`,
          key,
        );
        const list: any[] = res?.data ?? res ?? [];
        if (Array.isArray(list) && list.length > 0) {
          // Priority 1: Exact name match within the same province
          const exactProvMatch = list.find(
            (a) =>
              (a.name_ar === term || a.name_en?.toLowerCase() === term.toLowerCase()) &&
              a.province_name &&
              (province.includes(a.province_name) || a.province_name.includes(province)),
          );
          if (exactProvMatch?.id) return String(exactProvMatch.id).trim();

          // Priority 2: Any match within the same province
          const provMatch = list.find(
            (a) =>
              a.province_name &&
              (province.includes(a.province_name) || a.province_name.includes(province)),
          );
          if (provMatch?.id) return String(provMatch.id).trim();

          // Priority 3: Exact name match
          const exactMatch = list.find(
            (a) => a.name_ar === term || a.name_en?.toLowerCase() === term.toLowerCase(),
          );
          if (exactMatch?.id) return String(exactMatch.id).trim();

          // Priority 4: First returned area
          if (list[0]?.id) return String(list[0].id).trim();
        }
      } catch (err) {
        this.logger.warn(`Sila regions/areas search for "${term}" failed: ${(err as Error)?.message}`);
      }
    }

    // 2. Try cargos/quote
    for (const d of terms) {
      try {
        const quoteRes = await this.http.post<any>('cargos/quote', key, {
          province,
          district: d,
          weight_kg: 1,
        });
        const quoteData = quoteRes?.data ?? quoteRes;
        if (quoteData?.area_id && typeof quoteData.area_id === 'string') {
          return quoteData.area_id.trim();
        }
      } catch {
        // continue
      }
    }

    return null;
  }

  // ─── createShipment ────────────────────────────────────────────────────────

  async createShipment(
    credentials: ShippingCredentials,
    input: ShippingCreateShipmentInput,
  ): Promise<ShippingCreateShipmentResult> {
    const parsed = input.serviceId ? parseSilaServiceInfo(input.serviceId) : null;
    const courierId = parsed?.courierId ?? null;
    if (!courierId) {
      throw new BadRequestException(
        `Invalid or missing Sila-SY serviceId "${input.serviceId ?? ''}". ` +
          `Expected format: "${SILA_SY_CODE}:<courier-uuid>". ` +
          `Select a Sila-SY carrier from the shipping options before sending.`,
      );
    }

    // Build phone: Sila expects full international format e.g. "+963999111222"
    const phone = input.receiver.phoneCountry && input.receiver.phoneLocal
      ? `+${input.receiver.phoneCountry.replace(/^\+/, '')}${input.receiver.phoneLocal}`
      : input.receiver.phoneLocal;

    const province =
      (input.receiver.governorate ?? '').trim() ||
      (input.receiver.city ?? '').trim() ||
      'دمشق';
    const district =
      (input.receiver.neighborhood ?? '').trim() ||
      (input.receiver.city ?? '').trim() ||
      province;

    const addressLine =
      input.receiver.address?.trim() || `${province} - ${district}`;

    let areaId = parsed?.areaId;
    if (!areaId) {
      areaId = (await this.resolveAreaId(
        credentials,
        province,
        district,
        input.receiver.neighborhood,
      )) ?? undefined;
    }

    const pickup = input.pickup;
    const pickupPhone =
      pickup?.phoneCountry && pickup.phoneLocal
        ? `+${pickup.phoneCountry.replace(/^\+/, '')}${pickup.phoneLocal}`
        : pickup?.phoneLocal;
    const pickupProvince =
      (pickup?.governorate ?? '').trim() || (pickup?.city ?? '').trim() || '';
    const pickupDistrict =
      (pickup?.neighborhood ?? '').trim() || (pickup?.city ?? '').trim() || pickupProvince;
    const pickupAddress = pickup?.address?.trim() || '';

    const body: Record<string, unknown> = {
      recipient: {
        full_name: input.receiver.name,
        phone,
        province,
        district,
        address_line: addressLine,
        ...(areaId ? { area_id: areaId } : {}),
      },
      ...(input.pickupType !== 'hub' && pickup && pickupAddress
        ? {
            sender: {
              full_name: pickup.name,
              ...(pickupPhone ? { phone: pickupPhone } : {}),
              ...(pickupProvince ? { province: pickupProvince } : {}),
              ...(pickupDistrict ? { district: pickupDistrict } : {}),
              address_line: pickupAddress,
            },
          }
        : {}),
      parcel: {
        weight_kg: input.weightKg > 0 ? input.weightKg : 1,
        pieces_count: input.parts?.length ?? 1,
        length_cm: 10,
        width_cm: 10,
        height_cm: 10,
        description: input.contents || 'Goods',
      },
      courier_id: courierId,
      pay_on_delivery: {
        amount: Math.max(1, input.codAmount > 0 ? input.codAmount : 1),
        currency: (input.currency ?? 'USD').toUpperCase(),
      },
      // Who pays shipping: sender (merchant) vs receiver. Sila cargo field is shipping_paid_by.
      shipping_paid_by: input.payer === 'receiver' ? 'receiver' : 'sender',
      merchant_pays_shipping: input.payer !== 'receiver',
      ...(input.reference ? { reference: input.reference } : {}),
    };

    let raw: any;
    try {
      raw = await this.http.post<any>('cargos', apiKey(credentials), body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/reference already used/i.test(msg) && input.reference) {
        this.logger.warn(`Sila reference "${input.reference}" already used. Retrying with unique timestamp suffix.`);
        body.reference = `${input.reference}-${Date.now().toString().slice(-6)}`;
        raw = await this.http.post<any>('cargos', apiKey(credentials), body);
      } else {
        throw err;
      }
    }

    const rawData = raw?.data ?? raw;
    // Platform/provider id (Sila barcode) — used for label/API lookups.
    const barcode =
      (typeof rawData?.barcode === 'string' && rawData.barcode.trim()) ||
      (typeof rawData?.awb_number === 'string' && rawData.awb_number.trim()) ||
      (typeof rawData?.code === 'string' && rawData.code.trim()) ||
      (typeof rawData?.id === 'string' && rawData.id.trim()) ||
      (typeof raw?.barcode === 'string' && raw.barcode.trim()) ||
      '';
    // Courier-facing tracking when Sila returns a distinct token/number.
    const courierTracking =
      (typeof rawData?.tracking_token === 'string' && rawData.tracking_token.trim()) ||
      (typeof rawData?.tracking_number === 'string' && rawData.tracking_number.trim()) ||
      (typeof rawData?.courier_tracking === 'string' && rawData.courier_tracking.trim()) ||
      (typeof rawData?.courier_barcode === 'string' && rawData.courier_barcode.trim()) ||
      '';
    if (!barcode) {
      throw new SilaSyApiError('Sila-SY createShipment succeeded without a provider reference.', undefined, raw);
    }
    if (!courierTracking || courierTracking === barcode) {
      throw new SilaSyApiError(
        'Sila-SY did not return the actual courier tracking number. The Sila reference is not a tracking number.',
        undefined,
        raw,
      );
    }

    return { awb: barcode, trackingNumber: courierTracking, raw };
  }

  // ─── getLabel ──────────────────────────────────────────────────────────────

  /**
   * Retrieves the label URL for a shipment by tracking token / cargo id.
   * IMPORTANT: Do not use `cargos?barcode=` — Sila ignores that filter and returns
   * the latest cargo page, which caused cross-shipment mix-ups.
   */
  async getLabel(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShippingLabelResult | null> {
    const trimmed = awb.trim();
    if (!trimmed) return null;

    try {
      const cargo = await this.fetchCargo(credentials, trimmed);
      const labelUrl = firstNonEmptyString(cargo?.label_url, cargo?.labelUrl);
      if (labelUrl) {
        return { url: labelUrl };
      }
    } catch {
      // Label not retrievable — return null, do not throw
    }
    return null;
  }

  // ─── Tracking & Webhooks ───────────────────────────────────────────────────

  /**
   * Fetch a single Sila cargo by tracking_token or id.
   * Uses GET /cargos/{token} — the only reliable lookup we validated against live API.
   */
  private async fetchCargo(
    credentials: ShippingCredentials,
    token: string,
  ): Promise<Record<string, any> | null> {
    const trimmed = token.trim();
    if (!trimmed) return null;

    const data = await this.http.get<any>(
      `cargos/${encodeURIComponent(trimmed)}`,
      apiKey(credentials),
    );
    const cargo = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    if (!cargo || !cargoMatchesToken(cargo, trimmed)) {
      return null;
    }
    return cargo;
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    _body: unknown,
    secret?: string,
  ): boolean {
    if (!secret || !secret.trim()) return true;
    const headerSecret =
      headers['x-webhook-secret'] ||
      headers['x-api-key'] ||
      (typeof headers.authorization === 'string' && headers.authorization.replace(/^Bearer\s+/i, ''));
    return headerSecret === secret.trim();
  }

  normalizeWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): NormalizedTrackingEvent | null {
    if (!body || typeof body !== 'object') return null;
    const b = body as Record<string, any>;
    // Sila webhooks commonly send tracking_token (not barcode/awb).
    const awb = firstNonEmptyString(
      b.tracking_token,
      b.barcode,
      b.awb,
      b.tracking_number,
      b.id,
    );
    const rawStatus = typeof b.status === 'string' ? b.status.trim().toLowerCase() : '';
    if (!awb && !rawStatus) return null;

    const mapped = mapSilaStatus(rawStatus);
    const returnReason =
      firstNonEmptyString(
        b.return_reason,
        b.rejection_reason,
        b.failed_reason,
        b.reason,
        b.note,
        b.notes,
      ) || undefined;

    return {
      providerCode: this.code,
      externalEventId: `${awb}:${rawStatus}:${b.updated_at || Date.now()}`,
      awb,
      eventType: rawStatus || 'WEBHOOK',
      normalizedStatus: mapped.normalized,
      returnReason,
      originalCarrierStatus: String(b.status || rawStatus || 'WEBHOOK'),
      carrierReturnStage: mapped.carrierReturnStage,
      timestamp: b.updated_at ? new Date(b.updated_at) : new Date(),
      rawPayload: b,
    };
  }

  async pollTracking(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<NormalizedTrackingEvent | null> {
    const trimmed = awb.trim();
    if (!trimmed) return null;

    try {
      const cargo = await this.fetchCargo(credentials, trimmed);
      if (!cargo) return null;

      const rawStatus = resolveCargoStatus(cargo);
      const mapped = mapSilaStatus(rawStatus);
      const returnReason =
        firstNonEmptyString(
          cargo.return_reason,
          cargo.rejection_reason,
          cargo.failed_reason,
          cargo.reason,
          cargo.note,
        ) || undefined;

      const updatedAt = cargo.updated_at ? new Date(cargo.updated_at) : new Date();
      const cargoToken = firstNonEmptyString(cargo.tracking_token, cargo.barcode, cargo.id) || trimmed;

      return {
        providerCode: this.code,
        externalEventId: `${cargoToken}:${rawStatus}:${cargo.updated_at || Date.now()}`,
        awb: cargoToken,
        eventType: rawStatus || 'CARGO_STATUS',
        normalizedStatus: mapped.normalized,
        returnReason,
        originalCarrierStatus: String(cargo.status || rawStatus || 'CARGO_STATUS'),
        carrierReturnStage: mapped.carrierReturnStage,
        timestamp: updatedAt,
        rawPayload: cargo,
      };
    } catch {
      return null;
    }
  }

  async getTrackingHistory(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShipmentTrackingResult | null> {
    const trimmed = awb.trim();
    if (!trimmed) return null;

    try {
      const cargo = await this.fetchCargo(credentials, trimmed);
      if (!cargo) {
        return {
          providerCode: this.code,
          providerName: 'Sila-SY',
          awb: trimmed,
          events: [],
          message: 'لا توجد بيانات لحركة الشحنة من شركة الشحن.',
        };
      }

      const rawStatus = resolveCargoStatus(cargo);
      const mapped = mapSilaStatus(rawStatus);
      const events = buildSilaTimelineEvents(cargo);
      const cargoToken = firstNonEmptyString(cargo.tracking_token, cargo.barcode, cargo.id) || trimmed;

      return {
        providerCode: this.code,
        providerName: 'Sila-SY',
        awb: cargoToken,
        isDelivered: mapped.normalized === 'delivered',
        statusLabel: mapped.labelAr,
        statusColor: mapped.color,
        events,
      };
    } catch (err: any) {
      return {
        providerCode: this.code,
        providerName: 'Sila-SY',
        awb: trimmed,
        events: [],
        error: err?.message || 'Failed to query Sila-SY tracking API.',
      };
    }
  }
}
