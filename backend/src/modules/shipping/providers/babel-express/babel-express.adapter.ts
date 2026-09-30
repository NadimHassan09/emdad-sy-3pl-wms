import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';

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
  UnifiedShipmentMovementEvent,
} from '../../shipping-provider.interface';
import { BABEL_EXPRESS_CODE } from '../../shipping.constants';
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

@Injectable()
export class BabelExpressAdapter implements ShippingProvider {
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
        pickupType: 'hub',
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
      pickupType: 'hub',
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
      currency: resolveBabelCodCurrency(input.currency),
      receiver: {
        ...input.receiver,
        neighbourhoodId,
      },
    });
    const raw = await this.http.post<{ status?: string; awb?: string }>(
      'createShipment',
      credentials,
      payload,
    );
    const awb = typeof raw?.awb === 'string' ? raw.awb.trim() : '';
    if (!awb) {
      throw new BabelApiError('Babel Express createShipment succeeded without awb.', undefined, raw);
    }
    return { awb, raw };
  }

  async getQuote(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    let neighbourhoodId = input.neighbourhoodId;
    if (neighbourhoodId == null) {
      neighbourhoodId = await this.lookupNeighbourhoodId(
        credentials,
        input.receiverLat,
        input.receiverLng,
      );
    }

    const requestQuote = async (deliveryType: 'address' | 'hub') => {
      const payload = mapCalculatePricePayload({
        ...input,
        neighbourhoodId,
        deliveryType,
        pickupType: 'hub',
      });
      return this.http.post<{
        status?: string;
        price?: number;
        currency?: string;
        details?: unknown;
      }>('calculatePrice', credentials, payload);
    };

    let raw = await requestQuote(input.deliveryType);
    let effectiveDeliveryType = input.deliveryType;
    let restrictions: string[] | undefined;

    if (
      input.deliveryType === 'address' &&
      !isBabelCalculatePriceShippable(raw, 'address')
    ) {
      raw = await requestQuote('hub');
      effectiveDeliveryType = 'hub';
      restrictions = [
        'Door delivery is not available at this pin. Hub delivery applies (customer collects from a Babel hub).',
      ];
    }

    const shippable = isBabelCalculatePriceShippable(raw, effectiveDeliveryType);
    if (!shippable) {
      throw new BabelApiError(
        'Not available for this destination / shipment configuration (Babel returned a non-shippable quote).',
        undefined,
        raw,
      );
    }

    const price = typeof raw?.price === 'number' ? raw.price : Number(raw?.price);
    if (!Number.isFinite(price)) {
      throw new BabelApiError('Babel Express calculatePrice missing price.', undefined, raw);
    }
    const currency = typeof raw?.currency === 'string' ? raw.currency : 'SYP';
    return {
      price,
      currency,
      details: raw?.details,
      effectiveDeliveryType,
      serviceName: deliveryTypeLabel(effectiveDeliveryType),
      restrictions,
      shippable: true,
      neighbourhoodId,
    };
  }

  /**
   * Quote Babel Express option for the user-selected deliveryType.
   * Delivery type (Home delivery vs Branch delivery) is chosen by the user in the form.
   * Does NOT produce dual Address and Hub cards.
   */
  async getServiceOptions(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]> {
    try {
      const quote = await this.getQuote(credentials, input);
      if (!quote || !quote.shippable) return [];

      const effectiveType = quote.effectiveDeliveryType ?? input.deliveryType ?? 'address';
      return [
        {
          ...quote,
          serviceId: `${BABEL_EXPRESS_CODE}:${effectiveType}`,
          serviceName: 'بابل إكسبريس (Babel Express)',
          providerName: 'Babel Express',
          estimatedDeliveryMin: 2,
          estimatedDeliveryMax: 3,
        },
      ];
    } catch {
      return [];
    }
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
    if (!secret || !secret.trim()) return true;
    if (!body || typeof body !== 'object') return false;
    const b = body as Record<string, any>;
    if (b.type === 'test') return true; // Registration handshake test
    const { awb, type, verify } = b;
    if (!verify || !awb || !type) return false;
    const expected = crypto
      .createHash('sha256')
      .update(`${awb}|${type}|${secret.trim()}`)
      .digest('hex');
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

    let normalizedStatus: NormalizedTrackingStatus = 'unknown';
    let carrierReturnStage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' | undefined;

    switch (type) {
      case 'ArrivedToHub':
      case 'EnRoute':
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
      case 'DeliveryContact':
        normalizedStatus = 'delivery_failed';
        break;
      case 'CreatedFollowupShipment':
        normalizedStatus = 'return_created';
        carrierReturnStage = 'return_created';
        break;
      case 'ReturningToSender':
      case 'ReturnEnRoute':
        normalizedStatus = 'returning_to_sender';
        carrierReturnStage = 'returning_to_sender';
        break;
      case 'ReturnedToSender':
      case 'ReturnToSender':
        normalizedStatus = 'returned_to_sender';
        carrierReturnStage = 'returned_to_sender';
        break;
      case 'Disposed':
      case 'ShipmentLost':
        normalizedStatus = 'cancelled';
        break;
    }

    const time = typeof b.time === 'number' ? b.time : null;
    const timestamp = time ? new Date(time * 1000) : new Date();
    const details = b.details && typeof b.details === 'object' ? b.details : {};
    const locationText = details.name || details.location || undefined;
    const notes = details.reason || details.note || undefined;
    const returnReason = (typeof details.reason === 'string' && details.reason.trim())
      || (typeof details.note === 'string' && details.note.trim())
      || undefined;
    const originalCarrierStatus = String(b.type || b.status || b.statusText || type);

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
      originalCarrierStatus,
      carrierReturnStage,
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
      if (res?.status !== 'success' || !res?.tracking) return null;
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
        } else if (text.includes('فشل') || text.includes('تعذر')) {
          normalizedStatus = 'delivery_failed';
        } else if (text.includes('وصلت') || text.includes('تكوين') || text.includes('تحويل')) {
          normalizedStatus = 'in_transit';
        }
      }

      const rawStatusText = t.shipmentStatus?.text || 'TRACKING_UPDATE';

      return {
        providerCode: this.code,
        awb: trimmed,
        eventType: rawStatusText,
        normalizedStatus,
        carrierReturnStage,
        originalCarrierStatus: rawStatusText,
        timestamp: t.deliverDate ? new Date(t.deliverDate * 1000) : new Date(),
        rawPayload: res,
      };
    } catch {
      return null;
    }
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
        return {
          providerCode: this.code,
          providerName: 'Babel Express',
          awb: trimmed,
          events: [],
          message: res?.errorMessage || 'No tracking information available for this shipment.',
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
          title: typeof u.text === 'string' ? u.text.trim() : '',
          location: typeof u.location === 'string' && u.location.trim() ? u.location.trim() : null,
          color,
          code: typeof u.code === 'string' ? u.code : null,
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
        events,
      };
    } catch (err: any) {
      return {
        providerCode: this.code,
        providerName: 'Babel Express',
        awb: trimmed,
        events: [],
        error: err?.message || 'Failed to query Babel Express tracking API.',
      };
    }
  }

  async registerWebhook(
    credentials: ShippingCredentials,
    webhookUrl: string,
    secret: string,
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const payload = {
        webhook: {
          enabled: true,
          key: secret,
          url: webhookUrl,
          subscribedEvents: [
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
          ],
        },
      };
      const res = await this.http.post<any>('registerWebhook', credentials, payload);
      if (res?.status === 'success') {
        return { ok: true, message: 'Babel Express webhook registered successfully.' };
      }
      return { ok: false, message: res?.errorMessage || 'Failed to register webhook with Babel Express.' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Error communicating with Babel Express registerWebhook.' };
    }
  }
}
