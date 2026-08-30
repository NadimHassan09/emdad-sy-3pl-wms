import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CarrierShipmentStatus,
  Prisma,
  ShippingMethod,
  ShippingProviderConnectionStatus,
} from '@prisma/client';

import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { composeDestinationAddress } from '../oms/oms-order.mapper';
import { BabelAddressAdapter } from './providers/babel-express/babel-address.adapter';
import { AddressResolveService } from './address-resolve.service';
import { BabelApiError } from './providers/babel-express/babel-express.http-client';
import { parsePhoneForBabel, resolveBabelCodCurrency } from './providers/babel-express/babel-shipment.mapper';
import { BABEL_EXPRESS_CODE, ShippingProviderRegistry } from './shipping-provider.registry';
import { assertCarrierShippingReady, type ShippingConfigFields } from './shipping-config.util';
import type { QuoteShippingRatesDto } from './dto/quote-shipping-rates.dto';
import { ShippingGeoService, type AreaBoundary } from './shipping-geo.service';
import {
  annotateRateQuotes,
  type ShippingRateError,
  type ShippingRateQuote,
} from './shipping-rate.util';
import {
  babelPartsFromCartons,
  buildPhysicalShipmentParts,
  toBabelWeightParts,
} from './shipment-parts.util';
import { parseShippingCartons } from './shipping-cartons.types';

export type ShippingProviderAdminView = {
  code: string;
  name: string;
  enabled: boolean;
  status: 'disconnected' | 'connected';
  connected: boolean;
  usernameMasked: string | null;
  connectedBy: { id: string; email: string; fullName: string } | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastErrorSafe: string | null;
};

function maskUsername(username: string | null | undefined): string | null {
  if (!username) return null;
  if (username.length <= 2) return '*'.repeat(username.length);
  return `${username.slice(0, 2)}${'*'.repeat(Math.min(8, username.length - 2))}`;
}

function safeErrorMessage(err: unknown): string {
  const raw =
    err instanceof BabelApiError
      ? err.message
      : err instanceof Error
        ? err.message
        : 'Shipping provider request failed.';
  const msg = raw.slice(0, 500);
  // Babel returns this opaque string for several causes; weight is the most common local mistake.
  if (/no shipping service available/i.test(msg)) {
    return `${msg} Usually the package weight is too high (use real kg, max ~200), or the pin is outside Babel coverage, or delivery/pickup type is wrong.`;
  }
  return msg;
}

function publicCarrierRateError(safe: string): string {
  const msg = safe.trim().slice(0, 500);
  if (/no shipping service available/i.test(msg)) {
    return 'This carrier does not currently serve this destination or shipment.';
  }
  if (
    msg &&
    !/unauthorized|password|credential|decrypt|token|secret/i.test(msg)
  ) {
    return msg;
  }
  return 'Unable to retrieve rates right now.';
}

function deliveryTypeLabel(type: string): string {
  if (type === 'hub') return 'Hub';
  if (type === 'address') return 'Address';
  return type;
}

function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export type QuoteDestinationRatesResult = {
  inSelectedArea: boolean | null;
  quotes: ShippingRateQuote[];
  errors: ShippingRateError[];
};

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly registry: ShippingProviderRegistry,
    private readonly realtime: RealtimeService,
    private readonly geo: ShippingGeoService,
    private readonly babelAddress: BabelAddressAdapter,
    private readonly addressResolve: AddressResolveService,
  ) {}

  private readonly rateCache = new Map<
    string,
    { at: number; value: QuoteDestinationRatesResult }
  >();

  async lookupAreaBoundary(params: {
    governorate?: string | null;
    city?: string | null;
    neighborhood?: string | null;
  }): Promise<AreaBoundary | null> {
    return this.geo.lookupBoundary(params);
  }

  /** Internal Syria hierarchy → stored lat/lng for carrier adapters. */
  resolveReceiverCoordinatesFromAddress(input: {
    governorate?: string | null;
    cityRegion?: string | null;
    townNeighborhood?: string | null;
  }): { lat: number; lng: number } | null {
    const result = this.addressResolve.resolveFromAddress(input);
    if (!result.found) return null;
    return { lat: result.lat, lng: result.lng };
  }

  /**
   * Quote every connected adapter independently. One carrier failure does not fail the rest.
   */
  async quoteDestinationRates(dto: QuoteShippingRatesDto): Promise<QuoteDestinationRatesResult> {
    const cacheKey = JSON.stringify({
      lat: dto.receiverLat != null ? roundCoord(dto.receiverLat) : null,
      lng: dto.receiverLng != null ? roundCoord(dto.receiverLng) : null,
      neighbourhoodId: dto.neighbourhoodId ?? null,
      packageType: dto.packageType,
      weightKg: dto.weightKg,
      deliveryType: dto.deliveryType,
      pickupType: dto.pickupType ?? null,
      volumeCbm: dto.volumeCbm ?? null,
      codAmount: dto.codAmount ?? null,
      parts: dto.parts?.map((p) => Number(p.weight)) ?? null,
      gov: dto.governorate?.trim() || '',
      city: dto.city?.trim() || '',
      hood: dto.neighborhood?.trim() || '',
    });
    const cached = this.rateCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 60_000) {
      return cached.value;
    }

    const hasAddressNames = Boolean(
      dto.governorate?.trim() && dto.city?.trim(),
    );

    let receiverLat: number | null = null;
    let receiverLng: number | null = null;
    if (hasAddressNames) {
      const resolved = this.resolveReceiverCoordinatesFromAddress({
        governorate: dto.governorate,
        cityRegion: dto.city,
        townNeighborhood: dto.neighborhood,
      });
      if (resolved) {
        receiverLat = resolved.lat;
        receiverLng = resolved.lng;
      }
    }
    if (
      receiverLat == null &&
      dto.receiverLat != null &&
      dto.receiverLng != null &&
      Number.isFinite(dto.receiverLat) &&
      Number.isFinite(dto.receiverLng)
    ) {
      receiverLat = dto.receiverLat;
      receiverLng = dto.receiverLng;
    }

    const hasCoords =
      receiverLat != null &&
      receiverLng != null &&
      Number.isFinite(receiverLat) &&
      Number.isFinite(receiverLng);

    let neighbourhoodId =
      dto.neighbourhoodId != null && Number.isFinite(Number(dto.neighbourhoodId))
        ? Number(dto.neighbourhoodId)
        : null;
    if (neighbourhoodId == null) {
      neighbourhoodId = await this.babelAddress.resolveNeighbourhoodId({
        governorate: dto.governorate,
        cityRegion: dto.city,
        townNeighborhood: dto.neighborhood,
      });
    }

    const providers = await this.prisma.shippingProvider.findMany({
      where: { enabled: true },
      include: { connection: true },
      orderBy: { name: 'asc' },
    });

    const quotes: ShippingRateQuote[] = [];
    const errors: ShippingRateError[] = [];

    await Promise.all(
      providers.map(async (row) => {
        const connected =
          row.connection?.status === ShippingProviderConnectionStatus.connected &&
          !!row.connection.encryptedUsername &&
          !!row.connection.encryptedPassword;
        if (!connected || !this.registry.has(row.code)) return;
        const adapter = this.registry.get(row.code);
        if (!adapter.capabilities.supportsQuote) return;

        try {
          const credentials = {
            username: this.encryption.decrypt(row.connection!.encryptedUsername!),
            password: this.encryption.decrypt(row.connection!.encryptedPassword!),
          };
          const result = await adapter.getQuote(credentials, {
            receiverLat: hasCoords ? receiverLat! : 0,
            receiverLng: hasCoords ? receiverLng! : 0,
            neighbourhoodId: neighbourhoodId ?? undefined,
            packageType: dto.packageType,
            weightKg: dto.packageType === 'envelope' ? 1 : dto.weightKg,
            deliveryType: dto.deliveryType,
            pickupType: dto.pickupType ?? 'hub',
            volumeCbm: dto.volumeCbm ?? undefined,
            governorate: dto.governorate,
            city: dto.city,
            neighborhood: dto.neighborhood,
            codAmount: dto.codAmount ?? undefined,
            ...(dto.parts && dto.parts.length > 0
              ? {
                  parts: dto.parts.map((p) => ({
                    weight: Math.max(0.1, Number(p.weight) || 0.1),
                  })),
                }
              : {}),
          });
          const quotedDeliveryType = result.effectiveDeliveryType ?? dto.deliveryType;
          if (result.shippable === false) {
            errors.push({
              carrierId: row.code,
              carrierName: row.name,
              message: 'Not available for this destination / shipment configuration.',
            });
            return;
          }
          quotes.push({
            carrierId: row.code,
            carrierName: row.name,
            serviceId: result.serviceId ?? `${row.code}:${quotedDeliveryType}`,
            serviceName: result.serviceName ?? deliveryTypeLabel(quotedDeliveryType),
            available: true,
            price: result.price,
            currency: result.currency || 'USD',
            prices:
              result.prices && result.prices.length > 0
                ? result.prices
                : [{ price: result.price, currency: result.currency || 'USD' }],
            estimatedDeliveryMin: result.estimatedDeliveryMin,
            estimatedDeliveryMax: result.estimatedDeliveryMax,
            deliveryType: quotedDeliveryType,
            restrictions: result.restrictions,
          });
        } catch (err) {
          this.logger.warn(
            `Rate quote failed for ${row.code}: ${err instanceof Error ? err.message : err}`,
          );
          errors.push({
            carrierId: row.code,
            carrierName: row.name,
            message: publicCarrierRateError(safeErrorMessage(err)),
          });
        }
      }),
    );

    const result: QuoteDestinationRatesResult = {
      inSelectedArea: hasCoords ? true : null,
      quotes: annotateRateQuotes(quotes),
      errors,
    };
    this.rateCache.set(cacheKey, { at: Date.now(), value: result });
    if (this.rateCache.size > 80) {
      const first = this.rateCache.keys().next().value;
      if (first) this.rateCache.delete(first);
    }
    return result;
  }

  /**
   * Resolve Babel neighbourhood id from stored id or unified address hierarchy names.
   */
  async resolveBabelNeighbourhoodId(input: {
    existingId?: number | string | null;
    governorate?: string | null;
    cityRegion?: string | null;
    townNeighborhood?: string | null;
  }): Promise<number | null> {
    const existing =
      input.existingId != null && input.existingId !== ''
        ? Number(input.existingId)
        : null;
    if (existing != null && Number.isFinite(existing) && existing > 0) {
      return existing;
    }
    return this.babelAddress.resolveNeighbourhoodId({
      governorate: input.governorate,
      cityRegion: input.cityRegion,
      townNeighborhood: input.townNeighborhood,
    });
  }

  /**
   * Backend re-check before OMS create/update or Send Shipment.
   * Does not trust the frontend rate cards.
   */
  async assertLiveCarrierSelection(params: {
    fields: ShippingConfigFields;
    governorate?: string | null;
    city?: string | null;
    neighborhood?: string | null;
    requireQuote?: boolean;
  }): Promise<void> {
    if ((params.fields.shippingMethod ?? ShippingMethod.manual) !== ShippingMethod.carrier) {
      return;
    }
    const code = params.fields.shippingProviderCode?.trim();
    if (!code) {
      throw new BadRequestException('shippingProviderCode is required when shippingMethod=carrier.');
    }
    if (!this.registry.has(code)) {
      throw new BadRequestException(`Shipping provider "${code}" is not registered.`);
    }

    let lat = Number(params.fields.shippingReceiverLat);
    let lng = Number(params.fields.shippingReceiverLng);
    const addressCoords = this.resolveReceiverCoordinatesFromAddress({
      governorate: params.governorate,
      cityRegion: params.city,
      townNeighborhood: params.neighborhood,
    });
    if (addressCoords) {
      lat = addressCoords.lat;
      lng = addressCoords.lng;
    }
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const neighbourhoodId = await this.resolveBabelNeighbourhoodId({
      existingId: params.fields.babelNeighbourhoodId,
      governorate: params.governorate,
      cityRegion: params.city,
      townNeighborhood: params.neighborhood,
    });
    const hasBabelHood = neighbourhoodId != null;
    const hasAddressNames = Boolean(
      params.governorate?.trim() && params.city?.trim() && params.neighborhood?.trim(),
    );
    const hasDestination = hasBabelHood || hasCoords || hasAddressNames;

    const weight = Number(params.fields.shippingWeightKg);
    const canQuote =
      hasDestination &&
      !!params.fields.shippingPackageType &&
      !!params.fields.shippingDeliveryType &&
      Number.isFinite(weight) &&
      weight > 0;

    if (!canQuote) {
      if (params.requireQuote) {
        throw new BadRequestException(
          'Shipping address (Governorate / City / Town), package type, weight, and delivery type are required to confirm the shipping company.',
        );
      }
      return;
    }

    try {
      const { credentials } = await this.requireConnectedCredentials(code);
      const adapter = this.registry.get(code);
      await adapter.getQuote(credentials, {
        receiverLat: hasCoords ? lat : 0,
        receiverLng: hasCoords ? lng : 0,
        neighbourhoodId: neighbourhoodId ?? undefined,
        packageType: params.fields.shippingPackageType as 'box' | 'envelope',
        weightKg: params.fields.shippingPackageType === 'envelope' ? 1 : weight,
        deliveryType: params.fields.shippingDeliveryType as 'address' | 'hub',
        pickupType: (params.fields.shippingPickupType as 'address' | 'hub' | undefined) ?? undefined,
        volumeCbm:
          params.fields.shippingVolumeCbm != null
            ? Number(params.fields.shippingVolumeCbm)
            : undefined,
        governorate: params.governorate ?? undefined,
        city: params.city ?? undefined,
        neighborhood: params.neighborhood ?? undefined,
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(publicCarrierRateError(safeErrorMessage(err)));
    }
  }

  async listProviders(): Promise<ShippingProviderAdminView[]> {
    const rows = await this.prisma.shippingProvider.findMany({
      orderBy: { name: 'asc' },
      include: {
        connection: {
          include: {
            connectedBy: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
    });
    return rows.map((p) => this.toProviderView(p));
  }

  async connectProvider(
    code: string,
    username: string,
    password: string,
    userId: string,
  ): Promise<ShippingProviderAdminView> {
    const provider = await this.requireProvider(code);
    if (!this.registry.has(code)) {
      throw new BadRequestException(`Provider "${code}" is not supported.`);
    }
    const adapter = this.registry.get(code);
    const test = await adapter.testConnection({ username, password });
    if (!test.ok) {
      throw new BadRequestException(test.message ?? 'Connection test failed.');
    }

    const encryptedUsername = this.encryption.encrypt(username);
    const encryptedPassword = this.encryption.encrypt(password);

    await this.prisma.shippingProviderConnection.upsert({
      where: { providerId: provider.id },
      create: {
        providerId: provider.id,
        status: ShippingProviderConnectionStatus.connected,
        encryptedUsername,
        encryptedPassword,
        connectedByUserId: userId,
        lastTestedAt: new Date(),
        lastTestStatus: 'ok',
        lastErrorSafe: null,
      },
      update: {
        status: ShippingProviderConnectionStatus.connected,
        encryptedUsername,
        encryptedPassword,
        connectedByUserId: userId,
        lastTestedAt: new Date(),
        lastTestStatus: 'ok',
        lastErrorSafe: null,
      },
    });

    return this.getProviderView(code);
  }

  async testProvider(code: string): Promise<{ ok: boolean; message?: string }> {
    const { credentials, provider } = await this.requireConnectedCredentials(code);
    const adapter = this.registry.get(code);
    const result = await adapter.testConnection(credentials);
    await this.prisma.shippingProviderConnection.update({
      where: { providerId: provider.id },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: result.ok ? 'ok' : 'failed',
        lastErrorSafe: result.ok ? null : (result.message ?? 'Test failed').slice(0, 500),
      },
    });
    return result;
  }

  async disconnectProvider(code: string): Promise<ShippingProviderAdminView> {
    const provider = await this.requireProvider(code);
    await this.prisma.shippingProviderConnection.upsert({
      where: { providerId: provider.id },
      create: {
        providerId: provider.id,
        status: ShippingProviderConnectionStatus.disconnected,
        encryptedUsername: null,
        encryptedPassword: null,
        connectedByUserId: null,
        lastTestedAt: null,
        lastTestStatus: null,
        lastErrorSafe: null,
      },
      update: {
        status: ShippingProviderConnectionStatus.disconnected,
        encryptedUsername: null,
        encryptedPassword: null,
        connectedByUserId: null,
        lastTestStatus: null,
        lastErrorSafe: null,
      },
    });
    return this.getProviderView(code);
  }

  /**
   * Idempotent carrier handoff when outbound enters ready_to_ship.
   * Manual shipping: no-op.
   *
   * OMS-linked outbound shares one external shipment identity with its OMS order:
   * carrier_shipments are owned by the outbound (warehouse execution), and OMS
   * tracking/carrier fields are updated from the same result — never a second API call.
   *
   * Concurrency: claim a `pending` carrier_shipments row (partial unique index) before
   * calling the provider; reuse existing AWB/tracking when already present.
   */
  async ensureShipmentForOutbound(outboundOrderId: string): Promise<void> {
    const order = await this.prisma.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      include: {
        lines: {
          include: {
            product: {
              select: {
                weightKg: true,
                lengthCm: true,
                widthCm: true,
                heightCm: true,
                name: true,
              },
            },
          },
        },
        omsOrder: {
          select: {
            orderNumber: true,
            id: true,
            trackingNumber: true,
            carrier: true,
            status: true,
            paymentMethod: true,
            codAmount: true,
            currency: true,
            babelNeighbourhoodId: true,
            city: true,
            district: true,
            addressLine1: true,
          },
        },
      },
    });
    if (!order) {
      this.logger.warn(`ensureShipmentForOutbound: outbound ${outboundOrderId} not found`);
      return;
    }

    if (order.shippingMethod !== ShippingMethod.carrier) {
      return;
    }

    const blockedOutbound = new Set([
      'externally_fulfilled',
      'shipped',
      'cancelled',
      'delivered',
      'returned',
    ]);
    if (blockedOutbound.has(order.status)) {
      this.logger.log(
        `ensureShipmentForOutbound: skip carrier for outbound ${outboundOrderId} status=${order.status}`,
      );
      return;
    }

    const omsStatus = order.omsOrder?.status;
    if (
      omsStatus &&
      [
        'shipped',
        'out_for_delivery',
        'delivered',
        'returned',
        'cancelled',
        'failed_delivery',
        'completed',
        'rejected',
      ].includes(omsStatus)
    ) {
      this.logger.log(
        `ensureShipmentForOutbound: skip carrier; OMS ${omsStatus} blocks warehouse handoff for ${outboundOrderId}`,
      );
      return;
    }

    const existingCreated = await this.prisma.carrierShipment.findFirst({
      where: {
        outboundOrderId,
        status: CarrierShipmentStatus.created,
      },
    });
    if (existingCreated) {
      return;
    }

    // Partial success reuse: AWB already stored on outbound or linked OMS — never call provider again.
    const existingAwb =
      order.trackingNumber?.trim() ||
      order.omsOrder?.trackingNumber?.trim() ||
      null;
    if (existingAwb) {
      await this.persistCreatedFromExistingAwb({
        outboundOrderId,
        companyId: order.companyId,
        status: order.status,
        providerCode: order.shippingProviderCode?.trim() || BABEL_EXPRESS_CODE,
        awb: existingAwb,
        carrierLabel: order.carrier ?? order.omsOrder?.carrier ?? null,
        omsOrderId: order.omsOrder?.id ?? null,
      });
      return;
    }

    const providerCode = order.shippingProviderCode?.trim() || BABEL_EXPRESS_CODE;
    let provider;
    try {
      provider = await this.requireProvider(providerCode);
    } catch (err) {
      await this.persistFailedShipment({
        outboundOrderId,
        providerId: null,
        providerCode,
        error: safeErrorMessage(err),
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
      return;
    }

    const connection = await this.prisma.shippingProviderConnection.findUnique({
      where: { providerId: provider.id },
    });
    if (
      !connection ||
      connection.status !== ShippingProviderConnectionStatus.connected ||
      !connection.encryptedUsername ||
      !connection.encryptedPassword
    ) {
      await this.persistFailedShipment({
        outboundOrderId,
        providerId: provider.id,
        providerCode,
        error: `${provider.name} is not connected.`,
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
      return;
    }

    try {
      const babelNeighbourhoodId = await this.resolveBabelNeighbourhoodId({
        existingId:
          order.babelNeighbourhoodId ?? order.omsOrder?.babelNeighbourhoodId ?? null,
        governorate: order.city ?? order.omsOrder?.city,
        cityRegion: order.district ?? order.omsOrder?.district,
        townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
      });
      const resolvedCoords = this.resolveReceiverCoordinatesFromAddress({
        governorate: order.city ?? order.omsOrder?.city,
        cityRegion: order.district ?? order.omsOrder?.district,
        townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
      });
      assertCarrierShippingReady({
        shippingMethod: order.shippingMethod,
        shippingProviderCode: order.shippingProviderCode,
        shippingReceiverLat:
          resolvedCoords?.lat ??
          (order.shippingReceiverLat != null ? Number(order.shippingReceiverLat) : null),
        shippingReceiverLng:
          resolvedCoords?.lng ??
          (order.shippingReceiverLng != null ? Number(order.shippingReceiverLng) : null),
        shippingPackageType: order.shippingPackageType,
        shippingContents: order.shippingContents,
        shippingDeliveryType: order.shippingDeliveryType,
        shippingPickupType: order.shippingPickupType,
        shippingPayer: order.shippingPayer,
        shippingWeightKg: order.shippingWeightKg?.toString() ?? null,
        babelNeighbourhoodId,
      });
      if (resolvedCoords) {
        await this.prisma.outboundOrder.update({
          where: { id: outboundOrderId },
          data: {
            shippingReceiverLat: resolvedCoords.lat,
            shippingReceiverLng: resolvedCoords.lng,
            ...(babelNeighbourhoodId != null ? { babelNeighbourhoodId } : {}),
          },
        });
      } else if (
        babelNeighbourhoodId != null &&
        order.babelNeighbourhoodId == null
      ) {
        await this.prisma.outboundOrder.update({
          where: { id: outboundOrderId },
          data: { babelNeighbourhoodId },
        });
      }
    } catch (err) {
      await this.persistFailedShipment({
        outboundOrderId,
        providerId: provider.id,
        providerCode,
        error: safeErrorMessage(err),
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
      return;
    }

    const phone = parsePhoneForBabel(order.recipientPhone, order.shippingPhoneCountry);
    if (!phone) {
      const reason = !order.recipientPhone?.trim()
        ? 'Recipient phone number is missing. Add a phone number to the order before sending.'
        : 'Recipient phone could not be parsed into country dial code + local number. Set shippingPhoneCountry.';
      await this.persistFailedShipment({
        outboundOrderId,
        providerId: provider.id,
        providerCode,
        error: reason,
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
      return;
    }

    const weightKg = Number(order.shippingWeightKg);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      await this.persistFailedShipment({
        outboundOrderId,
        providerId: provider.id,
        providerCode,
        error: 'Shipment weight is missing or invalid.',
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
      return;
    }

    const address =
      composeDestinationAddress({
        destinationAddress: order.destinationAddress,
        addressLine1: order.addressLine1 ?? undefined,
        addressLine2: order.addressLine2 ?? undefined,
        district: order.district ?? undefined,
        city: order.city ?? undefined,
      }) ||
      order.destinationAddress ||
      '';

    if (!order.recipientName?.trim() || !address.trim()) {
      await this.persistFailedShipment({
        outboundOrderId,
        providerId: provider.id,
        providerCode,
        error: 'Recipient name and address are required for carrier shipping.',
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
      return;
    }

    let username: string;
    let password: string;
    try {
      username = this.encryption.decrypt(connection.encryptedUsername);
      password = this.encryption.decrypt(connection.encryptedPassword);
    } catch (err) {
      await this.persistFailedShipment({
        outboundOrderId,
        providerId: provider.id,
        providerCode,
        error: 'Failed to decrypt provider credentials.',
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
      return;
    }

    const claimId = await this.claimPendingShipment({
      outboundOrderId,
      providerId: provider.id,
      providerCode,
    });
    if (!claimId) {
      // Another worker holds pending/created — do not call the provider again.
      return;
    }

    const oms = order.omsOrder;
    const paymentMethod = order.paymentMethod ?? oms?.paymentMethod ?? null;
    const rawCodAmount = order.codAmount ?? oms?.codAmount ?? null;
    const orderCurrency = order.currency ?? oms?.currency ?? null;

    const isCod = paymentMethod === 'COD';
    const codAmount =
      isCod && rawCodAmount != null ? Number(rawCodAmount) : 0;
    const codCurrency = resolveBabelCodCurrency(orderCurrency);

    if (isCod && (!Number.isFinite(codAmount) || codAmount <= 0)) {
      await this.failClaim(
        claimId,
        outboundOrderId,
        order.companyId,
        order.status,
        'COD order is missing a collectible amount. Set COD on the OMS order before Send Shipment.',
      );
      return;
    }
    if (isCod && codCurrency === 'SYP' && codAmount < 1000) {
      await this.failClaim(
        claimId,
        outboundOrderId,
        order.companyId,
        order.status,
        `COD amount ${codAmount} SYP is below Babel Express minimum (1,000 SYP).`,
      );
      return;
    }

    const adapter = this.registry.get(providerCode);
    const reference =
      order.omsOrder?.orderNumber ?? order.orderNumber ?? order.clientReference ?? undefined;

    const babelNeighbourhoodId =
      order.babelNeighbourhoodId ??
      order.omsOrder?.babelNeighbourhoodId ??
      (await this.resolveBabelNeighbourhoodId({
        governorate: order.city ?? order.omsOrder?.city,
        cityRegion: order.district ?? order.omsOrder?.district,
        townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
      }));

    const physicalParts = buildPhysicalShipmentParts(
      (order.lines ?? []).map((line) => ({
        productId: line.productId,
        productName: line.product?.name ?? 'item',
        quantity: Number(line.requestedQuantity),
        weightKg: line.product?.weightKg != null ? Number(line.product.weightKg) : null,
        lengthCm: line.product?.lengthCm != null ? Number(line.product.lengthCm) : null,
        widthCm: line.product?.widthCm != null ? Number(line.product.widthCm) : null,
        heightCm: line.product?.heightCm != null ? Number(line.product.heightCm) : null,
      })),
    );
    const weightByProductId = new Map(
      (order.lines ?? []).map((line) => [
        line.productId,
        line.product?.weightKg != null && Number(line.product.weightKg) > 0
          ? Number(line.product.weightKg)
          : 0.1,
      ]),
    );
    const savedCartons = parseShippingCartons(
      (order as { shippingPackages?: unknown }).shippingPackages,
    );
    const packageType = order.shippingPackageType === 'envelope' ? 'envelope' : 'box';
    const babelParts = savedCartons
      ? babelPartsFromCartons(savedCartons, weightByProductId, packageType)
      : toBabelWeightParts(physicalParts, packageType);

    this.logger.log(
      JSON.stringify({
        msg: 'babel_create_shipment_attempt',
        outboundOrderId,
        babelNeighbourhoodId,
        deliveryType: order.shippingDeliveryType,
        pickupType: order.shippingPickupType,
        packageType: order.shippingPackageType,
        partCount: babelParts.length,
        totalWeightKg: weightKg,
        payer: order.shippingPayer,
        isCod,
        codAmount: isCod ? codAmount : 0,
        codCurrency,
      }),
    );

    const resolvedShipmentCoords = this.resolveReceiverCoordinatesFromAddress({
      governorate: order.city ?? order.omsOrder?.city,
      cityRegion: order.district ?? order.omsOrder?.district,
      townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
    });
    const shipmentReceiverLat =
      resolvedShipmentCoords?.lat ??
      (Number(order.shippingReceiverLat) || 0);
    const shipmentReceiverLng =
      resolvedShipmentCoords?.lng ??
      (Number(order.shippingReceiverLng) || 0);

    try {
      const result = await adapter.createShipment(
        { username, password },
        {
          reference,
          receiver: {
            name: order.recipientName.trim(),
            phoneCountry: phone.country,
            phoneLocal: phone.phone,
            address: address.trim(),
            lat: shipmentReceiverLat,
            lng: shipmentReceiverLng,
            neighbourhoodId:
              babelNeighbourhoodId != null ? Number(babelNeighbourhoodId) : undefined,
          },
          packageType: order.shippingPackageType!,
          weightKg:
            order.shippingPackageType === 'envelope' ? 1 : weightKg,
          parts: babelParts,
          contents: order.shippingContents!.trim(),
          deliveryType: order.shippingDeliveryType!,
          pickupType: order.shippingPickupType!,
          payer: order.shippingPayer!,
          // Non-COD: amount 0 disables COD per Babel OpenAPI. COD: business amount + currency.
          codAmount: isCod && Number.isFinite(codAmount) ? codAmount : 0,
          currency: codCurrency,
        },
      );

      await this.prisma.$transaction(async (tx) => {
        const again = await tx.carrierShipment.findFirst({
          where: { outboundOrderId, status: CarrierShipmentStatus.created },
        });
        if (again) {
          await tx.carrierShipment.update({
            where: { id: claimId },
            data: {
              status: CarrierShipmentStatus.failed,
              lastErrorSafe: 'Superseded by existing created shipment',
            },
          });
          return;
        }

        await tx.carrierShipment.update({
          where: { id: claimId },
          data: {
            externalAwb: result.awb,
            trackingNumber: result.awb,
            status: CarrierShipmentStatus.created,
            lastErrorSafe: null,
            rawResultMeta: (result.raw ?? { awb: result.awb }) as Prisma.InputJsonValue,
          },
        });

        await tx.outboundOrder.update({
          where: { id: outboundOrderId },
          data: {
            carrier: provider.name,
            trackingNumber: result.awb,
          },
        });

        if (order.omsOrder?.id) {
          await tx.omsOrder.update({
            where: { id: order.omsOrder.id },
            data: {
              carrier: provider.name,
              trackingNumber: result.awb,
            },
          });
        }
      });

      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
    } catch (err) {
      this.logger.warn(
        `Carrier createShipment failed for outbound ${outboundOrderId}: ${safeErrorMessage(err)}`,
      );
      await this.prisma.carrierShipment.update({
        where: { id: claimId },
        data: {
          status: CarrierShipmentStatus.failed,
          lastErrorSafe: safeErrorMessage(err),
        },
      });
      this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
    }
  }

  /**
   * Mark a claimed pending shipment as failed with a safe user-facing reason.
   */
  private async failClaim(
    claimId: string,
    outboundOrderId: string,
    companyId: string,
    orderStatus: string,
    message: string,
  ) {
    await this.prisma.carrierShipment.update({
      where: { id: claimId },
      data: {
        status: CarrierShipmentStatus.failed,
        lastErrorSafe: message,
      },
    });
    this.emitOutboundShippingUpdate(companyId, outboundOrderId, orderStatus);
  }

  /**
   * Claim exclusive right to call the carrier API for this outbound.
   * Returns the pending row id, or null if another claim/created already exists.
   */
  private async claimPendingShipment(params: {
    outboundOrderId: string;
    providerId: string;
    providerCode: string;
  }): Promise<string | null> {
    try {
      const row = await this.prisma.carrierShipment.create({
        data: {
          outboundOrderId: params.outboundOrderId,
          providerId: params.providerId,
          providerCode: params.providerCode,
          status: CarrierShipmentStatus.pending,
        },
        select: { id: true },
      });
      return row.id;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.log(
          `claimPendingShipment: in-flight or created shipment already exists for outbound ${params.outboundOrderId}`,
        );
        return null;
      }
      throw err;
    }
  }

  /** Persist a created shipment from an AWB already on the order (no provider call). */
  private async persistCreatedFromExistingAwb(params: {
    outboundOrderId: string;
    companyId: string;
    status: string;
    providerCode: string;
    awb: string;
    carrierLabel: string | null;
    omsOrderId: string | null;
  }) {
    let providerId: string | null = null;
    try {
      const provider = await this.requireProvider(params.providerCode);
      providerId = provider.id;
    } catch {
      this.logger.warn(
        `persistCreatedFromExistingAwb: provider ${params.providerCode} missing; skip row for ${params.outboundOrderId}`,
      );
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const again = await tx.carrierShipment.findFirst({
          where: {
            outboundOrderId: params.outboundOrderId,
            status: CarrierShipmentStatus.created,
          },
        });
        if (again) return;

        await tx.carrierShipment.create({
          data: {
            outboundOrderId: params.outboundOrderId,
            providerId: providerId!,
            providerCode: params.providerCode,
            externalAwb: params.awb,
            trackingNumber: params.awb,
            status: CarrierShipmentStatus.created,
            lastErrorSafe: null,
            rawResultMeta: { reusedExistingAwb: true, awb: params.awb },
          },
        });

        if (params.carrierLabel) {
          await tx.outboundOrder.update({
            where: { id: params.outboundOrderId },
            data: {
              carrier: params.carrierLabel,
              trackingNumber: params.awb,
            },
          });
          if (params.omsOrderId) {
            await tx.omsOrder.update({
              where: { id: params.omsOrderId },
              data: {
                carrier: params.carrierLabel,
                trackingNumber: params.awb,
              },
            });
          }
        }
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }

    this.emitOutboundShippingUpdate(params.companyId, params.outboundOrderId, params.status);
  }

  async retryShipment(outboundOrderId: string): Promise<{ ok: boolean }> {
    const created = await this.prisma.carrierShipment.findFirst({
      where: { outboundOrderId, status: CarrierShipmentStatus.created },
    });
    if (created) {
      throw new BadRequestException(
        'A successful carrier shipment already exists for this outbound order.',
      );
    }
    const order = await this.prisma.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      select: { id: true, shippingMethod: true, status: true },
    });
    if (!order) throw new NotFoundException('Outbound order not found.');
    if (order.shippingMethod !== ShippingMethod.carrier) {
      throw new BadRequestException('Outbound order is not configured for carrier shipping.');
    }
    if (order.status !== 'waiting_for_shipping_details' && order.status !== 'ready_to_ship' && order.status !== 'shipped') {
      throw new BadRequestException(
        'Retry is only available during Waiting for Shipping Details or after ready_to_ship.',
      );
    }

    // Release any stuck pending claim so retry can call the provider again.
    await this.prisma.carrierShipment.updateMany({
      where: { outboundOrderId, status: CarrierShipmentStatus.pending },
      data: {
        status: CarrierShipmentStatus.failed,
        lastErrorSafe: 'Pending claim released for retry',
      },
    });

    await this.ensureShipmentForOutbound(outboundOrderId);
    return { ok: true };
  }

  async getLatestShipment(outboundOrderId: string) {
    return this.prisma.carrierShipment.findFirst({
      where: { outboundOrderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Decrypted credentials for a connected provider (quotes / labels). */
  async getDecryptedCredentials(code: string): Promise<{ username: string; password: string }> {
    const { credentials } = await this.requireConnectedCredentials(code);
    return credentials;
  }

  private async getProviderView(code: string): Promise<ShippingProviderAdminView> {
    const provider = await this.prisma.shippingProvider.findUnique({
      where: { code },
      include: {
        connection: {
          include: {
            connectedBy: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
    });
    if (!provider) throw new NotFoundException(`Shipping provider "${code}" not found.`);
    return this.toProviderView(provider);
  }

  private toProviderView(
    provider: Prisma.ShippingProviderGetPayload<{
      include: {
        connection: {
          include: { connectedBy: { select: { id: true, email: true, fullName: true } } };
        };
      };
    }>,
  ): ShippingProviderAdminView {
    const conn = provider.connection;
    let usernameMasked: string | null = null;
    if (conn?.encryptedUsername) {
      try {
        usernameMasked = maskUsername(this.encryption.decrypt(conn.encryptedUsername));
      } catch {
        usernameMasked = '********';
      }
    }
    const connected = conn?.status === ShippingProviderConnectionStatus.connected;
    return {
      code: provider.code,
      name: provider.name,
      enabled: provider.enabled,
      status: connected ? 'connected' : 'disconnected',
      connected,
      usernameMasked,
      connectedBy: conn?.connectedBy
        ? {
            id: conn.connectedBy.id,
            email: conn.connectedBy.email,
            fullName: conn.connectedBy.fullName,
          }
        : null,
      lastTestedAt: conn?.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: conn?.lastTestStatus ?? null,
      lastErrorSafe: conn?.lastErrorSafe ?? null,
    };
  }

  private async requireProvider(code: string) {
    const provider = await this.prisma.shippingProvider.findUnique({ where: { code } });
    if (!provider || !provider.enabled) {
      throw new NotFoundException(`Shipping provider "${code}" not found.`);
    }
    return provider;
  }

  private async requireConnectedCredentials(code: string) {
    const provider = await this.requireProvider(code);
    const connection = await this.prisma.shippingProviderConnection.findUnique({
      where: { providerId: provider.id },
    });
    if (
      !connection ||
      connection.status !== ShippingProviderConnectionStatus.connected ||
      !connection.encryptedUsername ||
      !connection.encryptedPassword
    ) {
      throw new BadRequestException(`${provider.name} is not connected.`);
    }
    try {
      return {
        provider,
        credentials: {
          username: this.encryption.decrypt(connection.encryptedUsername),
          password: this.encryption.decrypt(connection.encryptedPassword),
        },
      };
    } catch (err) {
      this.logger.warn(
        `Failed to decrypt credentials for ${code}: ${(err as Error)?.message ?? err}`,
      );
      throw new BadRequestException(
        `${provider.name} credentials cannot be decrypted. ` +
          `Disconnect and reconnect the provider (re-enter username/password) so they are encrypted with the current server key.`,
      );
    }
  }

  private async persistFailedShipment(params: {
    outboundOrderId: string;
    providerId: string | null;
    providerCode: string;
    error: string;
  }) {
    if (!params.providerId) {
      // Without a provider row we cannot satisfy FK — skip persist but log.
      this.logger.warn(
        `carrier_shipments skip (no providerId) outbound=${params.outboundOrderId}: ${params.error}`,
      );
      return;
    }
    await this.prisma.carrierShipment.create({
      data: {
        outboundOrderId: params.outboundOrderId,
        providerId: params.providerId,
        providerCode: params.providerCode,
        status: CarrierShipmentStatus.failed,
        lastErrorSafe: params.error.slice(0, 500),
      },
    });
  }

  private emitOutboundShippingUpdate(
    companyId: string,
    orderId: string,
    status: string,
  ) {
    try {
      this.realtime.emitOutboundOrderUpdated(companyId, {
        orderId,
        status,
        reason: 'shipping.shipment.updated',
      });
    } catch (err) {
      this.logger.warn(`realtime emit failed: ${safeErrorMessage(err)}`);
    }
  }
}
