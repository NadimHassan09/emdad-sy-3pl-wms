import { Injectable } from '@nestjs/common';
import {
  InboundOrderStatus,
  OutboundOrderStatus,
  WarehouseTaskStatus,
  WarehouseTaskType,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TaskRunnableShape } from '../warehouse-workflow/task-runnable.util';
import {
  buildInboundOpenOrdersChart,
  buildOutboundOpenOrdersChart,
} from './open-orders-chart.util';

export type ChartSlice = { key: string; label: string; count: number };

export type OpenOrdersChartSideDto = {
  stages: ChartSlice[];
  inProgress: number;
  notInProgress: number;
};

export type OpenOrdersChartsDto = {
  inbound: OpenOrdersChartSideDto;
  outbound: OpenOrdersChartSideDto;
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
  openTasksByType: Array<{
    key: string;
    label: string;
    /** Non-completed tasks (pending, assigned, in_progress, blocked, retry_pending). */
    openCount: number;
    /** Open tasks with an active worker assignment and status in_progress (started). */
    inProgressCount: number;
  }>;
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
  InboundOrderStatus.pending_approval,
  InboundOrderStatus.confirmed,
  InboundOrderStatus.in_progress,
  InboundOrderStatus.partially_received,
];

const OUTBOUND_OPEN: OutboundOrderStatus[] = [
  OutboundOrderStatus.draft,
  OutboundOrderStatus.pending_approval,
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

const TASK_CARD_KEYS = new Set<string>(TASK_CARD_MAP.map((t) => t.key));

/** Task types included in open / in-progress queries (card keys + inbound variants). */
const TASK_TYPES_TRACKED: WarehouseTaskType[] = [
  ...TASK_CARD_MAP.map((t) => t.key as WarehouseTaskType),
  WarehouseTaskType.putaway_quarantine,
];

/**
 * Aligns with open-orders chart: assigned (with worker), in_progress, blocked, retry_pending
 * are "under progress"; pending-only rows are open but not started.
 */
function taskUnderProgressWhere() {
  return {
    OR: [
      { status: WarehouseTaskStatus.in_progress },
      { status: WarehouseTaskStatus.blocked },
      { status: WarehouseTaskStatus.retry_pending },
      {
        status: WarehouseTaskStatus.assigned,
        assignments: { some: { unassignedAt: null } },
      },
    ],
  };
}

function rollupTaskTypeToCardKey(taskType: string): string | null {
  if (taskType === 'putaway_quarantine') return 'putaway';
  return TASK_CARD_KEYS.has(taskType) ? taskType : null;
}

function incrementCardCount(map: Map<string, number>, taskType: string, delta = 1): void {
  const key = rollupTaskTypeToCardKey(taskType);
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + delta);
}

/** Prisma groupBy may return `_count` as a number or `{ _all: number }`. */
function groupByRowCount(row: { _count: unknown }): number {
  const c = row._count;
  if (typeof c === 'number' && Number.isFinite(c)) return c;
  if (c && typeof c === 'object' && '_all' in c) {
    const all = (c as { _all: unknown })._all;
    if (typeof all === 'number' && Number.isFinite(all)) return all;
  }
  return 0;
}

/** UTC calendar day (matches PostgreSQL `DATE` comparisons). */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcMonths(day: Date, months: number): Date {
  const x = new Date(day);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async openOrdersCharts(_user: AuthPrincipal): Promise<OpenOrdersChartsDto> {
    // Warehouse KPIs: all customers (ignore request-scoped X-Company-Id).
    const [openInbound, openOutbound] = await Promise.all([
      this.prisma.inboundOrder.findMany({
        where: { status: { in: INBOUND_OPEN } },
        select: { id: true },
      }),
      this.prisma.outboundOrder.findMany({
        where: { status: { in: OUTBOUND_OPEN } },
        select: { id: true },
      }),
    ]);

    const orderIds = [
      ...openInbound.map((o) => o.id),
      ...openOutbound.map((o) => o.id),
    ];

    const workflows =
      orderIds.length === 0
        ? []
        : await this.prisma.workflowInstance.findMany({
            where: {
              referenceType: { in: ['inbound_order', 'outbound_order'] },
              referenceId: { in: orderIds },
            },
            select: { id: true, referenceType: true, referenceId: true },
          });

    const instanceIds = workflows.map((w) => w.id);
    const tasks =
      instanceIds.length === 0
        ? []
        : await this.prisma.warehouseTask.findMany({
            where: { workflowInstanceId: { in: instanceIds } },
            select: { id: true, workflowInstanceId: true, taskType: true, status: true },
          });

    const inboundWorkflowByOrder = new Map<string, string>();
    const outboundWorkflowByOrder = new Map<string, string>();
    for (const wf of workflows) {
      if (wf.referenceType === 'inbound_order') {
        inboundWorkflowByOrder.set(wf.referenceId, wf.id);
      } else if (wf.referenceType === 'outbound_order') {
        outboundWorkflowByOrder.set(wf.referenceId, wf.id);
      }
    }

    const tasksByInstanceId = new Map<string, TaskRunnableShape[]>();
    for (const task of tasks) {
      const cur = tasksByInstanceId.get(task.workflowInstanceId) ?? [];
      cur.push({
        id: task.id,
        taskType: task.taskType,
        status: task.status,
      });
      tasksByInstanceId.set(task.workflowInstanceId, cur);
    }

    const inbound = buildInboundOpenOrdersChart(
      openInbound,
      inboundWorkflowByOrder,
      tasksByInstanceId,
    );
    const outbound = buildOutboundOpenOrdersChart(
      openOutbound,
      outboundWorkflowByOrder,
      tasksByInstanceId,
    );

    return { inbound, outbound };
  }

  async overview(_user: AuthPrincipal): Promise<DashboardOverviewDto> {
    // Warehouse KPIs: all customers (ignore request-scoped X-Company-Id).
    const today = startOfUtcDay(new Date());
    const sixMonthsEnd = addUtcMonths(today, 6);

    const [
      stockAgg,
      productsCount,
      companiesCount,
      openInboundCount,
      openOutboundCount,
      openTasksGrouped,
      underProgressTasks,
      occupiedLocationsCount,
      totalStorageLocationsCount,
      soonExpiryRows,
      missingExpiryRows,
      recentInbound,
      recentOutbound,
    ] = await Promise.all([
      this.prisma.currentStock.aggregate({
        where: {},
        _sum: { quantityOnHand: true },
      }),
      this.prisma.product.count(),
      this.prisma.company.count(),
      this.prisma.inboundOrder.count({
        where: { status: { in: INBOUND_OPEN } },
      }),
      this.prisma.outboundOrder.count({
        where: { status: { in: OUTBOUND_OPEN } },
      }),
      this.prisma.warehouseTask.groupBy({
        by: ['taskType'],
        where: {
          taskType: { in: TASK_TYPES_TRACKED },
          status: { in: OPEN_TASK_STATUSES },
        },
        _count: true,
      }),
      this.prisma.warehouseTask.findMany({
        where: {
          taskType: { in: TASK_TYPES_TRACKED },
          status: { in: OPEN_TASK_STATUSES },
          ...taskUnderProgressWhere(),
        },
        select: { taskType: true },
      }),
      this.prisma.location.count({
        where: {
          type: { in: ['internal', 'fridge', 'quarantine'] },
          status: 'active',
          currentStock: {
            some: {
              quantityOnHand: { gt: 0 },
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
          quantityOnHand: { gt: 0 },
          lotId: { not: null },
          lot: {
            expiryDate: { not: null, lte: sixMonthsEnd },
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
      this.prisma.currentStock.findMany({
        where: {
          quantityOnHand: { gt: 0 },
          lotId: { not: null },
          product: { expiryTracking: true, trackingType: 'lot' },
          lot: { expiryDate: null },
        },
        select: {
          lotId: true,
          quantityOnHand: true,
          lot: { select: { id: true, lotNumber: true, expiryDate: true } },
          product: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: [{ product: { name: 'asc' } }],
        take: 100,
      }),
      this.prisma.inboundOrder.findMany({
        where: { status: { in: INBOUND_OPEN } },
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
        where: { status: { in: OUTBOUND_OPEN } },
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

    const openTaskCounts = new Map<string, number>();
    for (const row of openTasksGrouped) {
      incrementCardCount(openTaskCounts, row.taskType, groupByRowCount(row));
    }
    const inProgressTaskCounts = new Map<string, number>();
    for (const row of underProgressTasks) {
      incrementCardCount(inProgressTaskCounts, row.taskType, 1);
    }
    const openTasksByType = TASK_CARD_MAP.map((t) => {
      const openCount = openTaskCounts.get(t.key) ?? 0;
      const inProgressCount = Math.min(inProgressTaskCounts.get(t.key) ?? 0, openCount);
      return {
        key: t.key,
        label: t.label,
        openCount,
        inProgressCount,
      };
    }).filter((row) => row.openCount > 0);

    const allExpiryAlertRows = [...missingExpiryRows, ...soonExpiryRows];
    const productIds = Array.from(new Set(allExpiryAlertRows.map((r) => r.product.id)));
    const totalsByProduct = await this.prisma.currentStock.groupBy({
      by: ['productId'],
      where: {
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
    for (const row of allExpiryAlertRows) {
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

    const todayMs = today.getTime();
    const soonExpiryLots = Array.from(byLot.values())
      .sort((a, b) => {
        const rank = (expiryDate: string | null) => {
          if (!expiryDate) return 0;
          const ms = new Date(expiryDate).getTime();
          if (ms < todayMs) return 1;
          return 2;
        };
        const ra = rank(a.expiryDate);
        const rb = rank(b.expiryDate);
        if (ra !== rb) return ra - rb;
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
