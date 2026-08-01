import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WarehouseTasksService } from '../warehouse-workflow/warehouse-tasks.service';
import {
  assertInboundAdminPlanComplete,
  assertOutboundAdminPlanComplete,
  normalizeExecutionMode,
  parseInboundExecutionPlan,
  parseOutboundExecutionPlan,
} from './execution-plan.util';
import { InboundService } from '../inbound/inbound.service';
import { OutboundService } from '../outbound/outbound.service';

const OPEN: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.pending,
  WarehouseTaskStatus.assigned,
  WarehouseTaskStatus.in_progress,
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function wrapStep(step: string, err: unknown): BadRequestException {
  const msg = err instanceof Error ? err.message : String(err);
  return new BadRequestException(`Admin execute failed at ${step}: ${msg}`);
}

@Injectable()
export class AdminOrderExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => InboundService))
    private readonly inbound: InboundService,
    @Inject(forwardRef(() => OutboundService))
    private readonly outbound: OutboundService,
    private readonly tasks: WarehouseTasksService,
  ) {}

  private async findOpenTask(
    referenceType: 'inbound_order' | 'outbound_order',
    referenceId: string,
    taskType: WarehouseTaskType,
  ) {
    return this.prisma.warehouseTask.findFirst({
      where: {
        taskType,
        status: { in: OPEN },
        workflowInstance: { referenceType, referenceId },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async waitForOpenTask(
    referenceType: 'inbound_order' | 'outbound_order',
    referenceId: string,
    taskType: WarehouseTaskType,
    attempts = 8,
  ) {
    for (let i = 0; i < attempts; i++) {
      const t = await this.findOpenTask(referenceType, referenceId, taskType);
      if (t) return t;
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
    throw new BadRequestException(
      `Admin execute failed: expected open ${taskType} task was not created.`,
    );
  }

  async executeInboundAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.inbound.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('execute-admin requires executionMode=admin.');
    }
    if (order.status !== 'draft' && order.status !== 'pending_approval') {
      throw new BadRequestException(
        `Admin execute requires draft order (current: ${order.status}).`,
      );
    }
    const plan = parseInboundExecutionPlan(order.executionPlan);
    if (!plan) throw new BadRequestException('Admin execute requires a saved executionPlan.');
    assertInboundAdminPlanComplete(plan);

    const stagingByLineId: Record<string, string> = {};
    for (const line of order.lines) {
      stagingByLineId[line.id] = plan.receivingDockId;
    }

    try {
      await this.inbound.confirm(user, orderId, {
        warehouseId: plan.warehouseId,
        stagingByLineId,
      });
    } catch (err) {
      throw wrapStep('confirm', err);
    }

    const receiving = await this.waitForOpenTask(
      'inbound_order',
      orderId,
      WarehouseTaskType.receiving,
    );
    const receiveBody = {
      task_type: 'receiving' as const,
      lines: order.lines.map((l) => {
        const lotPayload =
          l.product?.trackingType === 'lot' && l.expectedLotNumber?.trim()
            ? { capture_lot_number: l.expectedLotNumber.trim() }
            : {};
        return {
          inbound_order_line_id: l.id,
          received_qty: String(l.expectedQuantity),
          ...lotPayload,
        };
      }),
    };
    try {
      await this.tasks.adminConfirm(receiving.id, user, receiveBody);
    } catch (err) {
      throw wrapStep('receiving', err);
    }

    const putaway = await this.waitForOpenTask('inbound_order', orderId, WarehouseTaskType.putaway);
    const putawayLines: Array<{
      inbound_order_line_id: string;
      putaway_quantity: string;
      destination_location_id: string;
    }> = [];

    for (const ol of order.lines) {
      const planLine =
        plan.lines.find((p) => p.orderLineId === ol.id) ??
        plan.lines.find((p) => p.productId === ol.productId);
      for (const s of planLine?.putaway ?? []) {
        putawayLines.push({
          inbound_order_line_id: ol.id,
          putaway_quantity: String(s.qty),
          destination_location_id: s.locationId,
        });
      }
    }
    if (putawayLines.length === 0) {
      throw new BadRequestException('Admin execute failed at putaway: no destination splits.');
    }

    try {
      await this.tasks.adminConfirm(putaway.id, user, {
        task_type: 'putaway',
        lines: putawayLines,
      });
    } catch (err) {
      throw wrapStep('putaway', err);
    }

    return this.inbound.findById(orderId, user);
  }

  async executeOutboundAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.outbound.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('execute-admin requires executionMode=admin.');
    }
    if (order.status !== 'draft' && order.status !== 'pending_approval') {
      throw new BadRequestException(
        `Admin execute requires draft order (current: ${order.status}).`,
      );
    }
    const plan = parseOutboundExecutionPlan(order.executionPlan);
    if (!plan) throw new BadRequestException('Admin execute requires a saved executionPlan.');
    assertOutboundAdminPlanComplete(plan);

    try {
      await this.outbound.confirmAndDeduct(user, orderId, { warehouseId: plan.warehouseId });
    } catch (err) {
      throw wrapStep('confirm', err);
    }

    const pick = await this.waitForOpenTask('outbound_order', orderId, WarehouseTaskType.pick);
    try {
      await this.tasks.start(pick.id, user);
    } catch (err) {
      throw wrapStep('pick_start', err);
    }

    const pickDetail = await this.prisma.warehouseTask.findUnique({ where: { id: pick.id } });
    if (!pickDetail) throw new NotFoundException('Pick task missing after start.');
    const exec = isRecord(pickDetail.executionState) ? pickDetail.executionState : {};
    const reservations = Array.isArray(exec.reservations) ? exec.reservations : [];
    if (reservations.length === 0) {
      throw new BadRequestException(
        'Admin execute failed at pick: no FEFO reservations (stock may be insufficient).',
      );
    }

    const pickGroups = new Map<
      string,
      Array<{ location_id: string; lot_id?: string | null; quantity: string }>
    >();
    for (const raw of reservations) {
      if (!isRecord(raw)) continue;
      const lineId =
        typeof raw.outboundOrderLineId === 'string'
          ? raw.outboundOrderLineId
          : typeof raw.outbound_order_line_id === 'string'
            ? raw.outbound_order_line_id
            : null;
      const locationId =
        typeof raw.locationId === 'string'
          ? raw.locationId
          : typeof raw.location_id === 'string'
            ? raw.location_id
            : null;
      const qty =
        raw.quantity != null
          ? String(raw.quantity)
          : raw.qty != null
            ? String(raw.qty)
            : null;
      if (!lineId || !locationId || !qty) continue;
      const lotRaw = raw.lotId ?? raw.lot_id;
      const lotId = lotRaw == null || lotRaw === '' ? null : String(lotRaw);
      const g = pickGroups.get(lineId) ?? [];
      g.push({ location_id: locationId, lot_id: lotId, quantity: qty });
      pickGroups.set(lineId, g);
    }

    try {
      await this.tasks.complete(pick.id, user, {
        task_type: 'pick',
        picks: [...pickGroups.entries()].map(([outbound_order_line_id, lines]) => ({
          outbound_order_line_id,
          lines,
        })),
      });
    } catch (err) {
      throw wrapStep('pick', err);
    }

    const requiresPacking = order.requiresPacking !== false && plan.requiresPacking !== false;
    if (requiresPacking) {
      const pack = await this.waitForOpenTask('outbound_order', orderId, WarehouseTaskType.pack);
      const refreshed = await this.outbound.findById(orderId, user);
      try {
        await this.tasks.adminConfirm(pack.id, user, {
          task_type: 'pack',
          lines: refreshed.lines.map((l) => ({
            outbound_order_line_id: l.id,
            packed_qty: String(l.pickedQuantity ?? l.requestedQuantity),
          })),
        });
      } catch (err) {
        throw wrapStep('pack', err);
      }
    }

    const dispatch = await this.waitForOpenTask(
      'outbound_order',
      orderId,
      WarehouseTaskType.dispatch,
    );
    const finalOrder = await this.outbound.findById(orderId, user);
    try {
      await this.tasks.adminConfirm(dispatch.id, user, {
        task_type: 'dispatch',
        lines: finalOrder.lines.map((l) => ({
          outbound_order_line_id: l.id,
          ship_qty: String(l.pickedQuantity ?? l.requestedQuantity),
        })),
      });
    } catch (err) {
      throw wrapStep('dispatch', err);
    }

    return this.outbound.findById(orderId, user);
  }
}
