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
  mapCalculatePricePayload,
  mapCreateShipmentPayload,
} from './babel-shipment.mapper';

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
    const payload = mapCreateShipmentPayload(input);
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
    const payload = mapCalculatePricePayload(input);
    const raw = await this.http.post<{
      status?: string;
      price?: number;
      currency?: string;
      details?: unknown;
    }>('calculatePrice', credentials, payload);
    const price = typeof raw?.price === 'number' ? raw.price : Number(raw?.price);
    if (!Number.isFinite(price)) {
      throw new BabelApiError('Babel Express calculatePrice missing price.', undefined, raw);
    }
    return {
      price,
      currency: typeof raw?.currency === 'string' ? raw.currency : 'USD',
      details: raw?.details,
    };
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
