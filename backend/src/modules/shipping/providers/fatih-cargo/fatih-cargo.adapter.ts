import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  NormalizedTrackingEvent,
  ShipmentTrackingResult,
  ShippingCancelResult,
  ShippingCreateShipmentInput,
  ShippingCreateShipmentResult,
  ShippingCredentials,
  ShippingProvider,
  ShippingProviderCapabilities,
  ShippingQuoteInput,
  ShippingQuoteResult,
  ShippingTestResult,
} from '../../shipping-provider.interface';
import { FATIH_CARGO_CODE, FATIH_CARGO_DEFAULT_NAME } from './fatih-cargo.constants';
import { FatihApiError, FatihCargoHttpClient } from './fatih-cargo.http-client';
import {
  mapCreateShipmentPayload,
  mapFatihShipmentToResult,
  mapFatihStatusToNormalized,
  matchFatihCity,
  parseFatihCityIdFromServiceId,
  pickFatihPackageType,
  pickFatihSizeCategory,
  pickFatihWeightCategory,
} from './fatih-cargo.mapper';
import type {
  FatihCity,
  FatihPackageType,
  FatihQuoteResult,
  FatihShipment,
  FatihSizeCategory,
  FatihWeightCategory,
} from './fatih-cargo.types';
import {
  buildFatihNormalizedEvent,
  isFatihWebhookTest,
  verifyFatihSignature,
} from './fatih-cargo.webhook.util';

@Injectable()
export class FatihCargoAdapter implements ShippingProvider {
  private readonly logger = new Logger(FatihCargoAdapter.name);
  readonly code = FATIH_CARGO_CODE;
  readonly capabilities: ShippingProviderCapabilities = {
    supportsQuote: true,
    supportsLabelPrinting: false,
    labelDelivery: 'carrier_provided',
    supportsTracking: true,
    supportsWebhooks: true,
  };

  constructor(private readonly http: FatihCargoHttpClient) {}

  async testConnection(credentials: ShippingCredentials): Promise<ShippingTestResult> {
    try {
      await this.http.get<{ data?: unknown }>('me', credentials);
      return { ok: true, message: 'Fatih Cargo connection OK.' };
    } catch (err) {
      let message =
        err instanceof FatihApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Connection test failed.';
      if (/unauthorized|401|invalid|forbidden|403/i.test(message)) {
        message = 'Fatih Cargo rejected these credentials. Check your API key (fc_live_…).';
      }
      return { ok: false, message };
    }
  }

  async getCities(credentials: ShippingCredentials): Promise<FatihCity[]> {
    const res = await this.http.get<{ data?: FatihCity[] }>('cities', credentials);
    return Array.isArray(res?.data) ? res.data : [];
  }

  async getPackageTypes(credentials: ShippingCredentials): Promise<FatihPackageType[]> {
    const res = await this.http.get<{ data?: FatihPackageType[] }>('package-types', credentials);
    return Array.isArray(res?.data) ? res.data : [];
  }

  async getWeightCategories(credentials: ShippingCredentials): Promise<FatihWeightCategory[]> {
    const res = await this.http.get<{ data?: FatihWeightCategory[] }>('weight-categories', credentials);
    return Array.isArray(res?.data) ? res.data : [];
  }

  async getSizeCategories(credentials: ShippingCredentials): Promise<FatihSizeCategory[]> {
    const res = await this.http.get<{ data?: FatihSizeCategory[] }>('size-categories', credentials);
    return Array.isArray(res?.data) ? res.data : [];
  }

  private async resolvePackageIds(
    credentials: ShippingCredentials,
    input: { packageType: 'box' | 'envelope'; weightKg: number },
  ): Promise<{ typeId: number; weightId: number; sizeId: number }> {
    const [types, weights, sizes] = await Promise.all([
      this.getPackageTypes(credentials),
      this.getWeightCategories(credentials),
      this.getSizeCategories(credentials),
    ]);
    const type = pickFatihPackageType(types, input.packageType);
    const weight = pickFatihWeightCategory(weights, input.weightKg);
    const size = pickFatihSizeCategory(sizes);
    if (!type || !weight || !size) {
      throw new BadRequestException(
        'Fatih Cargo reference data is incomplete (package type / weight / size). Reconnect or contact Fatih.',
      );
    }
    return { typeId: type.id, weightId: weight.id, sizeId: size.id };
  }

  private async resolveCityId(
    credentials: ShippingCredentials,
    input: {
      serviceId?: string | null;
      city?: string | null;
      governorate?: string | null;
      neighborhood?: string | null;
      address?: string | null;
    },
  ): Promise<{ cityId: number; cityName: string }> {
    let cityId = parseFatihCityIdFromServiceId(input.serviceId);
    if (cityId) {
      return { cityId, cityName: `city:${cityId}` };
    }
    const cities = await this.getCities(credentials);
    const matched = matchFatihCity(cities, input);
    if (!matched) {
      throw new BadRequestException(
        'Fatih Cargo has no city matching this destination. Choose another carrier or Manual Shipping.',
      );
    }
    return { cityId: matched.id, cityName: matched.name };
  }

  async createShipment(
    credentials: ShippingCredentials,
    input: ShippingCreateShipmentInput,
  ): Promise<ShippingCreateShipmentResult> {
    const { cityId } = await this.resolveCityId(credentials, {
      serviceId: input.serviceId,
      city: input.receiver.city,
      governorate: input.receiver.governorate,
      neighborhood: input.receiver.neighborhood,
      address: input.receiver.address,
    });
    const pkg = await this.resolvePackageIds(credentials, {
      packageType: input.packageType,
      weightKg: input.weightKg,
    });
    const payload = mapCreateShipmentPayload(
      input,
      cityId,
      pkg.typeId,
      pkg.weightId,
      pkg.sizeId,
    );

    const idempotencyKey =
      input.reference?.trim() || `fatih-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const res = await this.http.post<{ data?: FatihShipment }>(
      'shipments',
      credentials,
      payload,
      { 'Idempotency-Key': idempotencyKey },
    );

    const shipment = res?.data;
    if (!shipment?.id && !shipment?.tracking_number) {
      throw new FatihApiError('Fatih Cargo create shipment returned no shipment data.', undefined, res);
    }
    return mapFatihShipmentToResult(shipment!);
  }

  async getQuote(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    const options = await this.getServiceOptions(credentials, input);
    if (!options.length) {
      throw new BadRequestException('Fatih Cargo does not serve this destination.');
    }
    return options[0];
  }

  async getServiceOptions(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]> {
    const { cityId, cityName } = await this.resolveCityId(credentials, {
      serviceId: input.hubId,
      city: input.city,
      governorate: input.governorate,
      neighborhood: input.neighborhood,
    });
    const pkg = await this.resolvePackageIds(credentials, {
      packageType: input.packageType,
      weightKg: input.weightKg,
    });

    const codAmount =
      input.codAmount && Number.isFinite(Number(input.codAmount)) ? Number(input.codAmount) : 0;
    const currency = (input.currency || 'USD').trim().toUpperCase() || 'USD';

    const body: Record<string, unknown> = {
      recipient: {
        city_id: cityId,
        pickup_at_branch: input.deliveryType === 'hub',
      },
      package: {
        type_id: pkg.typeId,
        weight_category_id: pkg.weightId,
        size_category_id: pkg.sizeId,
        count: Array.isArray(input.parts) && input.parts.length > 1 ? input.parts.length : 1,
      },
      shipping_fee_paid_by: 'sender',
    };
    if (codAmount > 0) {
      body.cod = { amount: codAmount, currency };
      (body.package as Record<string, unknown>).declared_value = { amount: codAmount, currency };
    }

    const res = await this.http.post<{ data?: FatihQuoteResult }>('shipments/quote', credentials, body);
    const data = res?.data;
    const fee = data?.shipping_fee;
    const amount = fee?.amount != null && Number.isFinite(Number(fee.amount)) ? Number(fee.amount) : 0;
    const feeCurrency = (fee?.currency || currency).toUpperCase();
    const pending = data?.pending_manual_pricing === true;
    const days =
      data?.expected_delivery?.available && data.expected_delivery.average_days != null
        ? Number(data.expected_delivery.average_days)
        : undefined;

    return [
      {
        price: amount,
        currency: feeCurrency,
        serviceId: `${FATIH_CARGO_CODE}:${cityId}`,
        serviceName: `${FATIH_CARGO_DEFAULT_NAME} — ${cityName}`,
        providerName: FATIH_CARGO_DEFAULT_NAME,
        shippable: !pending || amount > 0 || true,
        estimatedDeliveryMin: days,
        estimatedDeliveryMax: days,
        restrictions: pending ? ['pending_manual_pricing'] : undefined,
        details: data,
      },
    ];
  }

  async getShipment(credentials: ShippingCredentials, idOrTracking: string): Promise<FatihShipment | null> {
    const trimmed = idOrTracking.trim();
    if (!trimmed) return null;
    try {
      const res = await this.http.get<{ data?: FatihShipment }>(
        `shipments/${encodeURIComponent(trimmed)}`,
        credentials,
      );
      return res?.data || null;
    } catch (err) {
      if (err instanceof FatihApiError && (err.statusCode === 404 || /not found/i.test(err.message))) {
        return null;
      }
      throw err;
    }
  }

  async findShipmentByReference(
    credentials: ShippingCredentials,
    reference: string,
  ): Promise<{ awb: string; trackingNumber?: string } | null> {
    const ref = reference.trim();
    if (!ref) return null;
    try {
      const res = await this.http.get<{ data?: FatihShipment[] }>('shipments', credentials, {
        reference: ref,
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      const hit = list.find((s) => (s.reference || '').trim() === ref) || list[0];
      if (!hit) return null;
      const result = mapFatihShipmentToResult(hit);
      return { awb: result.awb, trackingNumber: result.trackingNumber };
    } catch (err) {
      this.logger.warn(
        `Fatih findShipmentByReference failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async pollTracking(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<NormalizedTrackingEvent | null> {
    const shipment = await this.getShipment(credentials, awb);
    if (!shipment) return null;
    const status = (shipment.status || '').trim();
    return {
      providerCode: FATIH_CARGO_CODE,
      awb: mapFatihShipmentToResult(shipment).awb,
      eventType: status || 'status',
      normalizedStatus: mapFatihStatusToNormalized(status),
      timestamp: shipment.status_changed_at ? new Date(shipment.status_changed_at) : undefined,
      notes: shipment.status_label || undefined,
      originalCarrierStatus: status || undefined,
      eventDescription: shipment.status_label || undefined,
      reference: shipment.reference || undefined,
      costSource: 'poll',
      sourceType: 'poll',
      isCarrierEvent: true,
      rawPayload: shipment,
    };
  }

  async getTrackingHistory(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShipmentTrackingResult | null> {
    const shipment = await this.getShipment(credentials, awb);
    if (!shipment) return null;
    const mapped = mapFatihShipmentToResult(shipment);
    const status = (shipment.status || '').trim();
    const normalized = mapFatihStatusToNormalized(status);
    return {
      providerCode: FATIH_CARGO_CODE,
      providerName: FATIH_CARGO_DEFAULT_NAME,
      awb: mapped.awb,
      isDelivered: normalized === 'delivered',
      statusLabel: shipment.status_label || status || undefined,
      events: [
        {
          timestamp: (shipment.status_changed_at || shipment.updated_at || new Date().toISOString()) as string,
          title: shipment.status_label || status || 'Status',
          source: 'carrier',
          code: status || null,
        },
      ],
      lookupState: 'ok',
      shipmentState: normalized === 'cancelled' ? 'cancelled' : 'active',
      rawPayload: shipment,
    };
  }

  async cancelShipment(
    credentials: ShippingCredentials,
    providerId: string,
  ): Promise<ShippingCancelResult> {
    const id = providerId.trim();
    if (!id) {
      return { outcome: 'refused', message: 'Missing Fatih shipment id.' };
    }
    try {
      const res = await this.http.post<{ data?: FatihShipment }>(
        `shipments/${encodeURIComponent(id)}/cancel`,
        credentials,
        { reason: 'Cancelled from EMDAD WMS' },
      );
      const status = (res?.data?.status || '').toLowerCase();
      if (status === 'canceled' || status === 'cancelled') {
        return { outcome: 'cancelled', message: 'Fatih Cargo cancelled the shipment.', raw: res };
      }
      return {
        outcome: 'pending_confirmation',
        message: 'Fatih Cargo accepted cancel request; confirm status in portal.',
        raw: res,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/409|not_cancellable|not cancellable/i.test(msg)) {
        return { outcome: 'refused', message: msg, errorCode: 'shipment_not_cancellable', raw: err };
      }
      if (/already.*cancel/i.test(msg)) {
        return { outcome: 'already_cancelled', message: msg, raw: err };
      }
      return { outcome: 'refused', message: msg, raw: err };
    }
  }

  normalizeWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): NormalizedTrackingEvent | null {
    return buildFatihNormalizedEvent(headers, body);
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    secret?: string,
  ): boolean {
    if (isFatihWebhookTest(typeof rawBody === 'string' ? tryParse(rawBody) : tryParse(rawBody.toString('utf8')))) {
      // Still require a valid signature when secret is configured.
    }
    return verifyFatihSignature(headers, rawBody, secret);
  }
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
