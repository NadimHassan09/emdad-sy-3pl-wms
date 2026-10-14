import { Injectable } from '@nestjs/common';

import { MOCK_CARRIER_CODE } from '../../shipping.constants';
import type {
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
  ShippingCredentials,
  ShippingProvider,
  ShippingProviderCapabilities,
  ShippingQuoteInput,
  ShippingQuoteResult,
  ShippingTestResult,
} from '../../shipping-provider.interface';

/**
 * In-process carrier for ACME client fixtures. No HTTP client and no fallback to Sila or Babel.
 * Registered only when SHIPPING_MOCK_ENABLED=true.
 *
 * Reference prefixes select the scripted result:
 * MOCK-ADDRESS, MOCK-PAYER, MOCK-COD, MOCK-COVERAGE, MOCK-TIMEOUT, MOCK-FIELD, MOCK-OK.
 */
@Injectable()
export class MockCarrierAdapter implements ShippingProvider {
  readonly code = MOCK_CARRIER_CODE;
  readonly capabilities: ShippingProviderCapabilities = {
    supportsQuote: true,
    supportsLabelPrinting: false,
    labelDelivery: 'none',
    supportsTracking: false,
    supportsWebhooks: false,
  };

  async testConnection(_credentials: ShippingCredentials): Promise<ShippingTestResult> {
    return { ok: true, message: 'MOCK_CARRIER is in-process' };
  }

  async getQuote(
    _credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    return {
      price: 1,
      currency: input.currency || 'USD',
      serviceId: `${MOCK_CARRIER_CODE}:home`,
      serviceName: 'Mock home',
      providerName: 'Mock Carrier',
    };
  }

  async getServiceOptions(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]> {
    return [await this.getQuote(credentials, input)];
  }

  async findShipmentByReference(
    _credentials: ShippingCredentials,
    reference: string,
  ): Promise<{ awb: string; trackingNumber?: string } | null> {
    if (reference.includes('MOCK-TIMEOUT-FOUND')) {
      return { awb: `MOCK-AWB-${reference}`, trackingNumber: `MOCK-TRK-${reference}` };
    }
    return null;
  }

  async createShipment(
    _credentials: ShippingCredentials,
    input: ShippingCreateShipmentInput,
  ): Promise<ShippingCreateShipmentResult> {
    const reference = input.reference ?? '';
    if (reference.includes('MOCK-TIMEOUT')) {
      throw new Error('timeout waiting for carrier response');
    }
    if (reference.includes('MOCK-ADDRESS')) {
      throw new Error('recipient.area_id is a whole province — choose a city or neighbourhood');
    }
    if (reference.includes('MOCK-PAYER')) {
      throw new Error('Payer as sender is not available. Choose receiver or reseller.');
    }
    if (reference.includes('MOCK-COD')) {
      throw new Error('COD amount is below the carrier minimum of 1000');
    }
    if (reference.includes('MOCK-COVERAGE')) {
      throw new Error(
        'courier_not_available_for_area because COD currency USD does not match carrier quote currency SYP',
      );
    }
    if (reference.includes('MOCK-FIELD')) {
      throw new Error('receiver phone is invalid');
    }
    return {
      awb: `MOCK-AWB-${reference || 'OK'}`,
      trackingNumber: `MOCK-TRK-${reference || 'OK'}`,
      raw: {
        provider: MOCK_CARRIER_CODE,
        reference,
        payer: input.payer,
        currency: input.currency ?? null,
        codAmount: input.codAmount,
        deliveryType: input.deliveryType,
      },
    };
  }
}
