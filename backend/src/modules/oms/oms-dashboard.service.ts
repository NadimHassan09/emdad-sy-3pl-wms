import { Injectable } from '@nestjs/common';
import { OmsOrderStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';

/** Commercial in-fulfillment — warehouse prep / ready (not yet shipped commercially). */
const PENDING_FULFILLMENT: OmsOrderStatus[] = [
  OmsOrderStatus.pending,
  OmsOrderStatus.approved,
  OmsOrderStatus.confirmed,
  OmsOrderStatus.processing,
  OmsOrderStatus.allocated,
  OmsOrderStatus.picking,
  OmsOrderStatus.packing,
  OmsOrderStatus.ready_to_ship,
];

/** Awaiting client confirm or admin approval. */
const AWAITING_APPROVAL: OmsOrderStatus[] = [
  OmsOrderStatus.waiting_for_confirmation,
  OmsOrderStatus.confirmed_waiting_for_admin_approval,
  OmsOrderStatus.pending_approval,
];

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class OmsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  async summary(user: AuthPrincipal, companyId?: string) {
    const companyFilter = readCompanyIdCatalogFilter(
      this.companyAccess,
      user,
      companyId,
    );

    return withTenantRls(this.prisma, user, async (tx) => {
      const todayStart = startOfLocalDay();
      const yesterdayStart = startOfLocalDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const weekStart = startOfLocalDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

      const whereBase: Prisma.OmsOrderWhereInput = {
        ...(companyFilter ? { companyId: companyFilter } : {}),
      };

      const [
        totalOrders,
        ordersToday,
        ordersYesterday,
        pendingApproval,
        pendingApprovalYesterday,
        pendingFulfillment,
        pendingFulfillmentYesterday,
        deliveredToday,
        deliveredYesterday,
        returns,
        returnsYesterday,
        codPendingCount,
        codCollectedCount,
        codPendingSum,
        codCollectedSum,
        revenueToday,
        revenueYesterday,
        byStatus,
        byChannel,
        recentOrders,
        weekOrders,
        liveEvents,
      ] = await Promise.all([
        tx.omsOrder.count({ where: whereBase }),
        tx.omsOrder.count({
          where: { ...whereBase, createdAt: { gte: todayStart } },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            createdAt: { gte: yesterdayStart, lt: todayStart },
          },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: { in: AWAITING_APPROVAL } },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: { in: AWAITING_APPROVAL },
            createdAt: { lt: todayStart },
          },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: { in: PENDING_FULFILLMENT } },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: { in: PENDING_FULFILLMENT },
            updatedAt: { lt: todayStart },
          },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: {
              in: [OmsOrderStatus.delivered, OmsOrderStatus.completed],
            },
            deliveredAt: { gte: todayStart },
          },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: {
              in: [OmsOrderStatus.delivered, OmsOrderStatus.completed],
            },
            deliveredAt: { gte: yesterdayStart, lt: todayStart },
          },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.returned },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: OmsOrderStatus.returned,
            updatedAt: { gte: yesterdayStart, lt: todayStart },
          },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, codStatus: 'pending' },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, codStatus: 'collected' },
        }),
        tx.omsOrder.aggregate({
          where: { ...whereBase, codStatus: 'pending' },
          _sum: { codAmount: true },
        }),
        tx.omsOrder.aggregate({
          where: { ...whereBase, codStatus: 'collected' },
          _sum: { codAmount: true },
        }),
        tx.omsOrder.aggregate({
          where: { ...whereBase, createdAt: { gte: todayStart } },
          _sum: { subtotal: true },
        }),
        tx.omsOrder.aggregate({
          where: {
            ...whereBase,
            createdAt: { gte: yesterdayStart, lt: todayStart },
          },
          _sum: { subtotal: true },
        }),
        tx.omsOrder.groupBy({
          by: ['status'],
          where: whereBase,
          _count: { id: true },
        }),
        tx.omsOrder.groupBy({
          by: ['storeChannel'],
          where: whereBase,
          _count: { id: true },
        }),
        tx.omsOrder.findMany({
          where: whereBase,
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            recipientName: true,
            storeChannel: true,
            paymentMethod: true,
            codAmount: true,
            subtotal: true,
            currency: true,
            createdAt: true,
            company: { select: { id: true, name: true } },
          },
        }),
        tx.omsOrder.findMany({
          where: { ...whereBase, createdAt: { gte: weekStart } },
          select: {
            createdAt: true,
            subtotal: true,
            codAmount: true,
            codStatus: true,
          },
        }),
        tx.omsOrderEvent.findMany({
          where: companyFilter ? { companyId: companyFilter } : {},
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            creator: { select: { id: true, fullName: true } },
            omsOrder: { select: { id: true, orderNumber: true } },
          },
        }),
      ]);

      const pendingCommercial =
        byStatus.find((r) => r.status === OmsOrderStatus.pending)?._count.id ?? 0;
      const pendingLegacy = byStatus
        .filter((r) =>
          (
            [
              OmsOrderStatus.approved,
              OmsOrderStatus.confirmed,
              OmsOrderStatus.processing,
              OmsOrderStatus.allocated,
              OmsOrderStatus.picking,
              OmsOrderStatus.packing,
              OmsOrderStatus.ready_to_ship,
              OmsOrderStatus.shipped,
              OmsOrderStatus.failed_delivery,
            ] as OmsOrderStatus[]
          ).includes(r.status),
        )
        .reduce((s, r) => s + r._count.id, 0);
      const pending = pendingCommercial + pendingLegacy;
      const outForDelivery =
        byStatus.find((r) => r.status === OmsOrderStatus.out_for_delivery)?._count
          .id ?? 0;
      const cancelled =
        (byStatus.find((r) => r.status === OmsOrderStatus.cancelled)?._count.id ??
          0) +
        (byStatus.find((r) => r.status === OmsOrderStatus.rejected)?._count.id ??
          0);

      const perDay = new Map<
        string,
        { orders: number; revenue: number; codPending: number; codCollected: number }
      >();
      for (let i = 6; i >= 0; i--) {
        const d = startOfLocalDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
        perDay.set(dayKey(d), {
          orders: 0,
          revenue: 0,
          codPending: 0,
          codCollected: 0,
        });
      }
      for (const row of weekOrders) {
        const key = dayKey(startOfLocalDay(row.createdAt));
        const bucket = perDay.get(key);
        if (!bucket) continue;
        bucket.orders += 1;
        bucket.revenue += Number(row.subtotal ?? 0);
        if (row.codStatus === 'pending') {
          bucket.codPending += Number(row.codAmount ?? 0);
        }
        if (row.codStatus === 'collected') {
          bucket.codCollected += Number(row.codAmount ?? 0);
        }
      }

      const pctChange = (today: number, yesterday: number): number | null => {
        if (yesterday === 0) return today === 0 ? 0 : null;
        return Math.round(((today - yesterday) / yesterday) * 100);
      };

      const revToday = Number(revenueToday._sum.subtotal ?? 0);
      const revYest = Number(revenueYesterday._sum.subtotal ?? 0);

      return {
        totalOrders,
        ordersToday,
        pendingOrders: pendingApproval,
        pendingApproval,
        pendingFulfillment: pending,
        pending,
        approved: pending,
        allocatedOrders: pending,
        picking: 0,
        packing: 0,
        outForDelivery,
        deliveredToday,
        cancelled,
        returns,
        codPending: codPendingCount,
        codCollected: codCollectedCount,
        codSettled: 0,
        codPendingAmount: (codPendingSum._sum.codAmount ?? 0).toString(),
        codCollectedAmount: (codCollectedSum._sum.codAmount ?? 0).toString(),
        todaysRevenue: (revenueToday._sum.subtotal ?? 0).toString(),
        trends: {
          ordersToday: pctChange(ordersToday, ordersYesterday),
          pendingApproval: pctChange(pendingApproval, pendingApprovalYesterday),
          pendingFulfillment: pctChange(
            pendingFulfillment,
            pendingFulfillmentYesterday,
          ),
          deliveredToday: pctChange(deliveredToday, deliveredYesterday),
          returns: pctChange(returns, returnsYesterday),
          todaysRevenue: pctChange(revToday, revYest),
        },
        ordersByStatus: byStatus.map((r) => ({
          status: r.status,
          count: r._count.id,
        })),
        ordersByChannel: byChannel.map((r) => ({
          channel: r.storeChannel ?? '—',
          count: r._count.id,
        })),
        ordersPerDay: Array.from(perDay.entries()).map(([day, v]) => ({
          day,
          count: v.orders,
          revenue: String(v.revenue),
          codPending: String(v.codPending),
          codCollected: String(v.codCollected),
        })),
        liveActivity: liveEvents.map((ev) => ({
          id: ev.id,
          eventType: ev.eventType,
          createdAt: ev.createdAt,
          orderId: ev.omsOrder?.id ?? null,
          orderNumber: ev.omsOrder?.orderNumber ?? null,
          actorName: ev.creator?.fullName ?? null,
          payload: ev.payload,
        })),
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          recipientName: o.recipientName,
          storeChannel: o.storeChannel,
          paymentMethod: o.paymentMethod,
          codAmount: o.codAmount?.toString() ?? null,
          subtotal: o.subtotal?.toString() ?? null,
          currency: o.currency,
          createdAt: o.createdAt,
          companyName: o.company?.name ?? null,
        })),
        alerts: [
          ...(pendingApproval > 0
            ? [
                {
                  kind: 'pending_approval' as const,
                  message: `${pendingApproval} order${pendingApproval === 1 ? '' : 's'} pending approval`,
                  count: pendingApproval,
                },
              ]
            : []),
          ...(returns > 0
            ? [
                {
                  kind: 'returns' as const,
                  message: `${returns} return${returns === 1 ? '' : 's'} on file`,
                  count: returns,
                },
              ]
            : []),
        ],
      };
    });
  }

  /**
   * Filtered status counts for the Order summary card (date range + optional company).
   */
  async orderSummary(
    user: AuthPrincipal,
    query: {
      createdFrom?: string;
      createdTo?: string;
      companyId?: string;
    },
  ) {
    const companyFilter = readCompanyIdCatalogFilter(
      this.companyAccess,
      user,
      query.companyId,
    );

    const where: Prisma.OmsOrderWhereInput = {
      ...(companyFilter ? { companyId: companyFilter } : {}),
    };

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
      const grouped = await tx.omsOrder.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      });

      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const row of grouped) {
        const n = row._count._all;
        byStatus[row.status] = n;
        total += n;
      }

      return {
        total,
        byStatus,
        ordersByStatus: grouped.map((r) => ({
          status: r.status,
          count: r._count._all,
        })),
      };
    });
  }
}
