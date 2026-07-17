import { Injectable } from '@nestjs/common';
import { OmsOrderStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';

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
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const whereBase: Prisma.OmsOrderWhereInput = {
        ...(companyFilter ? { companyId: companyFilter } : {}),
      };

      const [
        totalOrders,
        ordersToday,
        pendingApproval,
        approved,
        picking,
        packing,
        outForDelivery,
        deliveredToday,
        cancelled,
        returns,
        codPending,
        codCollected,
        revenueToday,
        byStatus,
        byChannel,
        recentOrders,
        ordersPerDay,
      ] = await Promise.all([
        tx.omsOrder.count({ where: whereBase }),
        tx.omsOrder.count({
          where: { ...whereBase, createdAt: { gte: todayStart } },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.pending_approval },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: {
              in: [
                OmsOrderStatus.approved,
                OmsOrderStatus.confirmed,
                OmsOrderStatus.allocated,
              ],
            },
          },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.picking },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.packing },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.out_for_delivery },
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
          where: { ...whereBase, status: OmsOrderStatus.cancelled },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.returned },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, codStatus: 'pending' },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, codStatus: 'collected' },
        }),
        tx.omsOrder.aggregate({
          where: {
            ...whereBase,
            createdAt: { gte: todayStart },
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
            subtotal: true,
            currency: true,
            createdAt: true,
          },
        }),
        tx.omsOrder.findMany({
          where: {
            ...whereBase,
            createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          },
          select: { createdAt: true },
        }),
      ]);

      const perDayMap = new Map<string, number>();
      for (const row of ordersPerDay) {
        const day = row.createdAt.toISOString().slice(0, 10);
        perDayMap.set(day, (perDayMap.get(day) ?? 0) + 1);
      }

      return {
        totalOrders,
        ordersToday,
        pendingOrders: pendingApproval,
        pendingApproval,
        approved,
        allocatedOrders: approved,
        picking,
        packing,
        outForDelivery,
        deliveredToday,
        cancelled,
        returns,
        codPending,
        codCollected,
        codSettled: 0,
        todaysRevenue: revenueToday._sum.subtotal?.toString() ?? '0',
        ordersByStatus: byStatus.map((r) => ({
          status: r.status,
          count: r._count.id,
        })),
        ordersByChannel: byChannel.map((r) => ({
          channel: r.storeChannel ?? '—',
          count: r._count.id,
        })),
        ordersPerDay: Array.from(perDayMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, count]) => ({ day, count })),
        recentOrders: recentOrders.map((o) => ({
          ...o,
          subtotal: o.subtotal?.toString() ?? null,
        })),
      };
    });
  }
}
