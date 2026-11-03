import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';

import type {
  NormalizedTrackingEvent,
  NormalizedTrackingStatus,
  ShipmentTrackingResult,
  ShippingCancelResult,
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
  ShippingCredentials,
  ShippingLabelResult,
  ShippingProvider,
  ShippingProviderCapabilities,
  ShippingQuoteInput,
  ShippingQuoteResult,
  UnifiedShipmentMovementEvent,
} from '../../shipping-provider.interface';
import { logSanitizedProviderRequest, sanitizeBabelCreatePayload } from '../../provider-request-log';
import { BABEL_EXPRESS_CODE } from '../../shipping.constants';
import {
  isBabelShipmentNotFoundMessage,
  PROVIDER_LOOKUP_NOT_FOUND_EVENT,
} from '../../shipping-lookup.util';
import { BabelApiError, BabelExpressHttpClient } from './babel-express.http-client';
import {
  isBabelCalculatePriceShippable,
  mapCalculatePricePayload,
  mapCreateShipmentPayload,
  resolveBabelCodCurrency,
  resolveBabelPickupType,
} from './babel-shipment.mapper';

function deliveryTypeLabel(type: 'address' | 'hub'): string {
  return type === 'hub' ? 'Hub' : 'Address';
}

/** Official webhook event names from Babel Express webhooks.yaml. */
export const BABEL_WEBHOOK_EVENTS = [
  'ChangedReceiver',
  'ArrivedToHub',
  'EnRoute',
  'DeliveryContact',
  'DeliveryFailed',
  'CreatedFollowupShipment',
  'OutForDelivery',
  'Delivered',
  'ReturnedToSender',
  'Disposed',
  'ShipmentLost',
] as const;

export const BABEL_EVENT_DESCRIPTIONS: Record<string, string> = {
  Created: 'تم تكوين الشحنة',
  ArrivedToHub: 'وصلت الشحنة الى نقطة التحويل',
  EnRoute: 'الشحنة ضمن النقل',
  OutForDelivery: 'خرجت الشحنة للتسليم',
  Delivered: 'تم تسليم الشحنة',
  DeliveryFailed: 'فشل تسليم الشحنة',
  DeliveryContact: 'الاتصال بالمستلم لتحديد التسليم',
  CreatedFollowupShipment: 'تم تكوين شحنة متابعة',
  ReturnedToSender: 'تمت الاعادة الى المرسل',
  ChangedReceiver: 'تم تغيير المستلم',
  Disposed: 'تم إتلاف الشحنة',
  ShipmentLost: 'فقدان الشحنة',
};

export const BABEL_WEBHOOK_KEY_MIN_LENGTH = 32;

export function generateBabelWebhookKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function babelWebhookSignature(awb: string, type: string, key: string): string {
  return crypto.createHash('sha256').update(`${awb}|${type}|${key}`).digest('hex');
}

@Injectable()
export class BabelExpressAdapter implements ShippingProvider {
  private readonly logger = new Logger(BabelExpressAdapter.name);
  readonly code = BABEL_EXPRESS_CODE;
  readonly capabilities: ShippingProviderCapabilities = {
    supportsQuote: true,
    supportsLabelPrinting: true,
    labelDelivery: 'api',
    supportsTracking: true,
    supportsWebhooks: true,
  };

  constructor(private readonly http: BabelExpressHttpClient) {}

  async testConnection(credentials: ShippingCredentials): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post('getCities', credentials, {});
      return { ok: true, message: 'Babel Express connection OK.' };
    } catch (err) {
      let message =
        err instanceof BabelApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Connection test failed.';
      if (/^unauthorized$/i.test(message.trim())) {
        message =
          'Babel Express rejected these credentials. Use the reseller username and password from Babel Express (not your WMS login).';
      }
      return { ok: false, message };
    }
  }

  async createShipment(
    credentials: ShippingCredentials,
    input: ShippingCreateShipmentInput,
  ): Promise<ShippingCreateShipmentResult> {
    const neighbourhoodId =
      input.receiver.neighbourhoodId ??
      (await this.lookupNeighbourhoodId(credentials, input.receiver.lat, input.receiver.lng));

    let deliveryType = input.deliveryType;
    if (deliveryType === 'address') {
      const probe = mapCalculatePricePayload({
        receiverLat: input.receiver.lat,
        receiverLng: input.receiver.lng,
        neighbourhoodId,
        packageType: input.packageType,
        weightKg: input.weightKg,
        parts: input.parts,
        deliveryType: 'address',
        pickupType: resolveBabelPickupType(input.pickupType),
        pickup: input.pickup,
      });
      const probeRaw = await this.http.post<{
        status?: string;
        price?: number;
        details?: unknown;
      }>('calculatePrice', credentials, probe);
      if (!isBabelCalculatePriceShippable(probeRaw, 'address')) {
        deliveryType = 'hub';
      }
    }

    // Preflight selected option — do not call create if calculatePrice shape is unshippable.
    const preflightPayload = mapCalculatePricePayload({
      receiverLat: input.receiver.lat,
      receiverLng: input.receiver.lng,
      neighbourhoodId,
      packageType: input.packageType,
      weightKg: input.weightKg,
      parts: input.parts,
      deliveryType,
      pickupType: resolveBabelPickupType(input.pickupType),
      pickup: input.pickup,
    });
    const preflight = await this.http.post<{
      status?: string;
      price?: number;
      details?: unknown;
    }>('calculatePrice', credentials, preflightPayload);
    if (!isBabelCalculatePriceShippable(preflight, deliveryType)) {
      throw new BabelApiError(
        'Babel Express does not offer a shippable service for this destination and options (quote response indicates no service).',
        undefined,
        preflight,
      );
    }

    const payload = mapCreateShipmentPayload({
      ...input,
      deliveryType,
      pickupType: resolveBabelPickupType(input.pickupType),
      // Keep the unit (old or new pound) so the COD payload can tell Babel with isNewSYP.
      currency: input.currency,
      receiver: {
        ...input.receiver,
        neighbourhoodId,
      },
    });
    logSanitizedProviderRequest(this.logger, sanitizeBabelCreatePayload(payload));
    const raw = await this.http.post<{
      status?: string;
      awb?: string;
      partBarcodes?: string[];
      parts?: unknown;
    }>('createShipment', credentials, payload);
    const awb = typeof raw?.awb === 'string' ? raw.awb.trim() : '';
    if (!awb) {
      throw new BabelApiError('Babel Express createShipment succeeded without awb.', undefined, raw);
    }
    const partBarcodes = Array.isArray(raw?.partBarcodes)
      ? raw.partBarcodes
          .filter((b): b is string => typeof b === 'string' && Boolean(b.trim()))
          .map((b) => b.trim())
      : undefined;
    return { awb, partBarcodes, raw };
  }

  async getQuote(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    let neighbourhoodId = input.neighbourhoodId;
    const lat = Number(input.receiverLat);
    const lng = Number(input.receiverLng);
    const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0 && Math.abs(lng) > 0;
    if (neighbourhoodId == null && !hasPin) {
      throw new BabelApiError(
        'Babel calculatePrice was not sent: the request has no neighbourhood id and no coordinates.',
      );
    }
    if (neighbourhoodId == null) {
      neighbourhoodId = await this.lookupNeighbourhoodId(credentials, lat, lng);
    }

    const requestQuote = async (deliveryType: 'address' | 'hub') => {
      const payload = mapCalculatePricePayload({
        ...input,
        neighbourhoodId,
        deliveryType,
        pickupType: resolveBabelPickupType(input.pickupType),
        pickup: input.pickup,
      });
      return this.http.post<{
        status?: string;
        price?: number;
        currency?: string;
        /** Babel says whether a SYP price is in the new Syrian pound. */
        isNewSYP?: boolean;
        details?: unknown;
      }>('calculatePrice', credentials, payload);
    };

    const raw = await requestQuote(input.deliveryType);
    const effectiveDeliveryType = input.deliveryType;

    const shippable = isBabelCalculatePriceShippable(raw, effectiveDeliveryType);
    if (!shippable) {
      throw new BabelApiError(
        `Babel calculatePrice did not offer ${input.deliveryType}: ${JSON.stringify(raw)}`,
        undefined,
        raw,
      );
    }

    const price = typeof raw?.price === 'number' ? raw.price : Number(raw?.price);
    if (!Number.isFinite(price)) {
      throw new BabelApiError('Babel Express calculatePrice missing price.', undefined, raw);
    }
    const rawCurrency = typeof raw?.currency === 'string' ? raw.currency : 'SYP';
    // Babel states the pound unit itself (isNewSYP); that answer beats any assumption we hold.
    const currency =
      rawCurrency.trim().toUpperCase() === 'SYP' && typeof raw?.isNewSYP === 'boolean'
        ? raw.isNewSYP
          ? 'SYP_NEW'
          : 'SYP_OLD'
        : rawCurrency;
    return {
      price,
      currency,
      details: raw?.details,
      effectiveDeliveryType,
      serviceName: deliveryTypeLabel(effectiveDeliveryType),
      shippable: true,
      neighbourhoodId,
    };
  }

  /**
   * Quote Babel Express for address and hub so Mixed delivery filters can recommend
   * across both modes. Unshippable options are omitted.
   */
  async getServiceOptions(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]> {
    const types: Array<'address' | 'hub'> = ['address', 'hub'];
    const results: ShippingQuoteResult[] = [];
    const omitted: string[] = [];
    for (const deliveryType of types) {
      try {
        const quote = await this.getQuote(credentials, { ...input, deliveryType });
        const effectiveType = quote.effectiveDeliveryType ?? deliveryType;
        // Avoid duplicate when address falls back to hub
        if (results.some((r) => (r.effectiveDeliveryType ?? r.serviceId) === effectiveType || r.serviceId === `${BABEL_EXPRESS_CODE}:${effectiveType}`)) {
          continue;
        }
        results.push({
          ...quote,
          effectiveDeliveryType: effectiveType,
          serviceId: `${BABEL_EXPRESS_CODE}:${effectiveType}`,
          serviceName:
            effectiveType === 'hub'
              ? 'بابل إكسبريس — فرع (Babel Hub)'
              : 'بابل إكسبريس — منزلي (Babel Home)',
          providerName: 'Babel Express',
          estimatedDeliveryMin: 2,
          estimatedDeliveryMax: 3,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        omitted.push(message);
        this.logger.warn(`Babel ${deliveryType} quote omitted: ${message}`);
      }
    }
    if (results.length === 0 && omitted.length > 0) {
      throw new BabelApiError(omitted[0]);
    }
    return results;
  }

  async lookupNeighbourhoodId(
    credentials: ShippingCredentials,
    lat: number,
    lng: number,
  ): Promise<number> {
    const raw = await this.http.post<{
      neighbourhood?: { id?: number; name?: string };
    }>('findNeighbourhoodByCoordinates', credentials, {
      coordinates: { lat, lng },
    });
    const id = raw?.neighbourhood?.id;
    if (typeof id !== 'number' || !Number.isFinite(id)) {
      throw new BabelApiError(
        'Could not resolve the delivery neighbourhood from the map coordinates.',
      );
    }
    return id;
  }

  async findNeighbourhoodByCoordinates(
    credentials: ShippingCredentials,
    lat: number,
    lng: number,
  ): Promise<{ id: number; name: string } | null> {
    try {
      const raw = await this.http.post<{
        neighbourhood?: { id?: number; name?: string };
      }>('findNeighbourhoodByCoordinates', credentials, {
        coordinates: { lat, lng },
      });
      const id = raw?.neighbourhood?.id;
      const name = raw?.neighbourhood?.name;
      if (typeof id !== 'number' || !Number.isFinite(id)) return null;
      return { id, name: typeof name === 'string' ? name : String(id) };
    } catch {
      return null;
    }
  }

  /**
   * Prefer printable PDF; fall back to AWB link. Returns null if neither is available.
   */
  async getLabel(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShippingLabelResult | null> {
    const trimmed = awb.trim();
    if (!trimmed) return null;

    try {
      const pdfRaw = await this.http.post<{
        status?: string;
        pdf?: string;
        content?: string;
        data?: string;
      }>('getAWBPdf', credentials, { awb: trimmed });
      const pdfBase64 =
        (typeof pdfRaw?.pdf === 'string' && pdfRaw.pdf) ||
        (typeof pdfRaw?.content === 'string' && pdfRaw.content) ||
        (typeof pdfRaw?.data === 'string' && pdfRaw.data) ||
        '';
      if (pdfBase64.trim()) {
        return { pdfBase64: pdfBase64.trim(), contentType: 'application/pdf' };
      }
    } catch {
      // Fall through to link.
    }

    try {
      const linkRaw = await this.http.post<{
        status?: string;
        url?: string;
        link?: string;
        awbLink?: string;
      }>('getAWBLink', credentials, { awb: trimmed });
      const url =
        (typeof linkRaw?.url === 'string' && linkRaw.url) ||
        (typeof linkRaw?.link === 'string' && linkRaw.link) ||
        (typeof linkRaw?.awbLink === 'string' && linkRaw.awbLink) ||
        '';
      if (url.trim()) {
        return { url: url.trim() };
      }
    } catch {
      // No label from API.
    }

    return null;
  }

  // ─── Tracking & Webhooks ───────────────────────────────────────────────────

  verifyWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: unknown,
    secret?: string,
  ): boolean {
    let parsed: unknown = body;
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      try {
        parsed = JSON.parse(typeof body === 'string' ? body : body.toString('utf8'));
      } catch {
        return false;
      }
    }
    if (!parsed || typeof parsed !== 'object') return false;
    const b = parsed as Record<string, any>;
    // Official registerWebhook handshake is `{ "type": "test" }` with no signature.
    if (b.type === 'test') return true;
    if (!secret || !secret.trim()) return false;
    const { awb, type, verify } = b;
    if (!verify || !awb || !type) return false;
    const expected = babelWebhookSignature(String(awb), String(type), secret.trim());
    return String(verify).toLowerCase() === expected.toLowerCase();
  }

  normalizeWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): NormalizedTrackingEvent | null {
    if (!body || typeof body !== 'object') return null;
    const b = body as Record<string, any>;
    if (b.type === 'test') return null; // registration handshake

    const awb = typeof b.awb === 'string' ? b.awb.trim() : '';
    const type = typeof b.type === 'string' ? b.type.trim() : '';
    if (!awb || !type) return null;

    const details = b.details && typeof b.details === 'object' ? b.details : {};
    let normalizedStatus: NormalizedTrackingStatus = 'unknown';
    let carrierReturnStage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' | undefined;

    switch (type) {
      case 'ArrivedToHub':
      case 'EnRoute':
      case 'InTransit':
      case 'ChangedReceiver':
        normalizedStatus = 'in_transit';
        break;
      case 'OutForDelivery':
        normalizedStatus = 'out_for_delivery';
        break;
      case 'Delivered':
        normalizedStatus = 'delivered';
        break;
      case 'DeliveryFailed':
        normalizedStatus = 'delivery_failed';
        break;
      case 'DeliveryContact':
        // Contact, no-answer, and reschedule notes stay on the movement.
        // They are not a failed delivery and must not change the OMS status.
        normalizedStatus = 'unknown';
        break;
      case 'CreatedFollowupShipment': {
        const followupType =
          typeof details.followupType === 'string' ? details.followupType.trim() : '';
        if (followupType === 'return') {
          normalizedStatus = 'return_created';
          carrierReturnStage = 'return_created';
        } else {
          // receiverChange and undocumented follow-up types must not create a return.
          normalizedStatus = 'unknown';
        }
        break;
      }
      case 'ReturnedToSender':
        normalizedStatus = 'returned_to_sender';
        carrierReturnStage = 'returned_to_sender';
        break;
      case 'Disposed':
      case 'ShipmentLost':
        // Official webhooks.yaml: disposed / lost. These are not reseller cancellation.
        normalizedStatus = 'unknown';
        break;
    }

    const time = typeof b.time === 'number' ? b.time : null;
    const timestamp = time ? new Date(time * 1000) : new Date();
    const locationText = details.name || details.location || undefined;
    const notes = details.reason || details.note || details.followupType || undefined;
    const returnReason = (typeof details.reason === 'string' && details.reason.trim())
      || (typeof details.note === 'string' && details.note.trim())
      || undefined;
    const originalCarrierStatus = String(b.type || b.status || b.statusText || type);

    const explicitText = typeof details.text === 'string' && details.text.trim()
      ? details.text.trim()
      : typeof b.text === 'string' && b.text.trim()
        ? b.text.trim()
        : null;
    const defaultDesc = BABEL_EVENT_DESCRIPTIONS[type] || type;
    const eventDescription = explicitText
      || (details.note
        ? `${defaultDesc} - ${details.note}`
        : details.reason
          ? `${defaultDesc} - ${details.reason}`
          : defaultDesc);

    return {
      providerCode: this.code,
      externalEventId: `${awb}:${type}:${time ?? Date.now()}`,
      awb,
      eventType: type,
      normalizedStatus,
      timestamp,
      locationText,
      notes,
      returnReason,
      originalCarrierStatus: type,
      eventDescription,
      sourceType: 'webhook',
      isCarrierEvent: true,
      carrierReturnStage,
      reference: typeof b.reference === 'string' ? b.reference.trim() : undefined,
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
      const res = await this.http.post<any>('trackShipment', credentials, { awb: trimmed });
      if (res?.status !== 'success' || !res?.tracking) {
        if (isBabelShipmentNotFoundMessage(res?.errorMessage)) {
          return this.lookupNotFoundEvent(trimmed, res?.errorMessage);
        }
        return null;
      }
      const t = res.tracking;

      let normalizedStatus: NormalizedTrackingStatus = 'in_transit';
      let carrierReturnStage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' | undefined;

      if (t.isDelivered) {
        normalizedStatus = 'delivered';
      } else {
        const updates = Array.isArray(t.updates) ? t.updates : [];
        const lastUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
        const text = (lastUpdate?.text || t.shipmentStatus?.text || '').trim();

        if (text.includes('تسليم الشحنة') || text.includes('تم التسليم')) {
          normalizedStatus = 'delivered';
        } else if (text.includes('خرجت الشحنة للتسليم') || text.includes('للتسليم')) {
          normalizedStatus = 'out_for_delivery';
        } else if (
          text.includes('تم ارجاع الشحنة الى المرسل') ||
          text.includes('عادت الى المرسل') ||
          text.includes('تسليم المرتجع للمرسل')
        ) {
          normalizedStatus = 'returned_to_sender';
          carrierReturnStage = 'returned_to_sender';
        } else if (
          text.includes('قيد الارجاع') ||
          text.includes('جاري اعادة الشحنة') ||
          text.includes('في طريق العودة')
        ) {
          normalizedStatus = 'returning_to_sender';
          carrierReturnStage = 'returning_to_sender';
        } else if (
          text.includes('انشاء بوليصة مرتجع') ||
          text.includes('طلب ارجاع') ||
          text.includes('تكوين شحنة مرتجعة')
        ) {
          normalizedStatus = 'return_created';
          carrierReturnStage = 'return_created';
        } else if (text.includes('ارجاع') || text.includes('عادت') || text.includes('مرتجع')) {
          normalizedStatus = 'returning_to_sender';
          carrierReturnStage = 'returning_to_sender';
        } else if (
          text.includes('فشل الاتصال') ||
          text.includes('لم يتم الرد') ||
          text.includes('غير متاح') ||
          text.includes('تأجيل')
        ) {
          // Courier contact / postpone text is movement detail, not a failed delivery.
          normalizedStatus = 'unknown';
        } else if (text.includes('فشل') || text.includes('تعذر')) {
          normalizedStatus = 'delivery_failed';
        } else if (text.includes('وصلت') || text.includes('تكوين') || text.includes('تحويل')) {
          normalizedStatus = 'in_transit';
        }
      }

      const rawStatusText = t.shipmentStatus?.text || 'TRACKING_UPDATE';
      const rawStatusCode = t.shipmentStatus?.code || rawStatusText;
      const updates = Array.isArray(t.updates) ? t.updates : [];
      const lastUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
      const updateTime = lastUpdate?.time ? Number(lastUpdate.time) : null;
      const timestamp = t.deliverDate
        ? new Date(t.deliverDate * 1000)
        : updateTime && Number.isFinite(updateTime)
          ? new Date(updateTime * 1000)
          : new Date();
      const eventDescription = lastUpdate?.text || rawStatusText;

      return {
        providerCode: this.code,
        awb: trimmed,
        eventType: rawStatusCode,
        normalizedStatus,
        carrierReturnStage,
        originalCarrierStatus: rawStatusCode,
        eventDescription,
        sourceType: 'poll',
        isCarrierEvent: true,
        timestamp,
        locationText: lastUpdate?.location || undefined,
        rawPayload: res,
      };
    } catch (err: any) {
      if (isBabelShipmentNotFoundMessage(err?.message)) {
        return this.lookupNotFoundEvent(trimmed, err?.message);
      }
      return null;
    }
  }

  private lookupNotFoundEvent(awb: string, errorMessage?: string): NormalizedTrackingEvent {
    const message = (errorMessage || 'Shipment not found').trim();
    return {
      providerCode: this.code,
      awb,
      externalEventId: `${PROVIDER_LOOKUP_NOT_FOUND_EVENT}:${awb}`,
      eventType: PROVIDER_LOOKUP_NOT_FOUND_EVENT,
      normalizedStatus: 'unknown',
      originalCarrierStatus: message,
      eventDescription: message,
      sourceType: 'poll',
      isCarrierEvent: true,
      notes: message,
      timestamp: new Date(),
      rawPayload: { lookupState: 'not_found', errorMessage: message },
    };
  }

  /**
   * Fetches the complete shipment movement history from Babel Express API trackShipment.
   * Returns updates sorted chronologically descending (newest first).
   */
  async getTrackingHistory(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShipmentTrackingResult | null> {
    const trimmed = awb.trim();
    if (!trimmed) return null;

    try {
      const res = await this.http.post<any>('trackShipment', credentials, { awb: trimmed });
      if (res?.status !== 'success' || !res?.tracking) {
        const notFound = isBabelShipmentNotFoundMessage(res?.errorMessage);
        return {
          providerCode: this.code,
          providerName: 'Babel Express',
          awb: trimmed,
          events: [],
          lookupState: notFound ? 'not_found' : 'error',
          cancellationUnconfirmed: notFound,
          shipmentState: 'active',
          message: notFound
            ? 'The carrier did not return this shipment. Cancellation is not confirmed.'
            : res?.errorMessage || 'No tracking information available for this shipment.',
          error: notFound ? undefined : res?.errorMessage,
        };
      }

      const t = res.tracking;
      const rawUpdates: any[] = Array.isArray(t.updates) ? t.updates : [];

      const events: UnifiedShipmentMovementEvent[] = rawUpdates.map((u) => {
        let color: 'default' | 'info' | 'success' | 'error' | 'warning' = 'default';
        const rawColor = String(u.color || '').toLowerCase().trim();
        if (rawColor === 'success') color = 'success';
        else if (rawColor === 'error' || rawColor === 'danger') color = 'error';
        else if (rawColor === 'info') color = 'info';
        else if (rawColor === 'warning') color = 'warning';

        const timeSeconds = typeof u.time === 'number' ? u.time : Number(u.time);
        const timestamp = Number.isFinite(timeSeconds) && timeSeconds > 0
          ? new Date(timeSeconds * 1000).toISOString()
          : new Date().toISOString();

        return {
          timestamp,
          title: typeof u.text === 'string' && u.text.trim() ? u.text.trim() : (u.code || ''),
          location: typeof u.location === 'string' && u.location.trim() ? u.location.trim() : null,
          color,
          code: typeof u.code === 'string' ? u.code : null,
          source: 'carrier',
          originalDescription: typeof u.text === 'string' ? u.text.trim() : null,
        };
      });

      // Sort descending (newest first)
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        providerCode: this.code,
        providerName: 'Babel Express',
        awb: trimmed,
        isDelivered: Boolean(t.isDelivered),
        statusLabel: t.shipmentStatus?.text || undefined,
        statusColor: t.shipmentStatus?.color || undefined,
        lookupState: 'ok',
        shipmentState: 'active',
        cancellationUnconfirmed: false,
        events,
      };
    } catch (err: any) {
      const message = err?.message || 'Failed to query Babel Express tracking API.';
      const notFound = isBabelShipmentNotFoundMessage(message);
      return {
        providerCode: this.code,
        providerName: 'Babel Express',
        awb: trimmed,
        events: [],
        lookupState: notFound ? 'not_found' : 'error',
        cancellationUnconfirmed: notFound,
        shipmentState: 'active',
        message: notFound
          ? 'The carrier did not return this shipment. Cancellation is not confirmed.'
          : undefined,
        error: notFound ? undefined : message,
      };
    }
  }

  async registerWebhook(
    credentials: ShippingCredentials,
    webhookUrl: string,
    secret: string,
  ): Promise<{ ok: boolean; message?: string; secret?: string }> {
    const key =
      secret.trim().length >= BABEL_WEBHOOK_KEY_MIN_LENGTH
        ? secret.trim()
        : generateBabelWebhookKey();
    try {
      const payload = {
        webhook: {
          enabled: true,
          key,
          url: webhookUrl,
          subscribedEvents: [...BABEL_WEBHOOK_EVENTS],
        },
      };
      const res = await this.http.post<any>('registerWebhook', credentials, payload);
      if (res?.status === 'success') {
        return {
          ok: true,
          secret: key,
          message:
            'Babel Express webhook registered. Provider returned status=success after the documented test POST to the callback URL.',
        };
      }
      return { ok: false, message: res?.errorMessage || 'Failed to register webhook with Babel Express.' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Error communicating with Babel Express registerWebhook.' };
    }
  }

  async cancelShipment(
    _credentials: ShippingCredentials,
    _providerId: string,
  ): Promise<ShippingCancelResult> {
    return {
      outcome: 'refused',
      errorCode: 'cancel_unsupported',
      message:
        'Babel Express API does not support automated cancellation via API. Please cancel the shipment directly in the Babel merchant portal.',
    };
  }
}
