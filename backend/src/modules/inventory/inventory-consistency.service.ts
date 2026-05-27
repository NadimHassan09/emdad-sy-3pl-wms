import { Injectable } from '@nestjs/common';
import { Prisma, WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';

import { readCompanyIdFilter } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InventoryIntegrityException } from '../../common/errors/domain-exceptions';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  InventoryConsistencyFinding,
  InventoryConsistencyReport,
} from './inventory-consistency.types';

/** Mirrors pick `executionState.reservations` slices (kept local to avoid module cycles). */
interface PickReservationSlice {
  outboundOrderLineId: string;
  companyId: string;
  productId: string;
  locationId: string;
  warehouseId: string;
  lotId: string | null;
  quantity: string;
}

const DRIFT_EPSILON = new Prisma.Decimal('0.0001');

type StockTupleKey = string;

function stockTupleKey(parts: {
  companyId: string;
  productId: string;
  locationId: string;
  lotId: string | null;
}): StockTupleKey {
  return `${parts.companyId}|${parts.productId}|${parts.locationId}|${parts.lotId ?? ''}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function reservationRowsFromExec(raw: unknown): PickReservationSlice[] {
  if (!isRecord(raw)) return [];
  const r = raw.reservations;
  return Array.isArray(r) ? (r as PickReservationSlice[]) : [];
}

function pushFinding(
  findings: InventoryConsistencyFinding[],
  finding: InventoryConsistencyFinding,
): void {
  findings.push(finding);
}

function countBySeverity(findings: InventoryConsistencyFinding[]) {
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === 'critical') critical += 1;
    else if (f.severity === 'warning') warning += 1;
    else info += 1;
  }
  return { critical, warning, info };
}

@Injectable()
export class InventoryConsistencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  /**
   * Full consistency scan for admin/ops — returns a structured validation report.
   */
  async validateForUser(
    user: AuthPrincipal,
    opts?: { companyId?: string; warehouseId?: string },
  ): Promise<InventoryConsistencyReport> {
    const companyId = readCompanyIdFilter(this.companyAccess, user, opts?.companyId);
    return this.runValidation({ companyId, warehouseId: opts?.warehouseId });
  }

  async runValidation(scope: {
    companyId?: string;
    warehouseId?: string;
  }): Promise<InventoryConsistencyReport> {
    const findings: InventoryConsistencyFinding[] = [];

    const stockRowsChecked = await this.checkCurrentStockRows(scope, findings);
    await this.checkReservationTableDrift(scope, findings);
    const pickTasksChecked = await this.checkTaskReservationDrift(scope, findings);
    const outboundLinesChecked = await this.checkOutboundLineQuantities(scope, findings);
    await this.checkConcurrentActivePicks(scope, findings);
    await this.checkStalePickSnapshots(scope, findings);

    const summary = {
      ...countBySeverity(findings),
      stockRowsChecked,
      outboundLinesChecked,
      pickTasksChecked,
    };

    return {
      generatedAt: new Date().toISOString(),
      scope,
      summary,
      findings,
      healthy: summary.critical === 0,
    };
  }

  /**
   * Post-mutation safeguard: assert a stock row still satisfies core invariants.
   * Called from StockHelpers after reserve/release/ship updates.
   */
  async assertStockRowInvariants(
    tx: Prisma.TransactionClient,
    m: {
      companyId: string;
      productId: string;
      locationId: string;
      lotId?: string | null;
    },
  ): Promise<void> {
    const lotId = m.lotId ?? null;
    const rows =
      lotId === null
        ? await tx.$queryRaw<
            Array<{ oh: string; res: string; avail: string }>
          >(Prisma.sql`
              SELECT quantity_on_hand::text   AS oh,
                     quantity_reserved::text AS res,
                     quantity_available::text AS avail
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id IS NULL
                 AND package_id IS NULL
            `)
        : await tx.$queryRaw<
            Array<{ oh: string; res: string; avail: string }>
          >(Prisma.sql`
              SELECT quantity_on_hand::text   AS oh,
                     quantity_reserved::text AS res,
                     quantity_available::text AS avail
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id = ${lotId}::uuid
                 AND package_id IS NULL
            `);

    const row = rows[0];
    if (!row) return;

    const onHand = new Prisma.Decimal(row.oh);
    const reserved = new Prisma.Decimal(row.res);
    const available = new Prisma.Decimal(row.avail);

    if (onHand.lessThan(0) || reserved.lessThan(0) || available.lessThan(0)) {
      throw new InventoryIntegrityException('Negative stock quantity detected after inventory move.', {
        companyId: m.companyId,
        productId: m.productId,
        locationId: m.locationId,
        lotId,
        quantityOnHand: onHand.toString(),
        quantityReserved: reserved.toString(),
        quantityAvailable: available.toString(),
      });
    }
    if (reserved.greaterThan(onHand)) {
      throw new InventoryIntegrityException('Reserved quantity exceeds on-hand after inventory move.', {
        companyId: m.companyId,
        productId: m.productId,
        locationId: m.locationId,
        lotId,
        quantityOnHand: onHand.toString(),
        quantityReserved: reserved.toString(),
      });
    }
    const expectedAvail = onHand.minus(reserved);
    if (!available.minus(expectedAvail).abs().lessThanOrEqualTo(DRIFT_EPSILON)) {
      throw new InventoryIntegrityException(
        'Available quantity does not match on-hand minus reserved.',
        {
          companyId: m.companyId,
          productId: m.productId,
          locationId: m.locationId,
          lotId,
          quantityAvailable: available.toString(),
          expectedAvailable: expectedAvail.toString(),
        },
      );
    }
  }

  /** Fail fast when a scoped validation report contains critical issues. */
  async assertScopeHealthy(scope: {
    companyId?: string;
    warehouseId?: string;
  }): Promise<void> {
    const report = await this.runValidation(scope);
    if (!report.healthy) {
      const sample = report.findings
        .filter((f) => f.severity === 'critical')
        .slice(0, 5)
        .map((f) => ({ code: f.code, message: f.message }));
      throw new InventoryIntegrityException(
        `Inventory consistency check failed (${report.summary.critical} critical issue(s)).`,
        { findings: sample, scope: report.scope },
      );
    }
  }

  private async checkCurrentStockRows(
    scope: { companyId?: string; warehouseId?: string },
    findings: InventoryConsistencyFinding[],
  ): Promise<number> {
    const companyFilter = scope.companyId
      ? Prisma.sql`AND cs.company_id = ${scope.companyId}::uuid`
      : Prisma.empty;
    const warehouseFilter = scope.warehouseId
      ? Prisma.sql`AND cs.warehouse_id = ${scope.warehouseId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        company_id: string;
        product_id: string;
        location_id: string;
        warehouse_id: string;
        lot_id: string | null;
        quantity_on_hand: string;
        quantity_reserved: string;
        quantity_available: string;
      }>
    >(Prisma.sql`
      SELECT cs.id,
             cs.company_id,
             cs.product_id,
             cs.location_id,
             cs.warehouse_id,
             cs.lot_id,
             cs.quantity_on_hand::text,
             cs.quantity_reserved::text,
             cs.quantity_available::text
        FROM current_stock cs
       WHERE cs.package_id IS NULL
         ${companyFilter}
         ${warehouseFilter}
    `);

    for (const r of rows) {
      const onHand = new Prisma.Decimal(r.quantity_on_hand);
      const reserved = new Prisma.Decimal(r.quantity_reserved);
      const available = new Prisma.Decimal(r.quantity_available);
      const base = {
        companyId: r.company_id,
        productId: r.product_id,
        locationId: r.location_id,
        lotId: r.lot_id,
        warehouseId: r.warehouse_id,
        details: {
          quantityOnHand: onHand.toString(),
          quantityReserved: reserved.toString(),
          quantityAvailable: available.toString(),
        },
      };

      if (onHand.lessThan(0)) {
        pushFinding(findings, {
          code: 'NEGATIVE_ON_HAND',
          severity: 'critical',
          message: 'On-hand quantity is negative.',
          ...base,
        });
      }
      if (reserved.lessThan(0)) {
        pushFinding(findings, {
          code: 'NEGATIVE_RESERVED',
          severity: 'critical',
          message: 'Reserved quantity is negative.',
          ...base,
        });
      }
      if (available.lessThan(0)) {
        pushFinding(findings, {
          code: 'NEGATIVE_AVAILABLE',
          severity: 'critical',
          message: 'Available quantity is negative.',
          ...base,
        });
      }
      if (reserved.greaterThan(onHand)) {
        pushFinding(findings, {
          code: 'RESERVED_EXCEEDS_ON_HAND',
          severity: 'critical',
          message: 'Reserved quantity exceeds on-hand (impossible state).',
          ...base,
        });
      }
      const expectedAvail = onHand.minus(reserved);
      if (!available.minus(expectedAvail).abs().lessThanOrEqualTo(DRIFT_EPSILON)) {
        pushFinding(findings, {
          code: 'AVAILABLE_FORMULA_MISMATCH',
          severity: 'critical',
          message: 'Available quantity does not equal on-hand minus reserved.',
          ...base,
          details: {
            ...base.details,
            expectedAvailable: expectedAvail.toString(),
          },
        });
      }
    }

    return rows.length;
  }

  private async checkReservationTableDrift(
    scope: { companyId?: string; warehouseId?: string },
    findings: InventoryConsistencyFinding[],
  ): Promise<void> {
    const driftRows = await this.prisma.$queryRaw<
      Array<{
        company_id: string;
        product_id: string;
        location_id: string;
        lot_id: string | null;
        stored_reserved: string;
        actual_sum: string;
        drift: string;
        warehouse_id: string;
      }>
    >(Prisma.sql`
      SELECT rr.company_id,
             rr.product_id,
             rr.location_id,
             rr.lot_id,
             rr.stored_reserved::text,
             rr.actual_sum::text,
             rr.drift::text,
             cs.warehouse_id
        FROM fn_reconcile_reservations() rr
        JOIN current_stock cs
          ON cs.company_id = rr.company_id
         AND cs.product_id = rr.product_id
         AND cs.location_id = rr.location_id
         AND (cs.lot_id = rr.lot_id OR (cs.lot_id IS NULL AND rr.lot_id IS NULL))
         AND cs.package_id IS NULL
    `);

    for (const d of driftRows) {
      if (scope.companyId && d.company_id !== scope.companyId) continue;
      if (scope.warehouseId && d.warehouse_id !== scope.warehouseId) continue;
      pushFinding(findings, {
        code: 'STOCK_RESERVATION_TABLE_DRIFT',
        severity: 'warning',
        message:
          'current_stock.quantity_reserved drifts from SUM(active stock_reservations) — legacy table may be out of sync with task snapshots.',
        companyId: d.company_id,
        productId: d.product_id,
        locationId: d.location_id,
        lotId: d.lot_id,
        details: {
          storedReserved: d.stored_reserved,
          activeReservationSum: d.actual_sum,
          drift: d.drift,
        },
      });
    }
  }

  private async checkTaskReservationDrift(
    scope: { companyId?: string; warehouseId?: string },
    findings: InventoryConsistencyFinding[],
  ): Promise<number> {
    const tasks = await this.prisma.warehouseTask.findMany({
      where: {
        taskType: WarehouseTaskType.pick,
        status: {
          in: [
            WarehouseTaskStatus.in_progress,
            WarehouseTaskStatus.completed,
            WarehouseTaskStatus.retry_pending,
          ],
        },
        executionState: { not: Prisma.DbNull },
        workflowInstance: {
          ...(scope.companyId ? { companyId: scope.companyId } : {}),
          ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
        },
      },
      select: {
        id: true,
        status: true,
        workflowInstanceId: true,
        executionState: true,
        workflowInstance: { select: { companyId: true, referenceId: true } },
      },
    });

    const taskSumByTuple = new Map<StockTupleKey, Prisma.Decimal>();
    const allocatedByLine = new Map<string, Prisma.Decimal>();

    for (const task of tasks) {
      for (const snap of reservationRowsFromExec(task.executionState)) {
        const k = stockTupleKey({
          companyId: snap.companyId,
          productId: snap.productId,
          locationId: snap.locationId,
          lotId: snap.lotId,
        });
        const cur = taskSumByTuple.get(k) ?? new Prisma.Decimal(0);
        taskSumByTuple.set(k, cur.plus(new Prisma.Decimal(snap.quantity)));

        const lineKey = snap.outboundOrderLineId;
        const lineCur = allocatedByLine.get(lineKey) ?? new Prisma.Decimal(0);
        allocatedByLine.set(lineKey, lineCur.plus(new Prisma.Decimal(snap.quantity)));
      }
    }

    if (taskSumByTuple.size === 0) {
      return tasks.length;
    }

    const tuples = [...taskSumByTuple.entries()].map(([key, taskReserved]) => {
      const [companyId, productId, locationId, lotPart] = key.split('|');
      return {
        companyId,
        productId,
        locationId,
        lotId: lotPart === '' ? null : lotPart,
        taskReserved,
      };
    });

    for (const t of tuples) {
      const stockRows =
        t.lotId === null
          ? await this.prisma.$queryRaw<Array<{ reserved: string }>>(Prisma.sql`
              SELECT quantity_reserved::text AS reserved
                FROM current_stock
               WHERE company_id  = ${t.companyId}::uuid
                 AND product_id  = ${t.productId}::uuid
                 AND location_id = ${t.locationId}::uuid
                 AND lot_id IS NULL
                 AND package_id IS NULL
            `)
          : await this.prisma.$queryRaw<Array<{ reserved: string }>>(Prisma.sql`
              SELECT quantity_reserved::text AS reserved
                FROM current_stock
               WHERE company_id  = ${t.companyId}::uuid
                 AND product_id  = ${t.productId}::uuid
                 AND location_id = ${t.locationId}::uuid
                 AND lot_id = ${t.lotId}::uuid
                 AND package_id IS NULL
            `);

      const stockReserved = stockRows[0]?.reserved
        ? new Prisma.Decimal(stockRows[0].reserved)
        : new Prisma.Decimal(0);

      if (t.taskReserved.minus(stockReserved).abs().greaterThan(DRIFT_EPSILON)) {
        pushFinding(findings, {
          code: 'TASK_RESERVATION_STOCK_DRIFT',
          severity: 'warning',
          message:
            'Sum of active pick-task reservation snapshots does not match current_stock.quantity_reserved for this bin/lot.',
          companyId: t.companyId,
          productId: t.productId,
          locationId: t.locationId,
          lotId: t.lotId,
          details: {
            taskSnapshotReserved: t.taskReserved.toString(),
            stockReserved: stockReserved.toString(),
            note: 'Multiple concurrent picks or legacy rows may contribute; investigate overlapping workflows.',
          },
        });
      }
    }

    const lineIds = [...allocatedByLine.keys()];
    if (lineIds.length > 0) {
      const lines = await this.prisma.outboundOrderLine.findMany({
        where: { id: { in: lineIds } },
        select: {
          id: true,
          outboundOrderId: true,
          requestedQuantity: true,
          pickedQuantity: true,
        },
      });

      for (const line of lines) {
        const allocated = allocatedByLine.get(line.id) ?? new Prisma.Decimal(0);
        const picked = new Prisma.Decimal(line.pickedQuantity.toString());
        if (picked.greaterThan(0) && allocated.lessThanOrEqualTo(0)) {
          pushFinding(findings, {
            code: 'OUTBOUND_PICKED_WITHOUT_RESERVATION',
            severity: 'warning',
            message: 'Outbound line has picked quantity but no active pick-task reservation snapshot.',
            outboundOrderId: line.outboundOrderId,
            outboundOrderLineId: line.id,
            details: {
              pickedQuantity: picked.toString(),
              allocatedFromTasks: allocated.toString(),
            },
          });
        }
        if (picked.greaterThan(allocated) && allocated.greaterThan(0)) {
          pushFinding(findings, {
            code: 'OUTBOUND_ALLOCATED_PICKED_MISMATCH',
            severity: 'warning',
            message: 'Picked quantity exceeds active task-allocated (reserved) quantity for this line.',
            outboundOrderId: line.outboundOrderId,
            outboundOrderLineId: line.id,
            details: {
              pickedQuantity: picked.toString(),
              allocatedFromTasks: allocated.toString(),
              requestedQuantity: line.requestedQuantity.toString(),
            },
          });
        }
      }
    }

    return tasks.length;
  }

  private async checkOutboundLineQuantities(
    scope: { companyId?: string; warehouseId?: string },
    findings: InventoryConsistencyFinding[],
  ): Promise<number> {
    const lines = await this.prisma.outboundOrderLine.findMany({
      where: {
        order: {
          ...(scope.companyId ? { companyId: scope.companyId } : {}),
        },
      },
      select: {
        id: true,
        outboundOrderId: true,
        requestedQuantity: true,
        pickedQuantity: true,
        order: { select: { companyId: true, status: true } },
      },
    });

    for (const line of lines) {
      const requested = new Prisma.Decimal(line.requestedQuantity.toString());
      const picked = new Prisma.Decimal(line.pickedQuantity.toString());

      if (picked.lessThan(0)) {
        pushFinding(findings, {
          code: 'OUTBOUND_NEGATIVE_PICKED',
          severity: 'critical',
          message: 'Outbound line picked quantity is negative.',
          companyId: line.order.companyId,
          outboundOrderId: line.outboundOrderId,
          outboundOrderLineId: line.id,
          details: { pickedQuantity: picked.toString(), requestedQuantity: requested.toString() },
        });
      }
      if (picked.greaterThan(requested)) {
        pushFinding(findings, {
          code: 'OUTBOUND_PICKED_EXCEEDS_REQUESTED',
          severity: 'critical',
          message: 'Picked quantity exceeds requested quantity on outbound line.',
          companyId: line.order.companyId,
          outboundOrderId: line.outboundOrderId,
          outboundOrderLineId: line.id,
          details: {
            pickedQuantity: picked.toString(),
            requestedQuantity: requested.toString(),
            orderStatus: line.order.status,
          },
        });
      }
    }

    return lines.length;
  }

  private async checkConcurrentActivePicks(
    scope: { companyId?: string; warehouseId?: string },
    findings: InventoryConsistencyFinding[],
  ): Promise<void> {
    const companyFilter = scope.companyId
      ? Prisma.sql`AND wi.company_id = ${scope.companyId}::uuid`
      : Prisma.empty;
    const warehouseFilter = scope.warehouseId
      ? Prisma.sql`AND wi.warehouse_id = ${scope.warehouseId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{ workflow_instance_id: string; pick_count: number }>
    >(Prisma.sql`
      SELECT wt.workflow_instance_id,
             COUNT(*)::int AS pick_count
        FROM warehouse_tasks wt
        JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
       WHERE wt.task_type = 'pick'
         AND wt.status = 'in_progress'
         ${companyFilter}
         ${warehouseFilter}
       GROUP BY wt.workflow_instance_id
      HAVING COUNT(*) > 1
    `);

    for (const row of rows) {
      pushFinding(findings, {
        code: 'CONCURRENT_ACTIVE_PICKS',
        severity: 'critical',
        message: 'Multiple in-progress pick tasks exist for the same workflow instance.',
        workflowInstanceId: row.workflow_instance_id,
        details: { inProgressPickCount: row.pick_count },
      });
    }
  }

  private async checkStalePickSnapshots(
    scope: { companyId?: string; warehouseId?: string },
    findings: InventoryConsistencyFinding[],
  ): Promise<void> {
    const shippedOrders = await this.prisma.outboundOrder.findMany({
      where: {
        status: 'shipped',
        ...(scope.companyId ? { companyId: scope.companyId } : {}),
      },
      select: { id: true, companyId: true },
    });
    if (!shippedOrders.length) return;

    const shippedIds = shippedOrders.map((o) => o.id);
    const tasks = await this.prisma.warehouseTask.findMany({
      where: {
        taskType: WarehouseTaskType.pick,
        status: WarehouseTaskStatus.completed,
        executionState: { not: Prisma.DbNull },
        workflowInstance: {
          referenceType: 'outbound_order',
          referenceId: { in: shippedIds },
          ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}),
        },
      },
      select: {
        id: true,
        workflowInstanceId: true,
        executionState: true,
        workflowInstance: { select: { referenceId: true, companyId: true } },
      },
    });

    for (const task of tasks) {
      const snaps = reservationRowsFromExec(task.executionState);
      if (snaps.length === 0) continue;
      pushFinding(findings, {
        code: 'STALE_PICK_RESERVATION_SNAPSHOT',
        severity: 'warning',
        message:
          'Completed pick task still holds reservation snapshots after outbound order shipped — may indicate uncleared executionState.',
        companyId: task.workflowInstance.companyId,
        workflowInstanceId: task.workflowInstanceId,
        taskId: task.id,
        outboundOrderId: task.workflowInstance.referenceId,
        details: { reservationSliceCount: snaps.length },
      });
    }
  }
}
