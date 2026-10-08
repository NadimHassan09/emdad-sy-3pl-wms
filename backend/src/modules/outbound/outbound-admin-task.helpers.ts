import { BadRequestException } from '@nestjs/common';
import { Prisma, WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';

type PrismaLike = {
  warehouseTask: {
    findFirst: (args: Prisma.WarehouseTaskFindFirstArgs) => Promise<{
      id: string;
      executionState: Prisma.JsonValue;
    } | null>;
  };
};

export type WaitOpenWarehouseTaskOptions = {
  /** Default 8. Bulk stage transitions can use a shorter budget. */
  maxAttempts?: number;
  /** Default 50ms; delay grows as baseDelayMs * (attempt + 1). */
  baseDelayMs?: number;
};

/** Poll briefly for an open warehouse task created by workflow orchestration. */
export async function waitForOpenWarehouseTask(
  prisma: PrismaLike,
  referenceType: 'outbound_order' | 'inbound_order',
  referenceId: string,
  taskType: WarehouseTaskType,
  options?: WaitOpenWarehouseTaskOptions,
): Promise<{ id: string; executionState: Prisma.JsonValue }> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 8);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 50);
  for (let i = 0; i < maxAttempts; i++) {
    const t = await prisma.warehouseTask.findFirst({
      where: {
        taskType,
        status: {
          in: [
            WarehouseTaskStatus.pending,
            WarehouseTaskStatus.assigned,
            WarehouseTaskStatus.in_progress,
          ],
        },
        workflowInstance: { referenceType, referenceId },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, executionState: true },
    });
    if (t) return t;
    if (i + 1 < maxAttempts && baseDelayMs > 0) {
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw new BadRequestException(
    `Expected open ${taskType} task was not created for ${referenceType} ${referenceId}.`,
  );
}

export function buildAdminPickCompleteBody(executionState: Prisma.JsonValue): {
  task_type: 'pick';
  picks: Array<{
    outbound_order_line_id: string;
    lines: Array<{ location_id: string; lot_id?: string | null; quantity: string }>;
  }>;
} {
  const exec =
    executionState && typeof executionState === 'object' && !Array.isArray(executionState)
      ? (executionState as Record<string, unknown>)
      : {};
  const reservations = Array.isArray(exec.reservations) ? exec.reservations : [];
  if (reservations.length === 0) {
    throw new BadRequestException(
      'No FEFO reservations on pick task (stock may be insufficient).',
    );
  }

  const pickGroups = new Map<
    string,
    Array<{ location_id: string; lot_id?: string | null; quantity: string }>
  >();
  for (const raw of reservations) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const lineId =
      typeof row.outboundOrderLineId === 'string'
        ? row.outboundOrderLineId
        : typeof row.outbound_order_line_id === 'string'
          ? row.outbound_order_line_id
          : null;
    const locationId =
      typeof row.locationId === 'string'
        ? row.locationId
        : typeof row.location_id === 'string'
          ? row.location_id
          : null;
    const qty =
      row.quantity != null
        ? String(row.quantity)
        : row.qty != null
          ? String(row.qty)
          : null;
    if (!lineId || !locationId || !qty) continue;
    const lotRaw = row.lotId ?? row.lot_id;
    const lotId = lotRaw == null || lotRaw === '' ? null : String(lotRaw);
    const g = pickGroups.get(lineId) ?? [];
    g.push({ location_id: locationId, lot_id: lotId, quantity: qty });
    pickGroups.set(lineId, g);
  }

  if (pickGroups.size === 0) {
    throw new BadRequestException('Could not build pick completion payload from reservations.');
  }

  return {
    task_type: 'pick',
    picks: [...pickGroups.entries()].map(([outbound_order_line_id, lines]) => ({
      outbound_order_line_id,
      lines,
    })),
  };
}
