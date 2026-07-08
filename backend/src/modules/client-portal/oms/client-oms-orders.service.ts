import { Injectable } from '@nestjs/common';
import { OmsCodStatus, Prisma } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { withTenantRls } from '../../../common/prisma/tenant-rls';
import { OmsOrderEventsService } from '../../oms/oms-order-events.service';
import { serializeOmsOrder } from '../../oms/oms-order.mapper';
import { ClientOutboundOrdersService } from '../outbound/client-outbound-orders.service';

export type ClientCodReportQuery = {
  limit: number;
  offset: number;
  codStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class ClientOmsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: ClientOutboundOrdersService,
    private readonly events: OmsOrderEventsService,
  ) {}

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.outbound.findOne(client, id);
    const timeline = await this.events.listForOrder(id);
    const reservations = await this.prisma.stockReservation.findMany({
      where: { outboundOrderId: id, companyId: client.companyId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...serializeOmsOrder(order),
      timeline,
      reservations: reservations.map((r) => ({
        ...r,
        quantity: r.quantity.toString(),
      })),
    };
  }

  async timeline(client: ClientPrincipal, id: string) {
    await this.outbound.findOne(client, id);
    return this.events.listForOrder(id);
  }

  async codReport(client: ClientPrincipal, query: ClientCodReportQuery) {
    const user = clientAuthPrincipal(client);
    const where: Prisma.OutboundOrderWhereInput = {
      companyId: client.companyId,
      paymentMethod: 'COD',
    };

    if (query.codStatus?.trim()) {
      const status = query.codStatus.trim() as OmsCodStatus;
      if (Object.values(OmsCodStatus).includes(status)) {
        where.codStatus = status;
      }
    }

    if (query.dateFrom || query.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total, summary] = await Promise.all([
        tx.outboundOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
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
        tx.outboundOrder.count({ where }),
        tx.outboundOrder.aggregate({
          where,
          _sum: { codAmount: true },
          _count: { id: true },
        }),
      ]);

      return {
        items: items.map((row) => ({
          ...row,
          codAmount: row.codAmount?.toString() ?? null,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
        summary: {
          orderCount: summary._count.id,
          totalCodAmount: summary._sum.codAmount?.toString() ?? '0',
        },
      };
    });
  }
}
