import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeEvents, type RealtimeEventName } from './realtime.events';

@Injectable()
export class RealtimeService {
  private readonly log = new Logger(RealtimeService.name);
  private io: Server | null = null;

  constructor(private readonly prisma: PrismaService) {}

  attachServer(server: Server): void {
    this.io = server;
  }

  private emit(companyId: string, event: RealtimeEventName, payload: Record<string, unknown>): void {
    if (!this.io) {
      this.log.debug(`Skip ${event} (socket server not ready).`);
      return;
    }
    try {
      const body = { ...payload, companyId, at: new Date().toISOString() };
      this.io.to(`company:${companyId}`).emit(event, body);
    } catch (err) {
      this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  emitInboundOrderCreated(companyId: string, payload: { orderId: string; status: string }): void {
    this.emit(companyId, RealtimeEvents.INBOUND_ORDER_CREATED, payload);
  }

  emitInboundOrderUpdated(
    companyId: string,
    payload: { orderId: string; status?: string; reason?: string },
  ): void {
    this.emit(companyId, RealtimeEvents.INBOUND_ORDER_UPDATED, payload);
  }

  emitOutboundOrderCreated(companyId: string, payload: { orderId: string; status: string }): void {
    this.emit(companyId, RealtimeEvents.OUTBOUND_ORDER_CREATED, payload);
  }

  emitOutboundOrderUpdated(
    companyId: string,
    payload: { orderId: string; status: string; reason?: string },
  ): void {
    this.emit(companyId, RealtimeEvents.OUTBOUND_ORDER_UPDATED, payload);
  }

  emitTaskUpdated(
    companyId: string,
    payload: { taskId: string; warehouseId?: string | null },
  ): void {
    this.emit(companyId, RealtimeEvents.TASK_UPDATED, payload);
  }

  emitInventoryChanged(
    companyId: string,
    payload: { source?: string; orderId?: string; taskId?: string; productId?: string },
  ): void {
    this.emit(companyId, RealtimeEvents.INVENTORY_CHANGED, payload);
  }

  /** Resolve tenant + warehouse from a task id (for gateway-less emits from workflow code). */
  async emitTaskUpdatedByTaskId(
    taskId: string,
    options?: { inventorySource?: string },
  ): Promise<void> {
    const row = await this.prisma.warehouseTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        workflowInstance: { select: { companyId: true, warehouseId: true } },
      },
    });
    if (!row) return;
    const { companyId, warehouseId } = row.workflowInstance;
    this.emitTaskUpdated(companyId, { taskId, warehouseId });
    if (options?.inventorySource) {
      this.emitInventoryChanged(companyId, {
        taskId,
        source: options.inventorySource,
      });
    }
  }
}
