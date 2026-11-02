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
  UnifiedShipmentMovementEvent,
} from '../../shipping-provider.interface';
import { SENA_EXPRESS_CODE } from '../../shipping.constants';
import { SenaApiError, SenaExpressHttpClient } from './sena-express.http-client';
import {
  mapCreateShipmentPayload,
  mapSenaShipmentToResult,
  mapSenaStatusToNormalized,
  matchSenaZone,
  parseSenaZoneIdFromServiceId,
} from './sena-express.mapper';
import type {
  SenaDeliveryZone,
  SenaPickupAddress,
  SenaShipment,
  SenaShipmentStatusDict,
  SenaStockItem,
} from './sena-express.types';
import {
  buildSenaNormalizedEvent,
  verifySenaSignature,
} from './sena-express.webhook.util';

@Injectable()
export class SenaExpressAdapter implements ShippingProvider {
  private readonly logger = new Logger(SenaExpressAdapter.name);
  readonly code = SENA_EXPRESS_CODE;
  readonly capabilities: ShippingProviderCapabilities = {
    supportsQuote: true,
    supportsLabelPrinting: false,
    labelDelivery: 'carrier_provided',
    supportsTracking: true,
    supportsWebhooks: true,
  };

  constructor(private readonly http: SenaExpressHttpClient) {}

  async testConnection(credentials: ShippingCredentials): Promise<ShippingTestResult> {
    try {
      await this.getDeliveryZones(credentials);
      return { ok: true, message: 'SENA Express connection OK.' };
    } catch (err) {
      let message =
        err instanceof SenaApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Connection test failed.';
      if (/unauthorized|invalid api key/i.test(message.trim())) {
        message = 'SENA Express rejected these credentials. Check your SENA API Key.';
      }
      return { ok: false, message };
    }
  }

  async getDeliveryZones(credentials: ShippingCredentials): Promise<SenaDeliveryZone[]> {
    const res = await this.http.get<{
      status?: string;
      data?: { zones?: SenaDeliveryZone[] };
      zones?: SenaDeliveryZone[];
    }>('zones', credentials);
    return res?.data?.zones || res?.zones || [];
  }

  async getPickupAddresses(credentials: ShippingCredentials): Promise<SenaPickupAddress[]> {
    const res = await this.http.get<{
      status?: string;
      data?: { pickup_addresses?: SenaPickupAddress[] };
      pickup_addresses?: SenaPickupAddress[];
    }>('pickup-addresses', credentials);
    return res?.data?.pickup_addresses || res?.pickup_addresses || [];
  }

  async getStockItems(credentials: ShippingCredentials): Promise<SenaStockItem[]> {
    const res = await this.http.get<{
      status?: string;
      data?: { stock_items?: SenaStockItem[] };
      stock_items?: SenaStockItem[];
    }>('stock-items', credentials);
    return res?.data?.stock_items || res?.stock_items || [];
  }

  async getShipmentStatuses(credentials: ShippingCredentials): Promise<SenaShipmentStatusDict[]> {
    const res = await this.http.get<{
      status?: string;
      statuses?: SenaShipmentStatusDict[];
      data?: { statuses?: SenaShipmentStatusDict[] };
    }>('shipment-statuses', credentials);
    return res?.statuses || res?.data?.statuses || [];
  }

  async getShipment(credentials: ShippingCredentials, shipmentNumber: string): Promise<SenaShipment | null> {
    const trimmed = shipmentNumber.trim();
    if (!trimmed) return null;
    try {
      const res = await this.http.get<{
        status?: string;
        data?: { shipment?: SenaShipment };
        shipment?: SenaShipment;
      }>(`shipments/${encodeURIComponent(trimmed)}`, credentials);
      return res?.data?.shipment || res?.shipment || null;
    } catch (err) {
      if (err instanceof SenaApiError && (err.statusCode === 404 || /not found/i.test(err.message))) {
        return null;
      }
      throw err;
    }
  }

  async listShipments(
    credentials: ShippingCredentials,
    query?: { from?: string; to?: string; status?: string; updated_since?: string },
  ): Promise<SenaShipment[]> {
    const res = await this.http.get<{
      status?: string;
      data?: { shipments?: SenaShipment[] } | SenaShipment[];
      shipments?: SenaShipment[];
    }>('shipments', credentials, query);
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray((res?.data as { shipments?: SenaShipment[] })?.shipments)) {
      return (res.data as { shipments: SenaShipment[] }).shipments;
    }
    return res?.shipments || [];
  }

  async createShipment(
    credentials: ShippingCredentials,
    input: ShippingCreateShipmentInput,
  ): Promise<ShippingCreateShipmentResult> {
    let zoneId = parseSenaZoneIdFromServiceId(input.serviceId);

    if (!zoneId) {
      const zones = await this.getDeliveryZones(credentials);
      const matched = matchSenaZone(zones, {
        city: input.receiver.city,
        governorate: input.receiver.governorate,
        neighborhood: input.receiver.neighborhood,
        address: input.receiver.address,
      });
      zoneId = matched ? matched.id : 1;
    }

    const payload = mapCreateShipmentPayload(input, zoneId);

    const res = await this.http.post<{
      status?: string;
      data?: { shipment?: SenaShipment };
      shipment?: SenaShipment;
    }>('shipments', credentials, payload);

    const shipment = res?.data?.shipment || res?.shipment;
    if (!shipment) {
      throw new SenaApiError('SENA Express create shipment succeeded without shipment data in response.', undefined, res);
    }

    if (shipment.idempotent === true) {
      this.logger.log(
        `SENA Express createShipment returned existing shipment for reference=${input.reference} (idempotent=true, shipment_number=${shipment.shipment_number})`,
      );
    }

    return mapSenaShipmentToResult(shipment);
  }

  async getQuote(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    const options = await this.getServiceOptions(credentials, input);
    if (options.length === 0) {
      throw new BadRequestException('SENA Express has no available delivery zones for this merchant.');
    }

    const preferredZoneId = parseSenaZoneIdFromServiceId(input.hubId);
    if (preferredZoneId) {
      const found = options.find((opt) => opt.serviceId === `${this.code}:${preferredZoneId}`);
      if (found) return found;
    }

    return options[0];
  }

  async getServiceOptions(
    credentials: ShippingCredentials,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult[]> {
    const zones = await this.getDeliveryZones(credentials);
    const currency = input.currency?.trim() || 'SYP';
    if (zones.length === 0) {
      return [
        {
          price: 0,
          currency,
          effectiveDeliveryType: 'address' as const,
          shippable: true,
          serviceId: `${this.code}:1`,
          serviceName: 'شركة سينا (SENA Express)',
          providerName: 'شركة سينا (SENA Express)',
        },
      ];
    }

    const matchedZone = matchSenaZone(zones, {
      city: input.city,
      governorate: input.governorate,
      neighborhood: input.neighborhood,
    });

    const orderedZones = matchedZone
      ? [matchedZone, ...zones.filter((z) => z.id !== matchedZone.id)]
      : zones;

    return orderedZones.map((z) => {
      const price = Number(z.delivery_price ?? 0);
      const zoneName = (z.display_name || z.name || '').trim();
      const cleanZoneName = zoneName
        ? (zoneName.includes('سينا') || zoneName.toLowerCase().includes('sena')
            ? zoneName
            : `شركة سينا - ${zoneName}`)
        : `شركة سينا (Zone ${z.id})`;
      return {
        price,
        currency,
        effectiveDeliveryType: 'address' as const,
        shippable: true,
        serviceId: `${this.code}:${z.id}`,
        serviceName: cleanZoneName,
        providerName: 'شركة سينا (SENA Express)',
      };
    });
  }

  async pollTracking(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<NormalizedTrackingEvent | null> {
    const shipment = await this.getShipment(credentials, awb);
    if (!shipment) return null;

    const normalizedStatus = mapSenaStatusToNormalized(shipment.status);
    const occurredAt = new Date();

    const eventDescription = shipment.public_status || shipment.status || 'Status update';

    return {
      providerCode: this.code,
      awb: String(shipment.shipment_number || awb).trim(),
      eventType: 'shipment.status.updated',
      normalizedStatus,
      timestamp: occurredAt,
      originalCarrierStatus: shipment.status,
      eventDescription,
      sourceType: 'poll',
      isCarrierEvent: true,
      notes: shipment.public_status || undefined,
      reference: shipment.reference || shipment.merchant_reference || undefined,
      rawPayload: shipment,
    };
  }

  async getTrackingHistory(
    credentials: ShippingCredentials,
    awb: string,
  ): Promise<ShipmentTrackingResult | null> {
    const trimmed = awb.trim();
    if (!trimmed) return null;

    try {
      const shipment = await this.getShipment(credentials, trimmed);
      if (!shipment) {
        return {
          providerCode: this.code,
          providerName: 'SENA Express',
          awb: trimmed,
          events: [],
          lookupState: 'not_found',
          shipmentState: 'active',
          cancellationUnconfirmed: true,
          message: 'The carrier did not return this shipment.',
        };
      }

      const events: UnifiedShipmentMovementEvent[] = [];
      const rawTimeline = Array.isArray(shipment.timeline) ? shipment.timeline : [];

      for (const item of rawTimeline) {
        let color: 'default' | 'info' | 'success' | 'error' | 'warning' = 'default';
        const rawStatus = (item.status || '').toLowerCase();
        if (rawStatus === 'delivered') color = 'success';
        else if (
          rawStatus === 'delivery_failed' ||
          rawStatus === 'refused' ||
          rawStatus === 'cancelled' ||
          rawStatus === 'shipment_problem'
        ) {
          color = 'error';
        } else if (rawStatus === 'out_for_delivery' || rawStatus === 'in_return') {
          color = 'warning';
        } else if (rawStatus === 'in_transit' || rawStatus === 'pending') {
          color = 'info';
        }

        const timestamp = item.occurred_at || item.timestamp || new Date().toISOString();
        const title = item.public_status || item.status || 'Status update';

        events.push({
          timestamp,
          title,
          originalDescription: item.public_status || item.status || null,
          location: item.location || null,
          notes: item.note || null,
          color,
          code: item.status || null,
          source: 'carrier',
        });
      }

      if (events.length === 0) {
        let color: 'default' | 'info' | 'success' | 'error' | 'warning' = 'default';
        const s = (shipment.status || '').toLowerCase();
        if (s === 'delivered') color = 'success';
        else if (s === 'refused' || s === 'client_no_response' || s === 'phone_off') color = 'error';
        else if (s === 'out_for_delivery') color = 'warning';
        else if (s === 'pending' || s === 'awaiting_pickup') color = 'info';

        events.push({
          timestamp: new Date().toISOString(),
          title: shipment.public_status || shipment.status,
          originalDescription: shipment.public_status || shipment.status || null,
          location: shipment.delivery_zone?.name || null,
          color,
          code: shipment.status,
          source: 'carrier',
        });
      }

      // Sort descending (newest first)
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      let statusColor = '#3b82f6';
      if (shipment.status === 'delivered') statusColor = '#22c55e';
      else if (
        shipment.status === 'refused' ||
        shipment.status === 'client_no_response' ||
        shipment.status === 'phone_off'
      ) {
        statusColor = '#ef4444';
      }

      return {
        providerCode: this.code,
        providerName: 'SENA Express',
        awb: String(shipment.shipment_number || trimmed),
        isDelivered: shipment.status === 'delivered',
        statusLabel: shipment.public_status || shipment.status,
        statusColor,
        lookupState: 'ok',
        shipmentState: 'active',
        cancellationUnconfirmed: false,
        events,
        rawPayload: shipment,
      };
    } catch (err: any) {
      const message = err?.message || 'Failed to query SENA Express tracking API.';
      return {
        providerCode: this.code,
        providerName: 'SENA Express',
        awb: trimmed,
        events: [],
        lookupState: 'error',
        shipmentState: 'active',
        message,
        error: message,
      };
    }
  }

  async findShipmentByReference(
    credentials: ShippingCredentials,
    reference: string,
  ): Promise<{ awb: string; trackingNumber?: string } | null> {
    const trimmed = reference.trim();
    if (!trimmed) return null;

    try {
      const shipments = await this.listShipments(credentials);
      const match = shipments.find(
        (s) =>
          s.reference === trimmed ||
          s.merchant_reference === trimmed ||
          s.shipment_reference === trimmed,
      );
      if (match) {
        const awb = String(match.shipment_number || match.id);
        return {
          awb,
          trackingNumber: match.shipment_number || match.shipment_reference || awb,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    secret?: string,
  ): boolean {
    return verifySenaSignature(headers, rawBody, secret);
  }

  normalizeWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): NormalizedTrackingEvent | null {
    return buildSenaNormalizedEvent(headers, body);
  }

  async cancelShipment(
    _credentials: ShippingCredentials,
    _providerId: string,
  ): Promise<ShippingCancelResult> {
    return {
      outcome: 'refused',
      message:
        'SENA Express Merchant API does not support automated cancellation via API. Please cancel the shipment directly in the SENA merchant portal.',
    };
  }
}
