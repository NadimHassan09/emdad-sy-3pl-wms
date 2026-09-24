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

    const body: Record<string, unknown> = {
      recipient: {
        full_name: input.receiver.name,
        phone,
        province,
        district,
        address_line: addressLine,
        ...(areaId ? { area_id: areaId } : {}),
      },
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
    const barcode =
      (typeof rawData?.barcode === 'string' && rawData.barcode.trim()) ||
      (typeof rawData?.awb_number === 'string' && rawData.awb_number.trim()) ||
      (typeof rawData?.code === 'string' && rawData.code.trim()) ||
      (typeof rawData?.tracking_token === 'string' && rawData.tracking_token.trim()) ||
      (typeof rawData?.id === 'string' && rawData.id.trim()) ||
      (typeof raw?.barcode === 'string' && raw.barcode.trim()) ||
      '';
    if (!barcode) {
      throw new SilaSyApiError('Sila-SY createShipment succeeded without barcode.', undefined, raw);
    }

    return { awb: barcode, raw };
  }

  // ─── getLabel ──────────────────────────────────────────────────────────────

  /**
   * Retrieves the label URL for a shipment by barcode.
   * Sila returns label_url directly in the shipment data.
   */
  async getLabel(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShippingLabelResult | null> {
    const trimmed = awb.trim();
    if (!trimmed) return null;

    try {
      // GET /cargos?barcode={awb} returns a paginated list — pick first match
      const listData = await this.http.get<any>(
        `cargos?barcode=${encodeURIComponent(trimmed)}`,
        apiKey(credentials),
      );
      const items = Array.isArray(listData?.data)
        ? listData.data
        : Array.isArray(listData)
          ? listData
          : [];
      const cargo = items[0];
      const labelUrl = typeof cargo?.label_url === 'string' ? cargo.label_url.trim() : null;
      if (labelUrl) {
        return { url: labelUrl };
      }
    } catch {
      // Label not retrievable — return null, do not throw
    }
    return null;
  }

  // ─── Tracking & Webhooks ───────────────────────────────────────────────────

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
    const awb =
      (typeof b.barcode === 'string' && b.barcode.trim()) ||
      (typeof b.awb === 'string' && b.awb.trim()) ||
      (typeof b.tracking_number === 'string' && b.tracking_number.trim()) ||
      '';
    const rawStatus = typeof b.status === 'string' ? b.status.trim().toLowerCase() : '';
    if (!awb && !rawStatus) return null;

    let normalizedStatus: NormalizedTrackingStatus = 'unknown';
    let carrierReturnStage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' | undefined;

    switch (rawStatus) {
      case 'delivered':
      case 'completed':
        normalizedStatus = 'delivered';
        break;
      case 'out_for_delivery':
      case 'delivering':
        normalizedStatus = 'out_for_delivery';
        break;
      case 'return_created':
      case 'return_initiated':
      case 'return_requested':
        normalizedStatus = 'return_created';
        carrierReturnStage = 'return_created';
        break;
      case 'returning':
      case 'returning_to_sender':
      case 'in_return':
        normalizedStatus = 'returning_to_sender';
        carrierReturnStage = 'returning_to_sender';
        break;
      case 'returned':
      case 'returned_to_sender':
        normalizedStatus = 'returned_to_sender';
        carrierReturnStage = 'returned_to_sender';
        break;
      case 'failed':
      case 'undelivered':
      case 'delivery_failed':
        normalizedStatus = 'delivery_failed';
        break;
      case 'processing':
      case 'in_transit':
      case 'received':
        normalizedStatus = 'in_transit';
        break;
      case 'cancelled':
        normalizedStatus = 'cancelled';
        break;
    }

    const returnReason =
      (typeof b.return_reason === 'string' && b.return_reason.trim()) ||
      (typeof b.failed_reason === 'string' && b.failed_reason.trim()) ||
      (typeof b.reason === 'string' && b.reason.trim()) ||
      (typeof b.note === 'string' && b.note.trim()) ||
      (typeof b.notes === 'string' && b.notes.trim()) ||
      undefined;

    return {
      providerCode: this.code,
      externalEventId: `${awb}:${rawStatus}:${b.updated_at || Date.now()}`,
      awb,
      eventType: rawStatus || 'WEBHOOK',
      normalizedStatus,
      returnReason,
      originalCarrierStatus: String(b.status || rawStatus || 'WEBHOOK'),
      carrierReturnStage,
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
      const listData = await this.http.get<any>(
        `cargos?barcode=${encodeURIComponent(trimmed)}`,
        apiKey(credentials),
      );
      const items = Array.isArray(listData?.data)
        ? listData.data
        : Array.isArray(listData)
          ? listData
          : [];
      const cargo = items[0];
      if (!cargo) return null;

      const rawStatus = (cargo.status || '').toLowerCase().trim();
      let normalizedStatus: NormalizedTrackingStatus = 'unknown';
      let carrierReturnStage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' | undefined;

      switch (rawStatus) {
        case 'delivered':
        case 'completed':
          normalizedStatus = 'delivered';
          break;
        case 'out_for_delivery':
        case 'delivering':
          normalizedStatus = 'out_for_delivery';
          break;
        case 'return_created':
        case 'return_initiated':
        case 'return_requested':
          normalizedStatus = 'return_created';
          carrierReturnStage = 'return_created';
          break;
        case 'returning':
        case 'returning_to_sender':
        case 'in_return':
          normalizedStatus = 'returning_to_sender';
          carrierReturnStage = 'returning_to_sender';
          break;
        case 'returned':
        case 'returned_to_sender':
          normalizedStatus = 'returned_to_sender';
          carrierReturnStage = 'returned_to_sender';
          break;
        case 'failed':
        case 'undelivered':
        case 'delivery_failed':
          normalizedStatus = 'delivery_failed';
          break;
        case 'processing':
        case 'in_transit':
        case 'received':
        case 'created':
          normalizedStatus = 'in_transit';
          break;
        case 'cancelled':
          normalizedStatus = 'cancelled';
          break;
      }

      const returnReason =
        (typeof cargo.return_reason === 'string' && cargo.return_reason.trim()) ||
        (typeof cargo.failed_reason === 'string' && cargo.failed_reason.trim()) ||
        (typeof cargo.reason === 'string' && cargo.reason.trim()) ||
        (typeof cargo.note === 'string' && cargo.note.trim()) ||
        undefined;

      const updatedAt = cargo.updated_at ? new Date(cargo.updated_at) : new Date();

      return {
        providerCode: this.code,
        externalEventId: `${trimmed}:${rawStatus}:${cargo.updated_at || Date.now()}`,
        awb: trimmed,
        eventType: rawStatus || 'CARGO_STATUS',
        normalizedStatus,
        returnReason,
        originalCarrierStatus: String(cargo.status || rawStatus || 'CARGO_STATUS'),
        carrierReturnStage,
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
      const listData = await this.http.get<any>(
        `cargos?barcode=${encodeURIComponent(trimmed)}`,
        apiKey(credentials),
      );
      const items = Array.isArray(listData?.data)
        ? listData.data
        : Array.isArray(listData)
          ? listData
          : [];
      const cargo = items[0];
      if (!cargo) {
        return {
          providerCode: this.code,
          providerName: 'Sila-SY',
          awb: trimmed,
          events: [],
          message: 'No tracking information found for this shipment.',
        };
      }

      const events: UnifiedShipmentMovementEvent[] = [];
      const rawStatus = (cargo.status || '').toLowerCase().trim();
      const updatedAt = cargo.updated_at ? new Date(cargo.updated_at).toISOString() : new Date().toISOString();

      let color: 'default' | 'info' | 'success' | 'error' | 'warning' = 'default';
      if (rawStatus === 'delivered' || rawStatus === 'completed') color = 'success';
      else if (rawStatus === 'out_for_delivery' || rawStatus === 'delivering') color = 'info';
      else if (rawStatus === 'failed' || rawStatus === 'undelivered' || rawStatus === 'cancelled') color = 'error';
      else if (rawStatus === 'returned' || rawStatus === 'returned_to_sender') color = 'warning';

      events.push({
        timestamp: updatedAt,
        title: cargo.status_label || cargo.status || 'Status update',
        location: cargo.destination_city || cargo.city || null,
        color,
        code: rawStatus,
      });

      return {
        providerCode: this.code,
        providerName: 'Sila-SY',
        awb: trimmed,
        isDelivered: rawStatus === 'delivered' || rawStatus === 'completed',
        statusLabel: cargo.status_label || cargo.status || undefined,
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
