import { isSyrianPound } from '../../../../common/money/currency';
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
  ShippingCancelResult,
  UnifiedShipmentMovementEvent,
} from '../../shipping-provider.interface';
import { SILA_SY_CODE } from '../../shipping.constants';
import { registerCourierName } from '../../shipping-carrier-resolver';
import {
  pickSilaChildArea,
  walkSilaAreaHierarchy,
  type SilaAreaHints,
  type SilaAreaRow,
} from './sila-area.util';
import { pickNearestSilaBranch, resolveSilaHubOptions } from './sila-branch.util';
import { logSanitizedProviderRequest, sanitizeSilaCargoBody } from '../../provider-request-log';
import {
  extractSilaCarrierAwb,
  extractSilaProviderId,
} from './sila-identifiers';
import {
  buildSilaNormalizedEvent,
  headerValue,
  isSilaWebhookTest,
  verifySilaSignature,
} from './sila-webhook.util';
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
  requires_branch?: boolean | null;
  branches?: Array<{ id?: string; name?: string }>;
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

function isSilaProvinceAreaError(message: string): boolean {
  return /whole province|parent_id|محافظة كاملة/i.test(message);
}

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
export function mapSilaStatus(raw: string | null | undefined): SilaStatusMapping {
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
    case 'postponed':
    case 'postponed_delivery':
      // A postponement is a movement note. It must not move the OMS order.
      return { normalized: 'unknown', labelAr: 'تم تأجيل التسليم', color: 'warning' };
    case 'in_transit_intercity':
      return { normalized: 'in_transit', labelAr: 'الشحنة في الطريق بين المدن', color: 'info' };
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
        normalized: 'in_transit',
        labelAr: status ? `تحديث حالة الشحنة: ${status}` : 'الشحنة في الطريق',
        color: 'info',
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

function silaCargoRows(data: unknown): Record<string, any>[] {
  if (Array.isArray(data)) {
    return data.filter((row) => row && typeof row === 'object');
  }
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  for (const key of ['items', 'cargos', 'data', 'results']) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((row) => row && typeof row === 'object');
    }
  }
  if (typeof record.id === 'string' || typeof record.barcode === 'string') {
    return [record];
  }
  return [];
}

function silaCourierDisplayName(tracking: Record<string, any> | null, cargo: Record<string, any> | null): string {
  const fromTracking = tracking?.courier;
  const fromCargo = cargo?.courier;
  const name =
    firstNonEmptyString(
      typeof fromTracking === 'object' ? fromTracking?.name : fromTracking,
      typeof fromCargo === 'object' ? fromCargo?.name : fromCargo,
    ) || '';
  return name || 'Sila-SY';
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

/** Courier raw codes that are more specific than Sila's lifecycle label. */
const SILA_REMOTE_STATUS_AR: Record<string, string> = {
  SCANNED_BY_DRIVER_AND_IN_CAR: 'تم مسح الشحنة وهي مع السائق في المركبة',
  SCANNED_BY_HANDLER_AND_UNLOADED: 'تم مسح الشحنة وتفريغها في المركز',
  PENDING_CUSTOMER_CARE_APPROVAL: 'بانتظار موافقة خدمة العملاء',
  APPROVED_BY_CUSTOMER_CARE_AND_WAITING_FOR_DISPATCHER: 'تمت الموافقة وبانتظار التوزيع',
  POSTPONED_DELIVERY: 'تم تأجيل التسليم',
  DELIVERED_TO_RECIPIENT: 'تم التسليم للمستلم',
  RETURNED_BY_RECIPIENT: 'أعاد المستلم الشحنة',
  DELIVERED_TO_SENDER: 'تم تسليم الشحنة للمرسل',
};

const SILA_TIMELINE_SOURCE_NOTES = new Set(['courier', 'system', 'admin']);

function hasArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function silaEventTitle(
  status: string,
  labelAr?: string | null,
  labelEn?: string | null,
): string {
  const ar = (labelAr || '').trim();
  if (ar && hasArabic(ar)) return ar;
  const en = (labelEn || '').trim();
  if (en) return en;
  return mapSilaStatus(status).labelAr;
}

function firstShipment(cargo: Record<string, any> | null | undefined): Record<string, any> | null {
  const shipment = Array.isArray(cargo?.shipments) ? cargo.shipments[0] : null;
  return shipment && typeof shipment === 'object' ? shipment : null;
}

type SilaTrackingTimelineItem = {
  status?: string;
  label_ar?: string;
  label_en?: string;
  timestamp?: string;
  note?: string | null;
};

function eventIdentity(event: UnifiedShipmentMovementEvent): string {
  return `${event.timestamp}|${event.code || ''}|${event.title}`;
}

function pushUnique(
  events: UnifiedShipmentMovementEvent[],
  event: UnifiedShipmentMovementEvent | null,
): void {
  if (!event?.title || !event.timestamp) return;
  const key = eventIdentity(event);
  if (events.some((existing) => eventIdentity(existing) === key)) return;
  events.push(event);
}

function timelineItemToEvent(item: SilaTrackingTimelineItem): UnifiedShipmentMovementEvent | null {
  const status = typeof item.status === 'string' ? item.status.trim() : '';
  const timestamp = toIsoOrNull(item.timestamp);
  if (!status || !timestamp) return null;
  const mapped = mapSilaStatus(status);
  const rawNote = typeof item.note === 'string' ? item.note.trim() : '';
  const notes =
    rawNote && !SILA_TIMELINE_SOURCE_NOTES.has(rawNote.toLowerCase()) ? rawNote : null;
  const originalDescription = item.label_ar || item.label_en || null;
  return {
    timestamp,
    title: silaEventTitle(status, item.label_ar, item.label_en),
    originalDescription,
    location: null,
    notes,
    color: mapped.color,
    code: status,
    source: 'carrier',
  };
}

/**
 * Current-state detail from the cargo (postpone reason, courier raw status).
 * Sila keeps this on the shipment, not as extra timeline rows.
 */
function attachNoteToMatching(
  events: UnifiedShipmentMovementEvent[],
  codes: string[],
  text: string | null,
): void {
  if (!text) return;
  const idx = events.findIndex((event) => codes.includes((event.code || '').toLowerCase()));
  if (idx < 0) return;
  const current = events[idx];
  const merged = [current.notes, text].filter((part): part is string => Boolean(part && part.trim()));
  const unique = [...new Set(merged)];
  events[idx] = { ...current, notes: unique.length ? unique.join(' — ') : null };
}

function attachSilaCurrentDetail(
  events: UnifiedShipmentMovementEvent[],
  cargo: Record<string, any> | null,
): void {
  if (!events.length || !cargo) return;
  const shipment = firstShipment(cargo);
  attachNoteToMatching(
    events,
    ['failed', 'undelivered', 'delivery_failed', 'rejected'],
    firstNonEmptyString(shipment?.remote_failure_notes) || null,
  );
  const postponedDate = firstNonEmptyString(shipment?.remote_postponed_date);
  attachNoteToMatching(
    events,
    ['postponed', 'postponed_delivery'],
    postponedDate ? `الموعد المؤجل: ${postponedDate}` : firstNonEmptyString(shipment?.remote_failure_notes) || null,
  );
  attachNoteToMatching(
    events,
    ['returned', 'returned_to_sender'],
    firstNonEmptyString(cargo.return_reason, cargo.rejection_reason) || null,
  );
  const raw = typeof shipment?.remote_status_raw === 'string' ? shipment.remote_status_raw.trim() : '';
  const gloss = SILA_REMOTE_STATUS_AR[raw];
  if (gloss) {
    const target =
      events.find((event) => event.title === gloss) ??
      events[0];
    if (target && target.title !== gloss && !target.title.includes(gloss)) {
      const merged = [target.notes, gloss].filter((part): part is string => Boolean(part && part.trim()));
      target.notes = [...new Set(merged)].join(' — ') || null;
    }
  }
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
      originalDescription: title,
      location: null,
      color: arrived ? 'info' : 'default',
      code: typeof step.typeKey === 'string' ? step.typeKey : null,
      source: 'carrier',
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
        originalDescription: extra.title,
        location: typeof cargo.city === 'string' ? cargo.city : null,
        color: extra.color,
        code: extra.code,
        source: 'carrier',
      });
    }
  } else {
    // DO NOT invent synthetic intermediate events when no timeline exists.
    // Return only the current status event if present.
    const rawStatus = resolveCargoStatus(cargo);
    const ts = toIsoOrNull(cargo.updated_at) || toIsoOrNull(cargo.created_at);
    if (ts && rawStatus) {
      const mapped = mapSilaStatus(rawStatus);
      events.push({
        timestamp: ts,
        title: mapped.labelAr,
        originalDescription: rawStatus,
        location: typeof cargo.city === 'string' ? cargo.city : null,
        color: mapped.color,
        code: rawStatus,
        source: 'carrier',
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
    // Sila areas are city/region rows (e.g. مدينة حمص). The neighbourhood
    // (الأرمن) is an address detail and is rejected as "does not serve this area".
    const district = rawCity || rawHood || province;

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

      const preferSyp = isSyrianPound(input.currency);
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

    if (resolvedAreaId) {
      resolvedAreaId = await this.narrowProvinceArea(credentials, resolvedAreaId, {
        province,
        city: rawCity,
        district,
        neighborhood: rawHood,
      });
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
      if (input.deliveryType === 'address' && courier.supports_home_delivery === false) continue;
      if (
        input.deliveryType === 'hub' &&
        courier.supports_pickup_at_branch === false &&
        courier.requires_branch !== true
      ) {
        continue;
      }
      if (courier.name) registerCourierName(courierId, courier.name);

      const effectiveDeliveryType: 'address' | 'hub' =
        !courier.supports_home_delivery && courier.supports_pickup_at_branch
          ? 'hub'
          : input.deliveryType === 'hub'
            ? 'hub'
            : 'address';

      const hubResolution =
        effectiveDeliveryType === 'hub'
          ? resolveSilaHubOptions(
              (courier.branches ?? [])
                .map((branch) => ({
                  id: branch.id?.trim() || '',
                  name: branch.name?.trim() || '',
                }))
                .filter((branch) => branch.id && branch.name),
              {
                governorate: rawGov || province,
                neighborhood: rawHood || rawCity || district,
                lat: input.receiverLat,
                lng: input.receiverLng,
              },
            )
          : { hubs: [], nearestId: null, nearestDetermined: false };

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
        ...(effectiveDeliveryType === 'hub' && hubResolution.hubs.length > 0
          ? {
              hubs: hubResolution.hubs,
              nearestHubId: hubResolution.nearestId,
              nearestHubDetermined: hubResolution.nearestDetermined,
            }
          : {}),
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

  /**
   * Quote area ids are often the province. Couriers require a city or neighbourhood
   * from GET /regions/areas?parent_id=<province>.
   */
  private async narrowProvinceArea(
    credentials: ShippingCredentials,
    areaId: string,
    hints: SilaAreaHints,
    strict = false,
  ): Promise<string> {
    const key = apiKey(credentials);
    let level = '';
    try {
      const area = await this.http.get<SilaAreaRow>(
        `regions/areas/${encodeURIComponent(areaId)}`,
        key,
      );
      level = typeof area?.level === 'string' ? area.level : '';
    } catch {
      level = '';
    }
    const fetchChildren = (parentId: string) => this.listChildAreas(credentials, parentId);
    let walked = await walkSilaAreaHierarchy(areaId, level || null, hints, fetchChildren);
    if (!('areaId' in walked) && level.toLowerCase() === 'province') {
      const pool = await this.searchHintAreas(credentials, hints);
      const picked = pickSilaChildArea(pool, hints);
      if (picked?.id) {
        const deeper = await walkSilaAreaHierarchy(
          picked.id,
          picked.level ?? null,
          hints,
          fetchChildren,
          picked.name_ar || picked.name_en,
        );
        walked = 'areaId' in deeper ? deeper : { areaId: picked.id };
      }
    }
    if ('areaId' in walked) return walked.areaId;
    if (!strict || level.toLowerCase() !== 'province') return areaId;
    throw new BadRequestException(
      `Sila area is a whole province. Missing ${walked.missingLevel}. Set the receiver ${walked.missingLevel} so a child area can be selected.`,
    );
  }

  private async listChildAreas(
    credentials: ShippingCredentials,
    areaId: string,
  ): Promise<SilaAreaRow[]> {
    const raw = await this.http.get<SilaAreaRow[] | { data?: SilaAreaRow[] }>(
      `regions/areas?parent_id=${encodeURIComponent(areaId)}`,
      apiKey(credentials),
    );
    return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  }

  /** Province rows on Sila often have no parent_id children. Search finds the city. */
  private async searchHintAreas(
    credentials: ShippingCredentials,
    hints: SilaAreaHints,
  ): Promise<SilaAreaRow[]> {
    const terms = [hints.neighborhood, hints.city, hints.district]
      .flatMap((value) => (value ? value.split(/\s*[-–—]\s*/) : []))
      .map((value) => value.trim())
      .filter((value) => value.length >= 2);
    const unique = [...new Set(terms)];
    const pool: SilaAreaRow[] = [];
    for (const term of unique.slice(0, 6)) {
      try {
        const raw = await this.http.get<SilaAreaRow[] | { data?: SilaAreaRow[] }>(
          `regions/areas?search=${encodeURIComponent(term)}`,
          apiKey(credentials),
        );
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        pool.push(...list);
      } catch {
        /* search is best-effort; the caller still stops if nothing matches */
      }
    }
    return pool;
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
          const specific = list.filter((a) => a?.level !== 'province');
          const pool = specific.length > 0 ? specific : [];
          if (pool.length === 0) continue;
          list.splice(0, list.length, ...pool);
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
      (input.receiver.city ?? '').trim() ||
      (input.receiver.neighborhood ?? '').trim() ||
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
    const areaHints: SilaAreaHints = {
      province,
      city: input.receiver.city,
      district,
      neighborhood: input.receiver.neighborhood,
    };
    if (areaId) {
      areaId = await this.narrowProvinceArea(credentials, areaId, areaHints, true);
    }

    const pickup = input.pickup;
    const pickupPhone =
      pickup?.phoneCountry && pickup.phoneLocal
        ? `+${pickup.phoneCountry.replace(/^\+/, '')}${pickup.phoneLocal}`
        : pickup?.phoneLocal;
    const pickupProvince =
      (pickup?.governorate ?? '').trim() || (pickup?.city ?? '').trim() || '';
    const pickupDistrict =
      (pickup?.city ?? '').trim() || (pickup?.neighborhood ?? '').trim() || pickupProvince;
    const pickupAddress = pickup?.address?.trim() || '';

    const quotedCourier = await this.lookupQuotedCourier(
      credentials,
      courierId,
      province,
      district,
      (input.currency ?? 'USD').trim().toUpperCase(),
    );
    const hubResolution = resolveSilaHubOptions(
      (quotedCourier?.branches ?? [])
        .map((branch) => ({
          id: branch.id?.trim() || '',
          name: branch.name?.trim() || '',
        }))
        .filter((branch) => branch.id && branch.name),
      {
        governorate: input.receiver.governorate || province,
        neighborhood: input.receiver.neighborhood || district,
        lat: input.receiver.lat,
        lng: input.receiver.lng,
      },
    );
    const requestedHub = input.hubId?.trim() || '';
    const requestedValid = hubResolution.hubs.some((hub) => hub.id === requestedHub);
    let branchId: string | null = null;
    if (requestedValid) {
      branchId = requestedHub;
    } else if (hubResolution.nearestDetermined && hubResolution.nearestId) {
      branchId = hubResolution.nearestId;
    } else if (hubResolution.hubs.length === 1) {
      branchId = hubResolution.hubs[0].id;
    } else if (input.deliveryType === 'hub' || quotedCourier?.requires_branch) {
      throw new BadRequestException(
        'Select a delivery hub before sending. The nearest hub could not be determined automatically.',
      );
    } else {
      branchId = pickNearestSilaBranch(hubResolution.hubs, {
        governorate: input.receiver.governorate || province,
        neighborhood: input.receiver.neighborhood || district,
        lat: input.receiver.lat,
        lng: input.receiver.lng,
      })?.id ?? null;
    }

    const codCurrency = (input.currency ?? 'USD').trim().toUpperCase();
    const quoteCurrency = (quotedCourier?.currency ?? '').trim().toUpperCase();

    // Sila payload fields are observed (no checked-in OpenAPI). Do not change them from a guess.
    // shipping_paid_by accepts merchant | receiver only, so reseller cannot be encoded.
    // Receiver + COD is not blocked here; Sila's create response is the decision.
    // Province area_id is narrowed with Sila's own area API.
    // Fee currency and COD currency are independent. Do not block when they differ.
    // District prefers city over neighbourhood. Branch-only couriers stay hidden for home delivery.
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
      ...(branchId ? { branch_id: branchId } : {}),
      // Branch-only couriers (Masarat) reject a home-delivery create with
      // "does not serve this area (or this service type)".
      service_type: branchId || input.deliveryType === 'hub' ? 'pickup_at_branch' : 'home_delivery',
      pay_on_delivery: {
        amount: Math.max(0, Number(input.codAmount) || 0),
        currency: (input.currency ?? 'USD').toUpperCase(),
      },
      // Sila accepts only merchant | receiver. Sender is the merchant. Reseller has no Sila value.
      shipping_paid_by: (() => {
        if (input.payer === 'reseller') {
          throw new BadRequestException(
            'Sila-SY does not support Reseller as the shipping payer. Choose Sender or Receiver and send again.',
          );
        }
        return input.payer === 'receiver' ? 'receiver' : 'merchant';
      })(),
      merchant_pays_shipping: input.payer !== 'receiver',
      ...(input.reference?.trim()
        ? { reference: input.reference.trim().slice(0, 120) }
        : {}),
    };

    logSanitizedProviderRequest(
      this.logger,
      sanitizeSilaCargoBody(body, {
        serviceId: input.serviceId ?? courierId,
        quoteCurrency: quoteCurrency || null,
      }),
    );

    let raw: any;
    try {
      raw = await this.http.post<any>('cargos', apiKey(credentials), body);
    } catch (err) {
      if (err instanceof SilaSyApiError && err.code === 'duplicate_reference') {
        raw = await this.resolveDuplicateReference(
          credentials,
          input.reference,
          err,
          courierId,
          body,
        );
      } else if (err instanceof SilaSyApiError && err.code === 'possible_duplicate') {
        throw new BadRequestException(
          'Sila found a possible duplicate cargo for this order. Do not resend with allow_duplicate. Open the existing shipment and continue from there.',
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (isSilaProvinceAreaError(msg) && areaId) {
          const narrowed = await this.narrowProvinceArea(credentials, areaId, areaHints, true);
          if (narrowed === areaId) {
            throw new BadRequestException(
              'Sila area is a whole province. Missing city. Set the receiver city or neighbourhood so a child area can be selected, then send again.',
            );
          }
          (body.recipient as Record<string, unknown>).area_id = narrowed;
          raw = await this.http.post<any>('cargos', apiKey(credentials), body);
        } else {
          throw err;
        }
      }
    }

    const rawData = raw?.data ?? raw;
    // Sila cargo id / tracking token — API and webhook lookup only, not the carrier AWB.
    const providerId = extractSilaProviderId(rawData);
    if (!providerId) {
      throw new SilaSyApiError('Sila-SY createShipment succeeded without a provider reference.', undefined, raw);
    }
    const loaded = await this.fetchCargo(credentials, providerId);
    const cargo = loaded ?? rawData;
    const courierTracking = extractSilaCarrierAwb(cargo);

    return {
      awb: providerId,
      ...(courierTracking ? { trackingNumber: courierTracking } : {}),
      raw: cargo,
    };
  }

  private async resolveDuplicateReference(
    credentials: ShippingCredentials,
    reference: string | undefined,
    err: SilaSyApiError,
    requestedCourierId?: string | null,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const details =
      err.details && typeof err.details === 'object' ? (err.details as Record<string, unknown>) : {};
    const existingId = firstNonEmptyString(
      details.existing_cargo_id,
      details.existing_id,
      details.id,
    );
    let loaded: Record<string, any> | null = null;
    if (existingId) {
      loaded = await this.fetchCargo(credentials, existingId);
    }
    if (!loaded && reference?.trim()) {
      const found = await this.findShipmentByReference(credentials, reference.trim());
      if (found?.raw && typeof found.raw === 'object') {
        loaded = found.raw as Record<string, any>;
      }
    }

    if (loaded) {
      const existingCourierId = firstNonEmptyString(
        loaded.courier_id,
        loaded.courier?.id,
      ).toLowerCase();
      const targetCourierId = (requestedCourierId || '').toLowerCase().trim();
      const status = (loaded.status || '').toLowerCase().trim();
      const isDead = ['cancelled', 'returned', 'rejected', 'failed', 'delivered'].includes(status);
      const isSameCourier = !targetCourierId || !existingCourierId || existingCourierId === targetCourierId;
      const createdAtMs = loaded.created_at ? new Date(loaded.created_at).getTime() : 0;
      const isRecent = createdAtMs === 0 || Date.now() - createdAtMs < 2 * 60 * 60 * 1000;

      // Only reuse if it's the exact same courier, active status, and created recently (network retry)
      if (isSameCourier && !isDead && isRecent) {
        return loaded;
      }

      this.logger.warn(
        `Sila duplicate_reference for "${reference}" matched an incompatible cargo (id=${loaded.id}, courier=${existingCourierId}, targetCourier=${targetCourierId}, status=${status}, isRecent=${isRecent}). Retrying create with unique reference suffix.`,
      );
    }

    // Existing cargo is from a different carrier, terminal state, or ancient run:
    // Retry creating in Sila with a unique attempt suffix so the new shipment can be dispatched
    if (body) {
      const baseRef = (reference || 'ORD').trim().slice(0, 100);
      const suffix = Date.now().toString().slice(-4);
      body.reference = `${baseRef}-${suffix}`;

      try {
        const retryRes = await this.http.post<any>('cargos', apiKey(credentials), body);
        return retryRes?.data ?? retryRes;
      } catch (retryErr) {
        this.logger.error(
          `Sila retry with reference "${body.reference}" failed: ${(retryErr as Error)?.message}`,
        );
        throw retryErr;
      }
    }

    throw err;
  }

  async findShipmentByReference(
    credentials: ShippingCredentials,
    reference: string,
  ): Promise<{ awb: string; trackingNumber?: string; raw?: unknown } | null> {
    const trimmed = reference.trim().slice(0, 120);
    if (!trimmed) return null;
    try {
      const envelope = await this.http.getEnvelope<any>(
        `cargos?reference=${encodeURIComponent(trimmed)}`,
        apiKey(credentials),
      );
      const rows = silaCargoRows(envelope.data);
      const cargo =
        rows.find((row) => firstNonEmptyString(row.reference) === trimmed) ?? rows[0] ?? null;
      if (!cargo) return null;
      const providerId = extractSilaProviderId(cargo);
      if (!providerId) return null;
      const courierTracking = extractSilaCarrierAwb(cargo);
      return {
        awb: providerId,
        ...(courierTracking ? { trackingNumber: courierTracking } : {}),
        raw: cargo,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sila findShipmentByReference failed for ${trimmed}: ${msg}`);
      return null;
    }
  }

  /**
   * Branch couriers (Masarat) reject create unless branch_id is one of their hubs.
   * Choose the hub closest to the customer delivery address.
   */
  private async lookupQuotedCourier(
    credentials: ShippingCredentials,
    courierId: string,
    province: string,
    district: string,
    currency: string,
  ): Promise<SilaCourier | null> {
    try {
      const quoteRes = await this.http.post<any>('cargos/quote', apiKey(credentials), {
        province,
        district,
        weight_kg: 1,
        currency,
      });
      const quoteData = quoteRes?.data ?? quoteRes;
      const couriers: SilaCourier[] = Array.isArray(quoteData?.couriers) ? quoteData.couriers : [];
      return couriers.find((courier) => courier.courier_id?.trim() === courierId) ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sila courier lookup failed for ${courierId}: ${msg}`);
      return null;
    }
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

    let data: any;
    try {
      data = await this.http.get<any>(
        `cargos/${encodeURIComponent(trimmed)}`,
        apiKey(credentials),
      );
    } catch {
      return null;
    }
    const cargo = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    if (!cargo || !cargoMatchesToken(cargo, trimmed)) {
      return null;
    }
    return cargo;
  }

  /**
   * Sila status history. GET /cargos/{token} is the cargo record;
   * GET /cargos/{token}/tracking is the movement timeline.
   */
  private async fetchCargoTracking(
    credentials: ShippingCredentials,
    token: string,
  ): Promise<Record<string, any> | null> {
    const trimmed = token.trim();
    if (!trimmed) return null;
    try {
      const data = await this.http.get<any>(
        `cargos/${encodeURIComponent(trimmed)}/tracking`,
        apiKey(credentials),
      );
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    secret?: string,
  ): boolean {
    const signature =
      headerValue(headers, 'x-sila-signature') || headerValue(headers, 'X-Sila-Signature');
    if (secret?.trim() && signature) {
      return verifySilaSignature(rawBody, signature, secret);
    }
    // Staging fallback when Sila has not issued a secret yet: reject rather than skip HMAC.
    return false;
  }

  normalizeWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): NormalizedTrackingEvent | null {
    if (isSilaWebhookTest(headers, body)) return null;
    if (!body || typeof body !== 'object') return null;
    const built = buildSilaNormalizedEvent({
      headers,
      body,
      mapStatus: (raw) => mapSilaStatus(raw),
    });
    if (built) return built;

    const b = body as Record<string, any>;
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
    const detailNote =
      firstNonEmptyString(b.remote_failure_notes, b.failure_notes, b.reason) || undefined;
    const returnReason = mapped.carrierReturnStage
      ? firstNonEmptyString(
          b.return_reason,
          b.rejection_reason,
          b.failed_reason,
          detailNote,
        ) || undefined
      : undefined;

    return {
      providerCode: this.code,
      externalEventId: `${awb}:${rawStatus}:${b.updated_at || Date.now()}`,
      awb,
      eventType: rawStatus || 'WEBHOOK',
      normalizedStatus: mapped.normalized,
      notes: detailNote,
      returnReason,
      originalCarrierStatus: String(b.status || rawStatus || 'WEBHOOK'),
      eventDescription: mapped.labelAr || rawStatus,
      sourceType: 'webhook',
      isCarrierEvent: true,
      carrierReturnStage: mapped.carrierReturnStage,
      timestamp: b.updated_at ? new Date(b.updated_at) : new Date(),
      rawPayload: b,
    };
  }

  async registerWebhook(
    credentials: ShippingCredentials,
    webhookUrl: string,
    _secret: string,
  ): Promise<{ ok: boolean; message?: string; secret?: string; webhookId?: string }> {
    try {
      const raw = await this.http.post<any>('webhooks', apiKey(credentials), {
        url: webhookUrl,
        events: ['*'],
        description: 'Emdad WMS staging',
      });
      const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const nested =
        data.data && typeof data.data === 'object' && !Array.isArray(data.data)
          ? (data.data as Record<string, unknown>)
          : {};
      const secret = firstNonEmptyString(data.secret, nested.secret, data.webhook_secret);
      const webhookId = firstNonEmptyString(
        data.id,
        data.webhook_id,
        nested.id,
        nested.webhook_id,
      );
      this.logger.log(
        `Sila webhook registered at provider id=${webhookId || 'n/a'} secret=${secret ? 'saved_once' : 'missing'}`,
      );
      return {
        ok: true,
        webhookId: webhookId || undefined,
        secret: secret || undefined,
        message: secret
          ? 'Sila webhook registered. Signing secret stored server-side; it is not logged.'
          : 'Sila webhook registered but the provider did not return a signing secret.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }

  async testRegisteredWebhook(
    credentials: ShippingCredentials,
    webhookId: string,
  ): Promise<{ ok: boolean; message?: string }> {
    const id = webhookId.trim();
    if (!id) return { ok: false, message: 'Missing Sila webhook id.' };
    try {
      await this.http.post<any>(`webhooks/${encodeURIComponent(id)}/test`, apiKey(credentials), {});
      this.logger.log(`Sila official webhook.test ping accepted for webhookId=${id}`);
      return { ok: true, message: 'Sila webhook.test ping sent.' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sila webhook.test ping failed for webhookId=${id}: ${msg}`);
      return { ok: false, message: msg };
    }
  }

  async cancelShipment(
    credentials: ShippingCredentials,
    providerId: string,
  ): Promise<ShippingCancelResult> {
    const trimmed = providerId.trim();
    if (!trimmed) {
      return { outcome: 'refused', message: 'Missing Sila cargo id.', errorCode: 'missing_id' };
    }
    try {
      const raw = await this.http.put<any>(
        `cargos/${encodeURIComponent(trimmed)}/cancel`,
        apiKey(credentials),
        {},
      );
      const data = raw && typeof raw === 'object' ? raw : {};
      const courierCancel = firstNonEmptyString(data.courier_cancel).toLowerCase();
      const cargoStatus = firstNonEmptyString(data.status).toLowerCase();
      if (courierCancel === 'pending_confirmation') {
        return {
          outcome: 'pending_confirmation',
          courierCancel,
          cargoStatus,
          message: 'Sila cancelled the cargo and is waiting for the courier to confirm. The OMS order is not cancelled yet.',
          raw: data,
        };
      }
      if (courierCancel === 'already' || cargoStatus === 'cancelled') {
        return {
          outcome: courierCancel === 'already' ? 'already_cancelled' : 'cancelled',
          courierCancel: courierCancel || 'already',
          cargoStatus,
          message: 'Sila cargo is already cancelled.',
          raw: data,
        };
      }
      if (courierCancel === 'not_needed' || courierCancel === 'confirmed') {
        return {
          outcome: 'cancelled',
          courierCancel,
          cargoStatus,
          message: 'Sila accepted the cancel request.',
          raw: data,
        };
      }
      if (cargoStatus === 'cancelled') {
        return {
          outcome: 'cancelled',
          courierCancel: courierCancel || 'confirmed',
          cargoStatus,
          message: 'Sila cargo is cancelled.',
          raw: data,
        };
      }
      return {
        outcome: 'cancelled',
        courierCancel: courierCancel || undefined,
        cargoStatus,
        message: 'Sila accepted the cancel request.',
        raw: data,
      };
    } catch (err) {
      if (err instanceof SilaSyApiError) {
        const code = (err.code || '').toLowerCase();
        if (code === 'dispatch_in_progress') {
          const waitMs = Math.min(Math.max((err.retryAfterSeconds ?? 1) * 1000, 500), 15_000);
          await sleep(waitMs);
          try {
            const retryRaw = await this.http.put<any>(
              `cargos/${encodeURIComponent(trimmed)}/cancel`,
              apiKey(credentials),
              {},
            );
            const retryData = retryRaw && typeof retryRaw === 'object' ? retryRaw : {};
            const retryCancel = firstNonEmptyString(retryData.courier_cancel).toLowerCase();
            if (retryCancel === 'pending_confirmation') {
              return {
                outcome: 'pending_confirmation',
                courierCancel: retryCancel,
                cargoStatus: firstNonEmptyString(retryData.status).toLowerCase(),
                message:
                  'Sila cancelled the cargo and is waiting for the courier to confirm. The OMS order is not cancelled yet.',
                raw: retryData,
              };
            }
            return {
              outcome: retryCancel === 'already' ? 'already_cancelled' : 'cancelled',
              courierCancel: retryCancel || undefined,
              cargoStatus: firstNonEmptyString(retryData.status).toLowerCase(),
              message: 'Sila accepted the cancel request.',
              raw: retryData,
            };
          } catch (retryErr) {
            if (retryErr instanceof SilaSyApiError) return silaCancelErrorResult(retryErr);
            throw retryErr;
          }
        }
        return silaCancelErrorResult(err);
      }
      throw err;
    }
  }

  async listCargosUpdatedSince(
    credentials: ShippingCredentials,
    updatedSince: string,
    page = 1,
    pageSize = 200,
  ): Promise<{ cargos: Record<string, any>[]; hasMore: boolean; requestId?: string }> {
    const size = Math.min(Math.max(pageSize, 1), 200);
    const path =
      `cargos?updated_since=${encodeURIComponent(updatedSince)}` +
      `&page=${page}&page_size=${size}`;
    const envelope = await this.http.getEnvelope<any>(path, apiKey(credentials));
    return {
      cargos: silaCargoRows(envelope.data),
      hasMore: envelope.meta?.has_more === true,
      requestId: envelope.requestId,
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
      const shipment = firstShipment(cargo);
      const detailNote =
        firstNonEmptyString(shipment?.remote_failure_notes, cargo.rejection_reason) || undefined;
      const returnReason = mapped.carrierReturnStage
        ? firstNonEmptyString(cargo.return_reason, cargo.rejection_reason, detailNote) || undefined
        : undefined;

      const updatedAt = cargo.updated_at ? new Date(cargo.updated_at) : new Date();
      const cargoToken = firstNonEmptyString(cargo.tracking_token, cargo.barcode, cargo.id) || trimmed;

      return {
        providerCode: this.code,
        externalEventId: `${cargoToken}:${rawStatus}:${cargo.updated_at || Date.now()}`,
        awb: cargoToken,
        eventType: rawStatus || 'CARGO_STATUS',
        normalizedStatus: mapped.normalized,
        notes: detailNote,
        returnReason,
        originalCarrierStatus: String(cargo.status || rawStatus || 'CARGO_STATUS'),
        eventDescription: mapped.labelAr || rawStatus,
        sourceType: 'poll',
        isCarrierEvent: true,
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
      const [tracking, cargo] = await Promise.all([
        this.fetchCargoTracking(credentials, trimmed),
        this.fetchCargo(credentials, trimmed),
      ]);
      if (!tracking && !cargo) {
        return {
          providerCode: this.code,
          providerName: 'Sila-SY',
          awb: trimmed,
          events: [],
          message: 'لا توجد بيانات لحركة الشحنة من شركة الشحن.',
        };
      }

      const events: UnifiedShipmentMovementEvent[] = [];
      const timeline = Array.isArray(tracking?.timeline) ? tracking.timeline : [];
      for (const item of timeline) {
        if (!item || typeof item !== 'object') continue;
        pushUnique(events, timelineItemToEvent(item as SilaTrackingTimelineItem));
      }

      if (cargo) {
        for (const step of extractDeliveryRoute(cargo)) {
          if (!step || typeof step !== 'object') continue;
          const title = firstNonEmptyString(step.arabicName, step.name);
          const timestamp = toIsoOrNull(step.deliveryDate);
          if (!title || !timestamp) continue;
          pushUnique(events, {
            timestamp,
            title,
            originalDescription: title,
            location: null,
            color: step.isArrived !== false ? 'info' : 'default',
            code: typeof step.typeKey === 'string' ? step.typeKey : null,
            source: 'carrier',
          });
        }
      }

      if (events.length === 0 && cargo) {
        for (const event of buildSilaTimelineEvents(cargo)) pushUnique(events, event);
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      attachSilaCurrentDetail(events, cargo);

      const identityCargo =
        cargo && typeof cargo === 'object'
          ? {
              ...cargo,
              courier: tracking?.courier || cargo.courier,
            }
          : cargo;

      if (events.length === 0) {
        return {
          providerCode: this.code,
          providerName: silaCourierDisplayName(tracking, cargo),
          awb: trimmed,
          events: [],
          rawPayload: identityCargo || undefined,
          message: 'لا توجد بيانات لحركة الشحنة من شركة الشحن.',
        };
      }

      const rawStatus =
        (typeof tracking?.current_status === 'string' && tracking.current_status.trim()) ||
        (cargo ? resolveCargoStatus(cargo) : '');
      const mapped = mapSilaStatus(rawStatus);
      const cargoToken =
        firstNonEmptyString(
          tracking?.barcode,
          cargo?.tracking_token,
          cargo?.barcode,
          cargo?.id,
        ) || trimmed;
      const carrierAwb = extractSilaCarrierAwb(cargo);
      const providerName = silaCourierDisplayName(tracking, cargo);

      return {
        providerCode: this.code,
        providerName,
        awb: carrierAwb || cargoToken,
        isDelivered: mapped.normalized === 'delivered',
        statusLabel: mapped.labelAr,
        statusColor: mapped.color,
        events,
        rawPayload: identityCargo || undefined,
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

function silaCancelErrorResult(err: SilaSyApiError): ShippingCancelResult {
  const code = (err.code || '').toLowerCase();
  const retryable = code === 'courier_cancel_failed' || err.statusCode === 502 || err.statusCode === 503;
  if (
    code === 'cargo_locked' ||
    code === 'cancel_window_closed' ||
    code === 'courier_refused_cancel'
  ) {
    return {
      outcome: 'refused',
      errorCode: code,
      message: err.message,
      raw: err.body,
    };
  }
  if (retryable || code === 'rate_limit_exceeded' || code === 'dispatch_in_progress') {
    return {
      outcome: 'retry',
      errorCode: code || 'retryable',
      message: err.message,
      retryAfterSeconds: err.retryAfterSeconds,
      raw: err.body,
    };
  }
  return {
    outcome: 'refused',
    errorCode: code || 'cancel_failed',
    message: err.message,
    raw: err.body,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
