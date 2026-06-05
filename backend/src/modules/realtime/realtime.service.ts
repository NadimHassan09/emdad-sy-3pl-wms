import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import { PrismaService } from '../../common/prisma/prisma.service';
import { companyRoomName, INTERNAL_MASTER_DATA_ROOM, normalizeCompanyId, userRoomName } from './realtime-socket-auth';
import { RealtimeEvents, type RealtimeEventName } from './realtime.events';
import type { UserListRealtimePayload } from './realtime-master-data.payload';
import { buildTaskListPayload } from './realtime-task.payload';

@Injectable()
export class RealtimeService {
  private readonly log = new Logger(RealtimeService.name);
  private io: Server | null = null;
  private dashboardSchedule:
    | ((section: 'orders' | 'tasks' | 'inventory' | 'kpi' | 'all') => void)
    | null = null;

  constructor(private readonly prisma: PrismaService) {}

  attachServer(server: Server): void {
    this.io = server;
  }

  registerDashboardSchedule(
    fn: (section: 'orders' | 'tasks' | 'inventory' | 'kpi' | 'all') => void,
  ): void {
    this.dashboardSchedule = fn;
  }

  private scheduleDashboard(section: 'orders' | 'tasks' | 'inventory' | 'kpi' | 'all'): void {
    try {
      this.dashboardSchedule?.(section);
    } catch (err) {
      this.log.warn(
        `Dashboard schedule failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private emitDashboard(event: RealtimeEventName, payload: Record<string, unknown>): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, event, payload);
  }

  private emitToRoom(room: string, event: RealtimeEventName, payload: Record<string, unknown>): void {
    if (!this.io) {
      this.log.debug(`Skip ${event} (socket server not ready).`);
      return;
    }
    try {
      this.io.to(room).emit(event, { ...payload, at: new Date().toISOString() });
    } catch (err) {
      this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private emit(companyId: string, event: RealtimeEventName, payload: Record<string, unknown>): void {
    if (!this.io) {
      this.log.debug(`Skip ${event} (socket server not ready).`);
      return;
    }
    const normalizedCompanyId = normalizeCompanyId(companyId);
    if (!normalizedCompanyId) {
      this.log.warn(`Skip ${event}: invalid company room id.`);
      return;
    }
    try {
      const body = { ...payload, companyId: normalizedCompanyId, at: new Date().toISOString() };
      this.io.to(companyRoomName(normalizedCompanyId)).emit(event, body);
    } catch (err) {
      this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  emitInboundOrderCreated(
    companyId: string,
    payload: { orderId: string; status: string; listItem?: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.INBOUND_ORDER_CREATED, payload);
    this.scheduleDashboard('orders');
  }

  emitInboundOrderUpdated(
    companyId: string,
    payload: {
      orderId: string;
      status?: string;
      reason?: string;
      listItem?: Record<string, unknown>;
    },
  ): void {
    this.emit(companyId, RealtimeEvents.INBOUND_ORDER_UPDATED, payload);
    this.scheduleDashboard('orders');
  }

  emitOutboundOrderCreated(
    companyId: string,
    payload: { orderId: string; status: string; listItem?: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.OUTBOUND_ORDER_CREATED, payload);
    this.scheduleDashboard('orders');
  }

  emitOutboundOrderUpdated(
    companyId: string,
    payload: {
      orderId: string;
      status: string;
      reason?: string;
      listItem?: Record<string, unknown>;
    },
  ): void {
    this.emit(companyId, RealtimeEvents.OUTBOUND_ORDER_UPDATED, payload);
    this.scheduleDashboard('orders');
  }

  emitTaskUpdated(
    companyId: string,
    payload: {
      taskId: string;
      warehouseId?: string | null;
      task?: Record<string, unknown>;
      referenceType?: string;
      referenceId?: string;
      workflowInstanceId?: string;
    },
  ): void {
    this.emit(companyId, RealtimeEvents.TASK_UPDATED, payload);
    this.scheduleDashboard('tasks');
  }

  emitInventoryChanged(
    companyId: string,
    payload: { source?: string; orderId?: string; taskId?: string; productId?: string },
  ): void {
    void this.emitInventoryChangedAsync(companyId, payload);
  }

  private async emitInventoryChangedAsync(
    companyId: string,
    payload: { source?: string; orderId?: string; taskId?: string; productId?: string },
  ): Promise<void> {
    const body: Record<string, unknown> = { ...payload };
    if (payload.productId) {
      const [stockRow, productSummary] = await Promise.all([
        this.fetchClientStockRow(companyId, payload.productId),
        this.fetchAdminProductSummary(companyId, payload.productId),
      ]);
      if (stockRow) body.stockRow = stockRow;
      if (productSummary) body.productSummary = productSummary;
    }
    this.emit(companyId, RealtimeEvents.INVENTORY_CHANGED, body);
    this.scheduleDashboard('inventory');
  }

  private async fetchAdminProductSummary(
    companyId: string,
    productId: string,
  ): Promise<Record<string, unknown> | null> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: {
        id: true,
        sku: true,
        name: true,
        uom: true,
        barcode: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!product) return null;
    const agg = await this.prisma.currentStock.aggregate({
      where: { companyId, productId },
      _sum: { quantityOnHand: true },
    });
    return {
      productId: product.id,
      totalQuantity: String(agg._sum.quantityOnHand ?? 0),
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        uom: product.uom,
        barcode: product.barcode,
      },
      client: product.company,
    };
  }

  private async fetchClientStockRow(
    companyId: string,
    productId: string,
  ): Promise<Record<string, unknown> | null> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true, name: true, sku: true, uom: true },
    });
    if (!product) return null;
    const agg = await this.prisma.currentStock.aggregate({
      where: { companyId, productId },
      _sum: { quantityOnHand: true },
    });
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      totalQuantity: String(agg._sum.quantityOnHand ?? 0),
      uom: product.uom,
      expiryDate: null,
    };
  }

  emitProductCreated(companyId: string, product: Record<string, unknown>): void {
    this.emit(companyId, RealtimeEvents.PRODUCT_CREATED, { product });
    this.scheduleDashboard('kpi');
  }

  emitProductUpdated(companyId: string, product: Record<string, unknown>): void {
    this.emit(companyId, RealtimeEvents.PRODUCT_UPDATED, { product });
    this.scheduleDashboard('kpi');
  }

  emitProductArchived(companyId: string, productId: string): void {
    this.emit(companyId, RealtimeEvents.PRODUCT_ARCHIVED, { productId });
    this.scheduleDashboard('kpi');
  }

  emitProductDeleted(companyId: string, productId: string): void {
    this.emit(companyId, RealtimeEvents.PRODUCT_DELETED, { productId });
    this.scheduleDashboard('kpi');
  }

  emitUserCreated(user: UserListRealtimePayload): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.USER_CREATED, { user });
    if (user.companyId) {
      this.emit(user.companyId, RealtimeEvents.USER_CREATED, { user });
    }
    this.scheduleDashboard('kpi');
  }

  emitUserUpdated(user: UserListRealtimePayload): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.USER_UPDATED, { user });
    if (user.companyId) {
      this.emit(user.companyId, RealtimeEvents.USER_UPDATED, { user });
    }
  }

  emitUserDeleted(userId: string, companyId: string | null): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.USER_DELETED, { userId });
    if (companyId) {
      this.emit(companyId, RealtimeEvents.USER_DELETED, { userId });
    }
  }

  emitWarehouseCreated(warehouse: Record<string, unknown>): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.WAREHOUSE_CREATED, { warehouse });
  }

  emitWarehouseUpdated(warehouse: Record<string, unknown>): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.WAREHOUSE_UPDATED, { warehouse });
  }

  emitLocationCreated(location: Record<string, unknown>): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.LOCATION_CREATED, { location });
    this.scheduleDashboard('inventory');
  }

  emitLocationUpdated(location: Record<string, unknown>): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.LOCATION_UPDATED, { location });
    this.scheduleDashboard('inventory');
  }

  emitLocationArchived(warehouseId: string, locationId: string): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.LOCATION_ARCHIVED, {
      warehouseId,
      locationId,
    });
    this.scheduleDashboard('inventory');
  }

  emitReturnCreated(
    companyId: string,
    payload: { listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.RETURN_CREATED, payload);
    this.scheduleDashboard('kpi');
  }

  emitReturnUpdated(
    companyId: string,
    payload: { listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.RETURN_UPDATED, payload);
  }

  emitReturnConfirmed(
    companyId: string,
    payload: { listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.RETURN_CONFIRMED, payload);
  }

  emitReturnCompleted(
    companyId: string,
    payload: { listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.RETURN_COMPLETED, payload);
    this.scheduleDashboard('inventory');
    this.scheduleDashboard('kpi');
  }

  emitCycleCountCreated(
    companyId: string,
    payload: { listItem: Record<string, unknown>; count: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.CYCLE_COUNT_CREATED, payload);
    this.scheduleDashboard('kpi');
  }

  emitCycleCountUpdated(
    companyId: string,
    payload: { listItem: Record<string, unknown>; count: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.CYCLE_COUNT_UPDATED, payload);
  }

  emitCycleCountCompleted(
    companyId: string,
    payload: { listItem: Record<string, unknown>; count: Record<string, unknown> },
  ): void {
    this.emit(companyId, RealtimeEvents.CYCLE_COUNT_COMPLETED, payload);
    this.scheduleDashboard('inventory');
    this.scheduleDashboard('kpi');
  }

  emitAdjustmentCreated(companyId: string, adjustment: Record<string, unknown>): void {
    this.emit(companyId, RealtimeEvents.ADJUSTMENT_CREATED, { adjustment });
  }

  emitAdjustmentApproved(companyId: string, adjustment: Record<string, unknown>): void {
    this.emit(companyId, RealtimeEvents.ADJUSTMENT_APPROVED, { adjustment });
    this.scheduleDashboard('inventory');
  }

  emitTransferCreated(companyId: string, transfer: Record<string, unknown>): void {
    this.emit(companyId, RealtimeEvents.TRANSFER_CREATED, { transfer });
  }

  emitTransferCompleted(companyId: string, transfer: Record<string, unknown>): void {
    this.emit(companyId, RealtimeEvents.TRANSFER_COMPLETED, { transfer });
    this.scheduleDashboard('inventory');
  }

  emitDashboardKpiUpdated(patch: Record<string, unknown>): void {
    this.emitDashboard(RealtimeEvents.DASHBOARD_KPI_UPDATED, patch);
  }

  emitDashboardInventoryUpdated(patch: Record<string, unknown>): void {
    this.emitDashboard(RealtimeEvents.DASHBOARD_INVENTORY_UPDATED, patch);
  }

  emitDashboardOrdersUpdated(patch: Record<string, unknown>): void {
    this.emitDashboard(RealtimeEvents.DASHBOARD_ORDERS_UPDATED, patch);
  }

  emitDashboardTasksUpdated(patch: Record<string, unknown>): void {
    this.emitDashboard(RealtimeEvents.DASHBOARD_TASKS_UPDATED, patch);
  }

  emitPresenceOnline(presence: Record<string, unknown>): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.PRESENCE_ONLINE, { presence });
  }

  emitPresenceOffline(presence: Record<string, unknown>): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.PRESENCE_OFFLINE, { presence });
  }

  emitAuthSessionChanged(
    userId: string,
    payload: { type: string; userId: string; reason?: string },
  ): void {
    this.emitToUser(userId, RealtimeEvents.AUTH_SESSION_CHANGED, payload);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.AUTH_SESSION_CHANGED, payload);
  }

  emitToUser(userId: string, event: RealtimeEventName, payload: Record<string, unknown>): void {
    this.emitToRoom(userRoomName(userId), event, payload);
  }

  emitAuditLogCreated(auditLog: Record<string, unknown>, companyId: string | null): void {
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.AUDIT_LOG_CREATED, { auditLog });
    if (companyId) {
      this.emit(companyId, RealtimeEvents.AUDIT_LOG_CREATED, { auditLog });
    }
  }

  emitNotificationCreated(
    notification: Record<string, unknown>,
    target: { userId?: string | null; companyId?: string | null },
  ): void {
    const payload = { notification };
    if (target.userId) {
      this.emitToUser(target.userId, RealtimeEvents.NOTIFICATION_CREATED, payload);
    } else if (target.companyId) {
      this.emit(target.companyId, RealtimeEvents.NOTIFICATION_CREATED, payload);
    }
  }

  emitNotificationRead(
    userId: string,
    payload: { notification?: Record<string, unknown>; markAllRead?: boolean },
  ): void {
    this.emitToUser(userId, RealtimeEvents.NOTIFICATION_READ, payload);
  }

  emitNotificationDeleted(userId: string, notificationId: string): void {
    this.emitToUser(userId, RealtimeEvents.NOTIFICATION_DELETED, { notificationId });
  }

  /** Resolve tenant + warehouse from a task id (for gateway-less emits from workflow code). */
  async emitTaskUpdatedByTaskId(
    taskId: string,
    options?: { inventorySource?: string },
  ): Promise<void> {
    const taskPayload = await buildTaskListPayload(this.prisma, taskId);
    if (!taskPayload?.companyId) return;
    const companyId = String(taskPayload.companyId);
    this.emitTaskUpdated(companyId, taskPayload as {
      taskId: string;
      warehouseId?: string | null;
      task?: Record<string, unknown>;
      referenceType?: string;
      referenceId?: string;
      workflowInstanceId?: string;
    });
    if (options?.inventorySource) {
      const productId = await this.resolveProductIdFromTask(taskId);
      this.emitInventoryChanged(companyId, {
        taskId,
        source: options.inventorySource,
        productId: productId ?? undefined,
      });
    }
  }

  private async resolveProductIdFromTask(taskId: string): Promise<string | null> {
    const task = await this.prisma.warehouseTask.findUnique({
      where: { id: taskId },
      select: { taskType: true, workflowInstance: { select: { referenceId: true, referenceType: true } } },
    });
    if (!task) return null;
    if (task.workflowInstance.referenceType === 'outbound_order') {
      const line = await this.prisma.outboundOrderLine.findFirst({
        where: { outboundOrderId: task.workflowInstance.referenceId },
        select: { productId: true },
      });
      return line?.productId ?? null;
    }
    if (task.workflowInstance.referenceType === 'inbound_order') {
      const line = await this.prisma.inboundOrderLine.findFirst({
        where: { inboundOrderId: task.workflowInstance.referenceId },
        select: { productId: true },
      });
      return line?.productId ?? null;
    }
    return null;
  }

  getHealthSnapshot(): {
    attached: boolean;
    connectedClients: number;
  } {
    if (!this.io) {
      return { attached: false, connectedClients: 0 };
    }
    try {
      return {
        attached: true,
        connectedClients: this.io.sockets.sockets.size,
      };
    } catch {
      return { attached: true, connectedClients: 0 };
    }
  }
}
