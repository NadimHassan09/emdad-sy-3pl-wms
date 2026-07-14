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
        tx.omsOrder.count({
          where: { ...whereBase, createdAt: { gte: todayStart } },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: { in: [OmsOrderStatus.draft, OmsOrderStatus.confirmed] },
          },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: OmsOrderStatus.allocated,
          },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: OmsOrderStatus.processing,
            outboundOrder: { status: 'picking' },
          },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: OmsOrderStatus.processing,
            outboundOrder: { status: 'packing' },
          },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.out_for_delivery },
        }),
        tx.omsOrder.count({
          where: {
            ...whereBase,
            status: { in: [OmsOrderStatus.delivered, OmsOrderStatus.shipped] },
            OR: [
              { deliveredAt: { gte: todayStart } },
              { outForDeliveryAt: { gte: todayStart } },
            ],
          },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, codStatus: 'pending' },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, codStatus: 'collected' },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, codStatus: 'settled' },
        }),
        tx.omsOrder.count({
          where: { ...whereBase, status: OmsOrderStatus.returned },
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
