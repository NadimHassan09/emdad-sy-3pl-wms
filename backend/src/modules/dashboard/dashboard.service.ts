import { Injectable } from '@nestjs/common';
import { InboundOrderStatus, OutboundOrderStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';

export type ChartSlice = { key: string; label: string; count: number };

export type OpenOrdersChartsDto = {
  inbound: ChartSlice[];
  outbound: ChartSlice[];
};

const INBOUND_OPEN: InboundOrderStatus[] = [
  InboundOrderStatus.draft,
  InboundOrderStatus.confirmed,
  InboundOrderStatus.in_progress,
  InboundOrderStatus.partially_received,
];

const OUTBOUND_OPEN: OutboundOrderStatus[] = [
  OutboundOrderStatus.draft,
  OutboundOrderStatus.pending_stock,
  OutboundOrderStatus.confirmed,
  OutboundOrderStatus.picking,
  OutboundOrderStatus.packing,
  OutboundOrderStatus.ready_to_ship,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async openOrdersCharts(user: AuthPrincipal): Promise<OpenOrdersChartsDto> {
    const companyWhereInbound: Prisma.InboundOrderWhereInput = user.companyId
      ? { companyId: user.companyId }
      : {};
    const companyWhereOutbound: Prisma.OutboundOrderWhereInput = user.companyId
      ? { companyId: user.companyId }
      : {};

    const [inboundGroups, outboundGroups] = await Promise.all([
      this.prisma.inboundOrder.groupBy({
        by: ['status'],
        where: {
          ...companyWhereInbound,
          status: { in: INBOUND_OPEN },
        },
        _count: { _all: true },
      }),
      this.prisma.outboundOrder.groupBy({
        by: ['status'],
        where: {
          ...companyWhereOutbound,
          status: { in: OUTBOUND_OPEN },
        },
        _count: { _all: true },
      }),
    ]);

    const inCount = (s: InboundOrderStatus) =>
      inboundGroups.find((g) => g.status === s)?._count._all ?? 0;

    const inbound: ChartSlice[] = [
      {
        key: 'new',
        label: 'New',
        count: inCount(InboundOrderStatus.draft) + inCount(InboundOrderStatus.confirmed),
      },
      {
        key: 'receive',
        label: 'Receive',
        count: inCount(InboundOrderStatus.in_progress),
      },
      {
        key: 'putaway',
        label: 'Putaway',
        count: inCount(InboundOrderStatus.partially_received),
      },
    ];

    const outCount = (s: OutboundOrderStatus) =>
      outboundGroups.find((g) => g.status === s)?._count._all ?? 0;

    const outbound: ChartSlice[] = [
      {
        key: 'picking',
        label: 'Picking',
        count:
          outCount(OutboundOrderStatus.draft) +
          outCount(OutboundOrderStatus.pending_stock) +
          outCount(OutboundOrderStatus.confirmed) +
          outCount(OutboundOrderStatus.picking),
      },
      {
        key: 'packing',
        label: 'Packing',
        count: outCount(OutboundOrderStatus.packing),
      },
      {
        key: 'shipping',
        label: 'Shipping',
        count: outCount(OutboundOrderStatus.ready_to_ship),
      },
    ];

    return { inbound, outbound };
  }
}
