import { Injectable } from '@nestjs/common';
import { OutboundOrderStatus, Prisma } from '@prisma/client';

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

      const whereBase: Prisma.OutboundOrderWhereInput = {
        ...(companyFilter ? { companyId: companyFilter } : {}),
      };

      const [
        ordersToday,
        pendingOrders,
        allocatedOrders,
        picking,
        packing,
        outForDelivery,
        deliveredToday,
        codPending,
        codCollected,
        codSettled,
        returns,
      ] = await Promise.all([
        tx.outboundOrder.count({
          where: { ...whereBase, createdAt: { gte: todayStart } },
        }),
        tx.outboundOrder.count({
          where: {
            ...whereBase,
            status: {
              in: [
                OutboundOrderStatus.draft,
                OutboundOrderStatus.pending_approval,
                OutboundOrderStatus.pending_stock,
              ],
            },
          },
        }),
        tx.outboundOrder.count({
          where: {
            ...whereBase,
            status: OutboundOrderStatus.allocated,
          },
        }),
        tx.outboundOrder.count({
          where: { ...whereBase, status: OutboundOrderStatus.picking },
        }),
        tx.outboundOrder.count({
          where: { ...whereBase, status: OutboundOrderStatus.packing },
        }),
        tx.outboundOrder.count({
          where: { ...whereBase, status: OutboundOrderStatus.out_for_delivery },
        }),
        tx.outboundOrder.count({
          where: {
            ...whereBase,
            status: { in: [OutboundOrderStatus.delivered, OutboundOrderStatus.shipped] },
            OR: [
              { deliveredAt: { gte: todayStart } },
              { shippedAt: { gte: todayStart } },
            ],
          },
        }),
        tx.outboundOrder.count({
          where: { ...whereBase, codStatus: 'pending' },
        }),
        tx.outboundOrder.count({
          where: { ...whereBase, codStatus: 'collected' },
        }),
        tx.outboundOrder.count({
          where: { ...whereBase, codStatus: 'settled' },
        }),
        tx.outboundOrder.count({
          where: { ...whereBase, status: OutboundOrderStatus.returned },
        }),
      ]);

      return {
        ordersToday,
        pendingOrders,
        allocatedOrders,
        picking,
        packing,
        outForDelivery,
        deliveredToday,
        codPending,
        codCollected,
        codSettled,
        returns,
      };
    });
  }
}
