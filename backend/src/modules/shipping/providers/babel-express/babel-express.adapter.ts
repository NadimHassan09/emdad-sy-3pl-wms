import { Injectable } from '@nestjs/common';

import type {
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
  ShippingCredentials,
  ShippingLabelResult,
  ShippingProvider,
  ShippingProviderCapabilities,
  ShippingQuoteInput,
  ShippingQuoteResult,
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
   * Quote both address and hub options for a neighbourhood (for Shipping Details UI).
   */
  async getServiceOptions(
    credentials: ShippingCredentials,
    input: Omit<ShippingQuoteInput, 'deliveryType'>,
  ): Promise<ShippingQuoteResult[]> {
    let neighbourhoodId = input.neighbourhoodId;
    if (neighbourhoodId == null) {
      neighbourhoodId = await this.lookupNeighbourhoodId(
        credentials,
        input.receiverLat,
        input.receiverLng,
      );
    }

    const options: ShippingQuoteResult[] = [];
    for (const deliveryType of ['address', 'hub'] as const) {
      const payload = mapCalculatePricePayload({
        ...input,
        neighbourhoodId,
        deliveryType,
        pickupType: 'hub',
      });
      try {
        const raw = await this.http.post<{
          status?: string;
          price?: number;
          currency?: string;
          details?: unknown;
        }>('calculatePrice', credentials, payload);
        if (!isBabelCalculatePriceShippable(raw, deliveryType)) continue;
        const price = typeof raw.price === 'number' ? raw.price : Number(raw.price);
        if (!Number.isFinite(price)) continue;
        options.push({
          price,
          currency: typeof raw.currency === 'string' ? raw.currency : 'SYP',
          details: raw.details,
          effectiveDeliveryType: deliveryType,
          serviceId: `${BABEL_EXPRESS_CODE}:${deliveryType}`,
          serviceName: deliveryTypeLabel(deliveryType),
          shippable: true,
          neighbourhoodId,
        });
      } catch {
        // Option not offered — skip.
      }
    }
    return options;
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
}
