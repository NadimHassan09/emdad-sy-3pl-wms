import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  NormalizedTrackingEvent,
  ShipmentTrackingResult,
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
  ShippingCredentials,
  ShippingProvider,
  ShippingProviderCapabilities,
  ShippingQuoteInput,
  ShippingQuoteResult,
  ShippingTestResult,
} from '../../shipping-provider.interface';
import {
  DELIVERY_JOUD_CODE,
  DELIVERY_JOUD_DEFAULT_NAME,
} from './delivery-joud.constants';
import { DeliveryJoudHttpClient, JoudApiError } from './delivery-joud.http-client';
import {
  joudAreaFee,
  joudAreaName,
  mapCreateOrderParams,
  mapJoudOrderToResult,
  mapJoudStatusToNormalized,
  matchJoudArea,
  parseJoudAreaFromServiceId,
  unwrapJoudList,
  unwrapJoudOrder,
} from './delivery-joud.mapper';
import type { JoudArea, JoudOrder } from './delivery-joud.types';

@Injectable()
export class DeliveryJoudAdapter implements ShippingProvider {
  private readonly logger = new Logger(DeliveryJoudAdapter.name);
  readonly code = DELIVERY_JOUD_CODE;
  readonly capabilities: ShippingProviderCapabilities = {
    supportsQuote: true,
    supportsLabelPrinting: false,
    labelDelivery: 'carrier_provided',
    supportsTracking: true,
    supportsWebhooks: false,
  };

  constructor(private readonly http: DeliveryJoudHttpClient) {}

  async testConnection(credentials: ShippingCredentials): Promise<ShippingTestResult> {
    try {
      await this.getAreas(credentials);
      return { ok: true, message: 'Delivery Joud connection OK.' };
    } catch (err) {
      let message =
        err instanceof JoudApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Connection test failed.';
      if (/access|auth|login|password|denied|invalid/i.test(message)) {
        message = 'Delivery Joud rejected these credentials. Check login/password (and db if needed).';
      }
      return { ok: false, message };
    }
  }

  async getAreas(credentials: ShippingCredentials): Promise<JoudArea[]> {
    const result = await this.http.call<unknown>('get_areas', credentials, {}, 'GET');
    return unwrapJoudList<JoudArea>(result);
  }

  async getOrderTypes(credentials: ShippingCredentials): Promise<Array<{ id?: number | string; name?: string }>> {
    try {
      const result = await this.http.call<unknown>('order_types', credentials, {}, 'GET');
      return unwrapJoudList(result);
    } catch {
      return [];
    }
  }

  private async resolveArea(
    credentials: ShippingCredentials,
    input: {
      serviceId?: string | null;
      city?: string | null;
      governorate?: string | null;
      neighborhood?: string | null;
      address?: string | null;
    },
  ): Promise<JoudArea> {
    const areas = await this.getAreas(credentials);
    const serviceArea = parseJoudAreaFromServiceId(input.serviceId);
    const matched = matchJoudArea(areas, { ...input, serviceArea });
    if (!matched || !joudAreaName(matched)) {
      throw new BadRequestException(
        'Delivery Joud has no area matching this destination. Choose another carrier or Manual Shipping.',
      );
    }
    return matched;
  }

  async createShipment(
    credentials: ShippingCredentials,
    input: ShippingCreateShipmentInput,
  ): Promise<ShippingCreateShipmentResult> {
    const area = await this.resolveArea(credentials, {
      serviceId: input.serviceId,
      city: input.receiver.city,
      governorate: input.receiver.governorate,
      neighborhood: input.receiver.neighborhood,
      address: input.receiver.address,
    });

    let orderTypeId: string | number = '1';
    const types = await this.getOrderTypes(credentials);
    if (types.length === 1 && types[0].id != null) {
      orderTypeId = types[0].id;
    }

    const params = mapCreateOrderParams(input, joudAreaName(area), orderTypeId);
    const result = await this.http.call<unknown>('create_order', credentials, params, 'POST');
    let order = unwrapJoudOrder(result);
    let mapped = mapJoudOrderToResult(order);

    // create_order sometimes returns only a reference — re-fetch so we store the portal barcode.
    const lookupKey = mapped.awb || input.reference?.trim() || '';
    if (lookupKey && (!mapped.awb || /^OMS-/i.test(mapped.awb) || mapped.awb === input.reference?.trim())) {
      const refreshed = await this.getOrder(credentials, lookupKey);
      if (refreshed) {
        order = refreshed;
        const remapped = mapJoudOrderToResult(refreshed);
        if (remapped.awb) mapped = remapped;
      }
    }

    if (!mapped.awb) {
      // Some Olivery installs return only a success flag — fall back to reference for follow-up poll.
      if (input.reference?.trim()) {
        this.logger.warn(
          `Delivery Joud create_order returned no barcode; using reference ${input.reference} as provisional awb.`,
        );
        return { awb: input.reference.trim(), raw: result };
      }
      throw new JoudApiError('Delivery Joud create_order returned no order identity.', undefined, result);
    }
    return { ...mapped, raw: order ?? result };
  }

  async getQuote(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    const options = await this.getServiceOptions(credentials, input);
    if (!options.length) {
      throw new BadRequestException('Delivery Joud does not serve this destination.');
    }
    return options[0];
  }

  async getServiceOptions(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]> {
    const area = await this.resolveArea(credentials, {
      serviceId: input.hubId,
      city: input.city,
      governorate: input.governorate,
      neighborhood: input.neighborhood,
    });
    const name = joudAreaName(area);
    const fee = joudAreaFee(area);
    const token = area.id != null ? String(area.id) : name;
    return [
      {
        price: fee ?? 0,
        currency: 'SYP',
        serviceId: `${DELIVERY_JOUD_CODE}:${token}`,
        serviceName: `${DELIVERY_JOUD_DEFAULT_NAME} — ${name}`,
        providerName: DELIVERY_JOUD_DEFAULT_NAME,
        shippable: true,
        restrictions: fee == null ? ['area_fee_unknown'] : undefined,
        details: area,
      },
    ];
  }

  async getOrder(credentials: ShippingCredentials, orderId: string): Promise<JoudOrder | null> {
    const trimmed = orderId.trim();
    if (!trimmed) return null;
    try {
      const result = await this.http.call<unknown>(
        'order',
        credentials,
        { order_id: trimmed, id: trimmed, name: trimmed, barcode: trimmed },
        'GET',
      );
      return unwrapJoudOrder(result);
    } catch (err) {
      if (err instanceof JoudApiError && (err.statusCode === 404 || /not found/i.test(err.message))) {
        return null;
      }
      throw err;
    }
  }

  async pollTracking(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<NormalizedTrackingEvent | null> {
    const order = await this.getOrder(credentials, awb);
    if (!order) return null;
    const mapped = mapJoudOrderToResult(order);
    const status = String(order.status_name || order.status || order.state || order.delivery_state || '');
    return {
      providerCode: DELIVERY_JOUD_CODE,
      awb: mapped.awb || awb,
      eventType: status || 'status',
      normalizedStatus: mapJoudStatusToNormalized(status),
      notes: status || undefined,
      originalCarrierStatus: status || undefined,
      eventDescription: status || undefined,
      reference: order.reference_id ? String(order.reference_id) : undefined,
      costSource: 'poll',
      sourceType: 'poll',
      isCarrierEvent: true,
      rawPayload: order,
    };
  }

  async getTrackingHistory(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShipmentTrackingResult | null> {
    const order = await this.getOrder(credentials, awb);
    if (!order) return null;
    const mapped = mapJoudOrderToResult(order);
    const status = String(order.status_name || order.status || order.state || order.delivery_state || '');
    const normalized = mapJoudStatusToNormalized(status);
    return {
      providerCode: DELIVERY_JOUD_CODE,
      providerName: DELIVERY_JOUD_DEFAULT_NAME,
      awb: mapped.awb || awb,
      isDelivered: normalized === 'delivered',
      statusLabel: status || undefined,
      events: [
        {
          timestamp: new Date().toISOString(),
          title: status || 'Status',
          source: 'carrier',
          code: status || null,
        },
      ],
      lookupState: 'ok',
      shipmentState: normalized === 'cancelled' ? 'cancelled' : 'active',
      rawPayload: order,
    };
  }

  async findShipmentByReference(
    credentials: ShippingCredentials,
    reference: string,
  ): Promise<{ awb: string; trackingNumber?: string } | null> {
    const ref = reference.trim();
    if (!ref) return null;
    try {
      const result = await this.http.call<unknown>(
        'order',
        credentials,
        { reference_id: ref },
        'GET',
      );
      const order = unwrapJoudOrder(result);
      if (!order) return null;
      const mapped = mapJoudOrderToResult(order);
      if (!mapped.awb) return null;
      return { awb: mapped.awb, trackingNumber: mapped.trackingNumber };
    } catch {
      return null;
    }
  }
}
