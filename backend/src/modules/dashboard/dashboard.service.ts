import { Injectable } from '@nestjs/common';
import { InboundOrderStatus, OutboundOrderStatus, Prisma, WarehouseTaskStatus } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';

export type ChartSlice = { key: string; label: string; count: number };

export type OpenOrdersChartsDto = {
  inbound: ChartSlice[];
  outbound: ChartSlice[];
};

export type DashboardOverviewDto = {
  counters: {
    totalItemsInStock: number;
    itemsInCatalog: number;
    totalCustomers: number;
  };
  openOrders: {
    inbound: number;
    outbound: number;
  };
  openTasksByType: Array<{ key: string; label: string; count: number }>;
  capacity: {
    occupiedLocations: number;
    totalStorageLocations: number;
    consumedPercent: number;
  };
  soonExpiryLots: Array<{
    lotId: string;
    lotNumber: string;
    expiryDate: string | null;
    productId: string;
    productName: string;
    locationId: string;
    locationName: string;
    lotQuantity: number;
    productTotalQuantity: number;
  }>;
  recentOrders: {
    inbound: Array<{ id: string; orderNumber: string; status: string; companyName: string; createdAt: string }>;
    outbound: Array<{ id: string; orderNumber: string; status: string; companyName: string; createdAt: string }>;
  };
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

const OPEN_TASK_STATUSES: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.pending,
  WarehouseTaskStatus.assigned,
  WarehouseTaskStatus.in_progress,
  WarehouseTaskStatus.blocked,
  WarehouseTaskStatus.retry_pending,
];

const TASK_CARD_MAP = [
  { key: 'receiving', label: 'Receive' },
  { key: 'putaway', label: 'Putaway' },
  { key: 'pick', label: 'Pick' },
  { key: 'pack', label: 'Pack' },
  { key: 'dispatch', label: 'Delivery' },
  { key: 'routing', label: 'Internal' },
] as const;

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

  async overview(user: AuthPrincipal): Promise<DashboardOverviewDto> {
    const companyId = user.companyId ?? undefined;
    const companyFilter = companyId ? { companyId } : {};
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    const [
      stockAgg,
      productsCount,
      companiesCount,
      openInboundCount,
      openOutboundCount,
      openTasksGrouped,
      occupiedLocationsCount,
      totalStorageLocationsCount,
      soonExpiryRows,
      recentInbound,
      recentOutbound,
    ] = await Promise.all([
      this.prisma.currentStock.aggregate({
        where: { ...companyFilter },
        _sum: { quantityOnHand: true },
      }),
      this.prisma.product.count({ where: { ...companyFilter } }),
      this.prisma.company.count(companyId ? { where: { id: companyId } } : undefined),
      this.prisma.inboundOrder.count({
        where: { ...companyFilter, status: { in: INBOUND_OPEN } },
      }),
      this.prisma.outboundOrder.count({
        where: { ...companyFilter, status: { in: OUTBOUND_OPEN } },
      }),
      this.prisma.warehouseTask.groupBy({
        by: ['taskType'],
        where: {
          status: { in: OPEN_TASK_STATUSES },
          workflowInstance: companyId ? { companyId } : undefined,
        },
        _count: true,
      }),
      this.prisma.location.count({
        where: {
          type: { in: ['internal', 'fridge', 'quarantine'] },
          status: 'active',
          currentStock: {
            some: {
              quantityOnHand: { gt: 0 },
              ...(companyId ? { companyId } : {}),
            },
          },
        },
      }),
      this.prisma.location.count({
        where: {
          type: { in: ['internal', 'fridge', 'quarantine'] },
          status: 'active',
        },
      }),
      this.prisma.currentStock.findMany({
        where: {
          ...companyFilter,
          quantityOnHand: { gt: 0 },
          lot: {
            is: {
              expiryDate: {
                gte: now,
                lte: sixMonthsFromNow,
              },
            },
          },
        },
        select: {
          lotId: true,
          quantityOnHand: true,
          lot: { select: { id: true, lotNumber: true, expiryDate: true } },
          product: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: [{ lot: { expiryDate: 'asc' } }],
        take: 200,
      }),
      this.prisma.inboundOrder.findMany({
        where: { ...companyFilter, status: { in: INBOUND_OPEN } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.outboundOrder.findMany({
        where: { ...companyFilter, status: { in: OUTBOUND_OPEN } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          company: { select: { name: true } },
        },
      }),
    ]);

    const taskCounts = new Map(openTasksGrouped.map((r) => [r.taskType, Number(r._count)]));
    const openTasksByType = TASK_CARD_MAP.map((t) => ({
      key: t.key,
      label: t.label,
      count: taskCounts.get(t.key) ?? 0,
    }));

    const productIds = Array.from(new Set(soonExpiryRows.map((r) => r.product.id)));
    const totalsByProduct = await this.prisma.currentStock.groupBy({
      by: ['productId'],
      where: {
        ...companyFilter,
        productId: { in: productIds },
      },
      _sum: { quantityOnHand: true },
    });
    const productTotalMap = new Map(
      totalsByProduct.map((r) => [r.productId, Number(r._sum.quantityOnHand ?? 0)]),
    );

    const byLot = new Map<
      string,
      {
        lotId: string;
        lotNumber: string;
        expiryDate: string | null;
        productId: string;
        productName: string;
        productTotalQuantity: number;
        locationId: string;
        locationName: string;
        lotQuantity: number;
      }
    >();
    for (const row of soonExpiryRows) {
      if (!row.lot) continue;
      const cur = byLot.get(row.lot.id);
      if (cur) {
        cur.lotQuantity += Number(row.quantityOnHand);
      } else {
        byLot.set(row.lot.id, {
          lotId: row.lot.id,
          lotNumber: row.lot.lotNumber,
          expiryDate: row.lot.expiryDate?.toISOString() ?? null,
          productId: row.product.id,
          productName: row.product.name,
          productTotalQuantity: productTotalMap.get(row.product.id) ?? 0,
          locationId: row.location.id,
          locationName: row.location.name,
          lotQuantity: Number(row.quantityOnHand),
        });
      }
    }

    const soonExpiryLots = Array.from(byLot.values())
      .sort((a, b) => {
        const da = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      })
      .slice(0, 10);

    const consumedPercent =
      totalStorageLocationsCount > 0
        ? Math.round((occupiedLocationsCount / totalStorageLocationsCount) * 100)
        : 0;

    return {
      counters: {
        totalItemsInStock: Number(stockAgg._sum.quantityOnHand ?? 0),
        itemsInCatalog: productsCount,
        totalCustomers: companiesCount,
      },
      openOrders: {
        inbound: openInboundCount,
        outbound: openOutboundCount,
      },
      openTasksByType,
      capacity: {
        occupiedLocations: occupiedLocationsCount,
        totalStorageLocations: totalStorageLocationsCount,
        consumedPercent,
      },
      soonExpiryLots,
      recentOrders: {
        inbound: recentInbound.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          companyName: o.company.name,
          createdAt: o.createdAt.toISOString(),
        })),
        outbound: recentOutbound.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          companyName: o.company.name,
          createdAt: o.createdAt.toISOString(),
        })),
      },
    };
  }
}
