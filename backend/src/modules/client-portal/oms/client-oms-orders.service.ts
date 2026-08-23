import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { withTenantRls } from '../../../common/prisma/tenant-rls';
import { ListOmsOrdersQueryDto } from '../../oms/dto/list-oms-orders-query.dto';
import { CreateOmsOrderDto } from '../../oms/dto/oms-order.dto';
import { OmsOrdersService } from '../../oms/oms-orders.service';
import { CreateClientOmsOrderDto } from './dto/create-client-oms-order.dto';
import { ClientCodReportQueryDto } from './dto/client-cod-report-query.dto';
import { ClientOmsStatusSummaryQueryDto } from './dto/client-oms-status-summary-query.dto';
import { ListClientOmsOrdersQueryDto } from './dto/list-client-oms-orders-query.dto';
import { portalCodStatusFromRecord } from './portal-cod-status.util';

function matchesPortalCodFilter(
  portalStatus: string | null | undefined,
  filter?: string,
): boolean {
  if (!filter?.trim()) return true;
  const f = filter.trim();
  if (f === 'settled') return portalStatus === 'remitted' || portalStatus === 'settled';
  if (f === 'available') return portalStatus === 'collected';
  if (f === 'paid_out') return portalStatus === 'remitted';
  if (f === 'returned') return portalStatus === 'returned';
  return portalStatus === f;
}

@Injectable()
export class ClientOmsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly omsOrders: OmsOrdersService,
  ) {}

  async list(client: ClientPrincipal, query: ListClientOmsOrdersQueryDto) {
    const user = clientAuthPrincipal(client);
    const scoped: ListOmsOrdersQueryDto = {
      ...query,
      companyId: client.companyId,
    };
    return this.omsOrders.list(user, scoped);
  }

  /**
   * Full-set status counts for dashboard Order summary / pie charts.
   * Avoids the client-side limit:500 truncation bug.
   */
  async statusSummary(
    client: ClientPrincipal,
    query: ClientOmsStatusSummaryQueryDto,
  ) {
    const user = clientAuthPrincipal(client);
    const where: Prisma.OmsOrderWhereInput = {
      companyId: client.companyId,
    };

    if (query.storeChannel?.trim()) {
      where.storeChannel = {
        contains: query.storeChannel.trim(),
        mode: 'insensitive',
      };
    }

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) {
        createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      }
      if (query.createdTo) {
        createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      }
      where.createdAt = createdAt;
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const [grouped, channelRows] = await Promise.all([
        tx.omsOrder.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        tx.omsOrder.findMany({
          where: {
            companyId: client.companyId,
            ...(query.createdFrom || query.createdTo
              ? {
                  createdAt: {
                    ...(query.createdFrom
                      ? { gte: new Date(`${query.createdFrom}T00:00:00.000Z`) }
                      : {}),
                    ...(query.createdTo
                      ? { lte: new Date(`${query.createdTo}T23:59:59.999Z`) }
                      : {}),
                  },
                }
              : {}),
            storeChannel: { not: null },
          },
          select: { storeChannel: true },
          distinct: ['storeChannel'],
          take: 200,
        }),
      ]);

      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const row of grouped) {
        const n = row._count._all;
        byStatus[row.status] = n;
        total += n;
      }

      const storeChannels = channelRows
        .map((r) => r.storeChannel?.trim())
        .filter((c): c is string => !!c)
        .sort((a, b) => a.localeCompare(b));

      return { total, byStatus, storeChannels };
    });
  }

  async create(client: ClientPrincipal, dto: CreateClientOmsOrderDto) {
    const user = clientAuthPrincipal(client);
    const payload: CreateOmsOrderDto = {
      companyId: client.companyId,
      requiredShipDate: dto.requiredShipDate,
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      city: dto.city,
      district: dto.district,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      notes: dto.notes,
      storeChannel: dto.storeChannel,
      paymentMethod: dto.paymentMethod,
      currency: dto.currency ?? 'USD',
      shippingPhoneCountry: dto.shippingPhoneCountry,
      shippingReceiverLat: dto.shippingReceiverLat,
      shippingReceiverLng: dto.shippingReceiverLng,
      babelNeighbourhoodId: dto.babelNeighbourhoodId,
      // Clients must not set shipping fee — admin sets it before/at approval.
      lines: dto.lines.map((l) => ({
        productId: l.productId,
        requestedQuantity: l.requestedQuantity,
        unitPrice: l.unitPrice,
        lineTotal:
          l.unitPrice != null ? l.unitPrice * l.requestedQuantity : undefined,
      })),
    };
    return this.omsOrders.create(user, payload);
  }

  async createFromApi(
    client: ClientPrincipal,
    dto: CreateClientOmsOrderDto & {
      externalReference: string;
      clientReference?: string;
      addressLine2?: string;
      shippingReceiverLat: number;
      shippingReceiverLng: number;
    },
  ) {
    const user = clientAuthPrincipal(client);
    const payload: CreateOmsOrderDto = {
      companyId: client.companyId,
      requiredShipDate: dto.requiredShipDate,
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      city: dto.city,
      district: dto.district,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      notes: dto.notes,
      storeChannel: dto.storeChannel,
      paymentMethod: dto.paymentMethod,
      currency: dto.currency ?? 'USD',
      shippingPhoneCountry: dto.shippingPhoneCountry,
      externalReference: dto.externalReference,
      clientReference: dto.clientReference,
      shippingReceiverLat: dto.shippingReceiverLat,
      shippingReceiverLng: dto.shippingReceiverLng,
      lines: dto.lines.map((l) => ({
        productId: l.productId,
        requestedQuantity: l.requestedQuantity,
        unitPrice: l.unitPrice,
        lineTotal:
          l.unitPrice != null ? l.unitPrice * l.requestedQuantity : undefined,
      })),
    };
    return this.omsOrders.create(user, payload);
  }

  async findByExternalReference(client: ClientPrincipal, externalReference: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.findExistingByExternalReference(
      user,
      client.companyId,
      externalReference,
    );
  }

  async resolveSkus(companyId: string, skus: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(skus.map((s) => s.trim()).filter(Boolean)));
    const products = await this.omsOrders.findProductsBySkus(companyId, unique);
    const map = new Map<string, string>();
    for (const p of products) {
      map.set(p.sku.trim().toUpperCase(), p.id);
    }
    const missing = unique.filter((sku) => !map.has(sku.toUpperCase()));
    if (missing.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Unknown SKU(s): ${missing.join(', ')}`,
        fields: { sku: `Unknown SKU(s): ${missing.join(', ')}` },
      });
    }
    return map;
  }

  async confirm(client: ClientPrincipal, id: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.confirm(id, user);
  }

  /**
   * Confirm many OMS orders (client). Each id is confirmed independently;
   * failures do not roll back successes.
   */
  async confirmBulk(client: ClientPrincipal, ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const confirmed: Array<{ id: string; orderNumber: string }> = [];
    const failed: Array<{ id: string; orderNumber: string | null; error: string }> = [];

    for (const id of uniqueIds) {
      try {
        const order = await this.confirm(client, id);
        confirmed.push({
          id: order.id,
          orderNumber: order.orderNumber,
        });
      } catch (err) {
        let orderNumber: string | null = null;
        try {
          const existing = await this.findOne(client, id);
          orderNumber = existing.orderNumber ?? null;
        } catch {
          /* ignore lookup failure */
        }
        failed.push({
          id,
          orderNumber,
          error: err instanceof Error ? err.message : 'Confirm failed.',
        });
      }
    }

    return {
      requested: uniqueIds.length,
      confirmed: confirmed.length,
      failed: failed.length,
      confirmedOrders: confirmed,
      failures: failed,
    };
  }

  async cancel(client: ClientPrincipal, id: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.cancel(id, user);
  }

  async findOne(client: ClientPrincipal, id: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.findById(id, user);
  }

  async timeline(client: ClientPrincipal, id: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.timeline(id, user);
  }

  /**
   * Client COD report: prefer CodRecord (current amount + adjustments),
   * fall back to OMS order COD fields for legacy rows without a CodRecord.
   */
  async codReport(client: ClientPrincipal, query: ClientCodReportQueryDto) {
    const user = clientAuthPrincipal(client);

    const createdAt: Prisma.DateTimeFilter | undefined =
      query.dateFrom || query.dateTo
        ? {
            ...(query.dateFrom
              ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
              : {}),
            ...(query.dateTo
              ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) }
              : {}),
          }
        : undefined;

    return withTenantRls(this.prisma, user, async (tx) => {
      const [codRecords, legacyOrders] = await Promise.all([
        tx.codRecord.findMany({
          where: {
            companyId: client.companyId,
            ...(createdAt
              ? {
                  omsOrder: {
                    paymentMethod: 'COD',
                    createdAt,
                    ...(query.storeChannel?.trim()
                      ? {
                          storeChannel: {
                            contains: query.storeChannel.trim(),
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  },
                }
              : {
                  omsOrder: {
                    paymentMethod: 'COD',
                    ...(query.storeChannel?.trim()
                      ? {
                          storeChannel: {
                            contains: query.storeChannel.trim(),
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  },
                }),
          },
          include: {
            adjustments: { select: { amount: true } },
            omsOrder: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                recipientName: true,
                currency: true,
                createdAt: true,
                deliveredAt: true,
                storeChannel: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        tx.omsOrder.findMany({
          where: {
            companyId: client.companyId,
            paymentMethod: 'COD',
            codRecord: null,
            ...(createdAt ? { createdAt } : {}),
            ...(query.storeChannel?.trim()
              ? {
                  storeChannel: {
                    contains: query.storeChannel.trim(),
                    mode: 'insensitive',
                  },
                }
              : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            recipientName: true,
            codAmount: true,
            codStatus: true,
            codCollectedAt: true,
            codRemittedAt: true,
            currency: true,
            createdAt: true,
            deliveredAt: true,
          },
        }),
      ]);

      type Row = {
        id: string;
        orderNumber: string;
        status: string;
        recipientName: string | null;
        codAmount: string | null;
        codStatus: string | null;
        codCollectedAt: Date | null;
        codRemittedAt: Date | null;
        currency: string | null;
        createdAt: Date;
        deliveredAt: Date | null;
        codRecordId?: string;
      };

      const rows: Row[] = [];

      for (const rec of codRecords) {
        const adjSum = rec.adjustments.reduce(
          (s, a) => s.add(a.amount),
          new Prisma.Decimal(0),
        );
        const current = rec.originalAmount.add(adjSum);
        const portalStatus = portalCodStatusFromRecord(rec.status);
        rows.push({
          id: rec.omsOrder.id,
          orderNumber: rec.omsOrder.orderNumber,
          status: rec.omsOrder.status,
          recipientName: rec.omsOrder.recipientName,
          codAmount: current.toString(),
          codStatus: portalStatus,
          codCollectedAt: rec.availableAt,
          codRemittedAt: rec.paidOutAt,
          currency: rec.currency ?? rec.omsOrder.currency,
          createdAt: rec.omsOrder.createdAt,
          deliveredAt: rec.omsOrder.deliveredAt,
          codRecordId: rec.id,
        });
      }

      for (const order of legacyOrders) {
        rows.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          recipientName: order.recipientName,
          codAmount: order.codAmount?.toString() ?? null,
          codStatus: order.codStatus,
          codCollectedAt: order.codCollectedAt,
          codRemittedAt: order.codRemittedAt,
          currency: order.currency,
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt,
        });
      }

      const filtered = rows.filter((r) =>
        matchesPortalCodFilter(r.codStatus, query.codStatus),
      );
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = filtered.length;
      const page = filtered.slice(query.offset, query.offset + query.limit);
      const totalCodAmount = filtered.reduce((sum, r) => {
        const n = Number(r.codAmount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      return {
        items: page,
        total,
        limit: query.limit,
        offset: query.offset,
        summary: {
          orderCount: total,
          totalCodAmount: String(totalCodAmount),
        },
      };
    });
  }
}
