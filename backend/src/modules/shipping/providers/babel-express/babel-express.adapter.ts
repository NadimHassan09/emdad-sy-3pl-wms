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
  ShippingTestResult,
} from '../../shipping-provider.interface';
import { BABEL_EXPRESS_CODE } from '../../shipping.constants';
import { BabelApiError, BabelExpressHttpClient } from './babel-express.http-client';
import {
  isBabelAddressDeliveryAvailable,
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

  async testConnection(credentials: ShippingCredentials): Promise<ShippingTestResult> {
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
      // Babel returns a bare "Unauthorized" for bad Basic Auth — make it actionable in Admin UI.
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
        packageType: input.packageType,
        weightKg: input.weightKg,
        deliveryType: 'address',
        pickupType: input.pickupType,
      });
      const probeRaw = await this.http.post<{ details?: unknown }>(
        'calculatePrice',
        credentials,
        probe,
      );
      if (!isBabelAddressDeliveryAvailable(probeRaw?.details)) {
        deliveryType = 'hub';
      }
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
    const requestQuote = async (deliveryType: 'address' | 'hub') => {
      const payload = mapCalculatePricePayload({ ...input, deliveryType });
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

    if (input.deliveryType === 'address' && !isBabelAddressDeliveryAvailable(raw?.details)) {
      raw = await requestQuote('hub');
      effectiveDeliveryType = 'hub';
      restrictions = [
        'Door delivery is not available at this pin. Hub delivery applies (customer collects from a Babel hub).',
      ];
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
    };
  }

  private async lookupNeighbourhoodId(
    credentials: ShippingCredentials,
    lat: number,
    lng: number,
  ): Promise<number> {
    const raw = await this.http.post<{
      neighbourhood?: { id?: number };
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

  /**
   * Prefer printable PDF; fall back to AWB link. Returns null if neither is available.
   * Does not invent labels.
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
