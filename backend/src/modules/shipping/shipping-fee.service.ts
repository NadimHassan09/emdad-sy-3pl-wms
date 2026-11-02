import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  quoteClientShippingRate,
  quoteExternalPerKg,
  SHIPPING_FEE_ROUNDING_POLICY,
  ShippingFeeValidationError,
} from './shipping-fee.calculator';
import {
  assertKnownLocation,
  candidateLocationKeys,
  listCityRegions,
  listGovernorates,
  listTowns,
  locationKey,
  ShippingFeeLocationRef,
} from './shipping-fee.locations';
import {
  PreviewShippingFeeDto,
  SetShippingFeeGroupActiveDto,
  UpdateShippingFeeSettingsDto,
  UpsertShippingFeeGroupDto,
} from './dto/shipping-fee.dto';

type Db = PrismaService | Prisma.TransactionClient;

const GROUP_INCLUDE = {
  locations: { orderBy: { governorate: 'asc' as const } },
  company: { select: { id: true, name: true } },
};

@Injectable()
export class ShippingFeeService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfiguration(companyId?: string) {
    const settings = await this.ensureSettings();
    const where: Prisma.ShippingFeeGroupWhereInput = {};
    if (companyId === 'global') {
      where.companyId = null;
    } else if (companyId) {
      where.OR = [{ companyId: null }, { companyId }];
    }
    const groups = await this.prisma.shippingFeeGroup.findMany({
      where,
      include: GROUP_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      settings: this.serializeSettings(settings),
      groups: groups.map((group) => this.serializeGroup(group as any)),
      rounding: {
        policy: SHIPPING_FEE_ROUNDING_POLICY,
        description:
          'Weight at or below the included base uses the group rate. Each started additional increment is charged in full. An exact increment boundary is not rounded up again.',
      },
    };
  }

  listLocations(governorate?: string, cityRegion?: string) {
    if (governorate && cityRegion) {
      return {
        governorate,
        cityRegion,
        towns: listTowns(governorate, cityRegion),
      };
    }
    if (governorate) {
      return { governorate, cityRegions: listCityRegions(governorate) };
    }
    return { governorates: listGovernorates() };
  }

  async updateSettings(dto: UpdateShippingFeeSettingsDto, userId: string) {
    this.assertWeightSettings(dto);
    const currency = dto.currency.trim().toUpperCase();
    const externalCurrency = dto.externalCurrency?.trim()
      ? dto.externalCurrency.trim().toUpperCase()
      : currency;
    await this.ensureSettings();
    const saved = await this.prisma.shippingFeeSettings.update({
      where: { id: 'default' },
      data: {
        currency,
        baseWeightKg: new Prisma.Decimal(dto.baseWeightKg),
        incrementKg: new Prisma.Decimal(dto.incrementKg),
        incrementCharge: new Prisma.Decimal(dto.incrementCharge),
        externalPerKg:
          dto.externalPerKg == null ? null : new Prisma.Decimal(dto.externalPerKg),
        externalCurrency: dto.externalPerKg == null ? null : externalCurrency,
        roundingPolicy: SHIPPING_FEE_ROUNDING_POLICY,
        updatedByUserId: userId,
      },
    });
    return this.serializeSettings(saved);
  }

  async createGroup(dto: UpsertShippingFeeGroupDto) {
    const locations = this.normalizeLocations(dto.locations);
    const companyId = dto.companyId ?? null;
    return this.prisma.$transaction(async (tx) => {
      await this.releaseConflicts(tx, locations, null, companyId, dto.reassign === true);
      const created = await tx.shippingFeeGroup.create({
        data: {
          companyId,
          nameAr: dto.nameAr.trim(),
          nameEn: dto.nameEn?.trim() || null,
          areaCategory: dto.areaCategory,
          baseRate: new Prisma.Decimal(dto.baseRate),
          active: dto.active !== false,
          sortOrder: dto.sortOrder ?? 0,
          locations: {
            create: locations.map((location) => ({
              companyId,
              locationKey: locationKey(location),
              level: location.level,
              governorate: location.governorate,
              cityRegion: location.cityRegion,
              townNeighborhood: location.townNeighborhood,
            })),
          },
        },
        include: GROUP_INCLUDE,
      });
      return this.serializeGroup(created as any);
    });
  }

  async updateGroup(id: string, dto: UpsertShippingFeeGroupDto) {
    const existing = await this.prisma.shippingFeeGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Shipping fee group not found.');
    const locations = this.normalizeLocations(dto.locations);
    const companyId = dto.companyId !== undefined ? (dto.companyId ?? null) : existing.companyId;
    return this.prisma.$transaction(async (tx) => {
      await this.releaseConflicts(tx, locations, id, companyId, dto.reassign === true);
      await tx.shippingFeeGroupLocation.deleteMany({ where: { groupId: id } });
      const updated = await tx.shippingFeeGroup.update({
        where: { id },
        data: {
          companyId,
          nameAr: dto.nameAr.trim(),
          nameEn: dto.nameEn?.trim() || null,
          areaCategory: dto.areaCategory,
          baseRate: new Prisma.Decimal(dto.baseRate),
          active: dto.active !== false,
          sortOrder: dto.sortOrder ?? existing.sortOrder,
          locations: {
            create: locations.map((location) => ({
              companyId,
              locationKey: locationKey(location),
              level: location.level,
              governorate: location.governorate,
              cityRegion: location.cityRegion,
              townNeighborhood: location.townNeighborhood,
            })),
          },
        },
        include: GROUP_INCLUDE,
      });
      return this.serializeGroup(updated as any);
    });
  }

  async setGroupActive(id: string, dto: SetShippingFeeGroupActiveDto) {
    try {
      const updated = await this.prisma.shippingFeeGroup.update({
        where: { id },
        data: { active: dto.active },
        include: GROUP_INCLUDE,
      });
      return this.serializeGroup(updated as any);
    } catch {
      throw new NotFoundException('Shipping fee group not found.');
    }
  }

  preview(dto: PreviewShippingFeeDto) {
    return this.quote({
      scope: dto.scope,
      companyId: dto.companyId,
      governorate: dto.governorate,
      cityRegion: dto.cityRegion,
      townNeighborhood: dto.townNeighborhood,
      weightKg: dto.weightKg,
    });
  }

  /**
   * Resolves the matching pricing group location for a destination.
   * Deterministic priority order:
   * 1. Specificity: Town/Neighborhood > City/Region > Governorate
   * 2. Scope: Client-specific match beats Global default match at the SAME level/location.
   * Returns null if no active rate covers the destination.
   */
  async resolveDestinationGroup(
    db: Db,
    input: {
      companyId?: string | null;
      governorate?: string | null;
      cityRegion?: string | null;
      townNeighborhood?: string | null;
    },
  ) {
    const keys = candidateLocationKeys({
      governorate: input.governorate,
      cityRegion: input.cityRegion,
      townNeighborhood: input.townNeighborhood,
    });
    if (keys.length === 0) return null;

    const companyId = input.companyId ?? null;
    const matches = await db.shippingFeeGroupLocation.findMany({
      where: {
        locationKey: { in: keys },
        group: { active: true },
        ...(companyId ? { OR: [{ companyId: null }, { companyId }] } : { companyId: null }),
      },
      include: { group: true },
    });

    for (const key of keys) {
      if (companyId) {
        const clientMatch = matches.find(
          (m) => m.locationKey === key && m.companyId === companyId,
        );
        if (clientMatch) return clientMatch;
      }
      const globalMatch = matches.find(
        (m) => m.locationKey === key && m.companyId == null,
      );
      if (globalMatch) return globalMatch;
    }

    return null;
  }

  /**
   * Writes the client shipping rate onto an unlocked order.
   * Locked orders keep the rate that was applied unless force is true (e.g. destination changed).
   * Carrier costs are never read here.
   */
  async syncClientRate(
    db: Db,
    omsOrderId: string,
    opts: { lock: boolean; force?: boolean },
  ): Promise<{ applied: boolean; reason: string; amount?: string }> {
    const order = await db.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: {
        lines: { include: { product: { select: { weightKg: true } } } },
      },
    });
    if (!order) return { applied: false, reason: 'order_not_found' };
    if (order.clientShippingRateAppliedAt && !opts.force) {
      return { applied: false, reason: 'already_applied' };
    }

    const activeGroups = await db.shippingFeeGroup.count({ where: { active: true } });
    if (activeGroups === 0) return { applied: false, reason: 'no_configuration' };

    const settings = await db.shippingFeeSettings.findUnique({ where: { id: 'default' } });
    if (
      !settings ||
      settings.baseWeightKg == null ||
      settings.incrementKg == null ||
      settings.incrementCharge == null
    ) {
      if (opts.lock) {
        throw new BadRequestException('Shipping fee weight settings are incomplete.');
      }
      return { applied: false, reason: 'weight_settings_incomplete' };
    }

    const match = await this.resolveDestinationGroup(db, {
      companyId: order.companyId,
      governorate: order.city,
      cityRegion: order.district,
      townNeighborhood: order.addressLine1,
    });
    if (!match) {
      if (opts.lock) {
        throw new BadRequestException(
          'No active shipping fee rate covers this destination. Add it to a pricing group or activate the group that already contains it.',
        );
      }
      return { applied: false, reason: 'no_rate' };
    }

    const weightKg = this.billableWeightKg(order);
    if (weightKg == null) {
      if (opts.lock) {
        throw new BadRequestException(
          'Billable weight is missing or zero. Enter the shipment weight before applying the client shipping rate.',
        );
      }
      return { applied: false, reason: 'missing_weight' };
    }

    const orderCurrency = (order.currency || 'USD').toUpperCase();
    if (orderCurrency !== settings.currency.toUpperCase()) {
      if (opts.lock) {
        throw new BadRequestException(
          `Order currency ${orderCurrency} does not match the shipping fee currency ${settings.currency}.`,
        );
      }
      return { applied: false, reason: 'currency_mismatch' };
    }

    let quote;
    try {
      quote = quoteClientShippingRate({
        baseRate: Number(match.group.baseRate),
        baseWeightKg: Number(settings.baseWeightKg),
        incrementKg: Number(settings.incrementKg),
        incrementCharge: Number(settings.incrementCharge),
        weightKg,
      });
    } catch (err) {
      if (err instanceof ShippingFeeValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const linesSum = order.lines.reduce((sum, line) => {
      if (line.lineTotal != null) return sum.add(line.lineTotal);
      if (line.unitPrice != null) return sum.add(line.unitPrice.mul(line.requestedQuantity));
      return sum;
    }, new Prisma.Decimal(0));
    const fee = new Prisma.Decimal(quote.amount);
    const breakdown = {
      ...quote,
      currency: settings.currency,
      groupId: match.group.id,
      groupNameAr: match.group.nameAr,
      locationKey: match.locationKey,
      locationLevel: match.level,
      isClientSpecific: match.companyId != null,
    };

    await db.omsOrder.update({
      where: { id: order.id },
      data: {
        shippingFee: fee,
        subtotal: linesSum.add(fee),
        clientShippingRateGroupId: match.group.id,
        clientShippingRateWeightKg: new Prisma.Decimal(weightKg),
        clientShippingRateBreakdown: breakdown,
        clientShippingRateAppliedAt: opts.lock ? (order.clientShippingRateAppliedAt ?? new Date()) : null,
      },
    });

    if (order.outboundOrderId) {
      await db.outboundOrder.update({
        where: { id: order.outboundOrderId },
        data: { shippingFee: fee },
      });
    }

    return { applied: true, reason: opts.lock ? 'locked' : 'preview_saved', amount: fee.toString() };
  }

  async carrierCostHistoryForOrder(omsOrderId: string) {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      select: {
        id: true,
        shippingFee: true,
        currency: true,
        clientShippingRateAppliedAt: true,
        clientShippingRateBreakdown: true,
        outboundOrder: {
          select: {
            shippingFee: true,
            shippingQuotedPrice: true,
            shippingQuotedCurrency: true,
            carrierShipments: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                providerCode: true,
                status: true,
                shippingCost: true,
                currency: true,
                shippingCostEventAt: true,
                shippingCostSource: true,
                externalAwb: true,
                costChanges: { orderBy: { createdAt: 'desc' }, take: 30 },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return {
      clientShippingRate: order.shippingFee?.toString() ?? null,
      clientShippingCurrency: order.currency,
      clientShippingRateAppliedAt: order.clientShippingRateAppliedAt,
      clientShippingRateBreakdown: order.clientShippingRateBreakdown,
      carrierQuote: order.outboundOrder?.shippingQuotedPrice?.toString() ?? null,
      carrierQuoteCurrency: order.outboundOrder?.shippingQuotedCurrency ?? null,
      shipments: (order.outboundOrder?.carrierShipments ?? []).map((shipment) => ({
        id: shipment.id,
        providerCode: shipment.providerCode,
        status: shipment.status,
        actualCost: shipment.shippingCost?.toString() ?? null,
        actualCostCurrency: shipment.currency,
        actualCostEventAt: shipment.shippingCostEventAt,
        actualCostSource: shipment.shippingCostSource,
        awb: shipment.externalAwb,
        history: shipment.costChanges.map((change) => ({
          id: change.id,
          previousAmount: change.previousAmount?.toString() ?? null,
          previousCurrency: change.previousCurrency,
          amount: change.amount.toString(),
          currency: change.currency,
          source: change.source,
          applied: change.applied,
          skipReason: change.skipReason,
          externalEventId: change.externalEventId,
          eventAt: change.eventAt,
          createdAt: change.createdAt,
        })),
      })),
    };
  }

  private async quote(input: {
    scope: 'local' | 'external';
    companyId?: string | null;
    governorate?: string;
    cityRegion?: string;
    townNeighborhood?: string;
    weightKg: number;
  }) {
    const settings = await this.ensureSettings();
    if (input.scope === 'external') {
      if (settings.externalPerKg == null) {
        throw new BadRequestException('External price per kilogram is not configured.');
      }
      try {
        const amount = quoteExternalPerKg(input.weightKg, Number(settings.externalPerKg));
        return {
          scope: 'external' as const,
          amount,
          currency: settings.externalCurrency || settings.currency,
          weightKg: input.weightKg,
          perKg: Number(settings.externalPerKg),
        };
      } catch (err) {
        if (err instanceof ShippingFeeValidationError) throw new BadRequestException(err.message);
        throw err;
      }
    }

    if (
      settings.baseWeightKg == null ||
      settings.incrementKg == null ||
      settings.incrementCharge == null
    ) {
      throw new BadRequestException('Configure the base weight, increment, and additional charge first.');
    }
    const match = await this.resolveDestinationGroup(this.prisma, {
      companyId: input.companyId,
      governorate: input.governorate,
      cityRegion: input.cityRegion,
      townNeighborhood: input.townNeighborhood,
    });
    if (!match) {
      throw new BadRequestException('No active shipping fee rate covers this destination.');
    }
    try {
      const quote = quoteClientShippingRate({
        baseRate: Number(match.group.baseRate),
        baseWeightKg: Number(settings.baseWeightKg),
        incrementKg: Number(settings.incrementKg),
        incrementCharge: Number(settings.incrementCharge),
        weightKg: input.weightKg,
      });
      return {
        scope: 'local' as const,
        currency: settings.currency,
        groupId: match.group.id,
        groupNameAr: match.group.nameAr,
        locationLevel: match.level,
        matchedLocationKey: match.locationKey,
        isClientSpecific: match.companyId != null,
        ...quote,
      };
    } catch (err) {
      if (err instanceof ShippingFeeValidationError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  private billableWeightKg(order: {
    shippingWeightKg: Prisma.Decimal | null;
    lines: Array<{ requestedQuantity: Prisma.Decimal; product: { weightKg: Prisma.Decimal | null } | null }>;
  }): number | null {
    if (order.shippingWeightKg != null) {
      const explicit = Number(order.shippingWeightKg);
      return explicit > 0 ? explicit : null;
    }
    let total = 0;
    let any = false;
    for (const line of order.lines) {
      const unit = line.product?.weightKg != null ? Number(line.product.weightKg) : null;
      if (unit == null || unit <= 0) continue;
      any = true;
      total += unit * Number(line.requestedQuantity);
    }
    return any && total > 0 ? total : null;
  }

  private assertWeightSettings(dto: UpdateShippingFeeSettingsDto) {
    try {
      quoteClientShippingRate({
        baseRate: 0,
        baseWeightKg: dto.baseWeightKg,
        incrementKg: dto.incrementKg,
        incrementCharge: dto.incrementCharge,
        weightKg: dto.baseWeightKg,
      });
    } catch (err) {
      if (err instanceof ShippingFeeValidationError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  private normalizeLocations(locations: ShippingFeeLocationRef[]): ShippingFeeLocationRef[] {
    const seen = new Set<string>();
    const normalized: ShippingFeeLocationRef[] = [];
    for (const location of locations) {
      let known: ShippingFeeLocationRef;
      try {
        known = assertKnownLocation(location);
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'Unknown location.');
      }
      const key = locationKey(known);
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(known);
    }
    if (normalized.length === 0) {
      throw new BadRequestException('Add at least one location from the system hierarchy.');
    }
    return normalized;
  }

  private async releaseConflicts(
    tx: Prisma.TransactionClient,
    locations: ShippingFeeLocationRef[],
    groupId: string | null,
    companyId: string | null,
    reassign: boolean,
  ) {
    const keys = locations.map((location) => locationKey(location));
    const conflicts = await tx.shippingFeeGroupLocation.findMany({
      where: {
        locationKey: { in: keys },
        companyId,
        ...(groupId ? { groupId: { not: groupId } } : {}),
      },
      include: { group: { select: { nameAr: true } } },
    });
    if (conflicts.length === 0) return;
    if (!reassign) {
      const sample = conflicts
        .slice(0, 5)
        .map((row) => `${row.governorate}${row.cityRegion ? ` / ${row.cityRegion}` : ''} (${row.group.nameAr})`)
        .join(', ');
      throw new BadRequestException(
        `These locations already belong to another group: ${sample}. Remove them there, or save again to reassign them.`,
      );
    }
    await tx.shippingFeeGroupLocation.deleteMany({
      where: { id: { in: conflicts.map((row) => row.id) } },
    });
  }

  private async ensureSettings() {
    return this.prisma.shippingFeeSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default', currency: 'USD', roundingPolicy: SHIPPING_FEE_ROUNDING_POLICY },
    });
  }

  private serializeSettings(row: {
    currency: string;
    baseWeightKg: Prisma.Decimal | null;
    incrementKg: Prisma.Decimal | null;
    incrementCharge: Prisma.Decimal | null;
    roundingPolicy: string;
    externalPerKg: Prisma.Decimal | null;
    externalCurrency: string | null;
    updatedAt: Date;
  }) {
    return {
      currency: row.currency,
      baseWeightKg: row.baseWeightKg?.toString() ?? null,
      incrementKg: row.incrementKg?.toString() ?? null,
      incrementCharge: row.incrementCharge?.toString() ?? null,
      roundingPolicy: row.roundingPolicy,
      externalPerKg: row.externalPerKg?.toString() ?? null,
      externalCurrency: row.externalCurrency,
      updatedAt: row.updatedAt,
    };
  }

  private serializeGroup(group: {
    id: string;
    companyId: string | null;
    company?: { id: string; name: string } | null;
    nameAr: string;
    nameEn: string | null;
    areaCategory: string;
    baseRate: Prisma.Decimal;
    active: boolean;
    sortOrder: number;
    locations: Array<{
      id: string;
      level: string;
      governorate: string;
      cityRegion: string | null;
      townNeighborhood: string | null;
      locationKey: string;
      companyId?: string | null;
    }>;
  }) {
    return {
      id: group.id,
      companyId: group.companyId,
      company: group.company ? { id: group.company.id, name: group.company.name } : null,
      nameAr: group.nameAr,
      nameEn: group.nameEn,
      areaCategory: group.areaCategory,
      baseRate: group.baseRate.toString(),
      active: group.active,
      sortOrder: group.sortOrder,
      locations: group.locations.map((location) => ({
        id: location.id,
        level: location.level,
        governorate: location.governorate,
        cityRegion: location.cityRegion,
        townNeighborhood: location.townNeighborhood,
        locationKey: location.locationKey,
        companyId: location.companyId ?? group.companyId,
      })),
    };
  }
}
