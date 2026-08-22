import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import { PrismaService } from '../../common/prisma/prisma.service';
import { companyRoomName, INTERNAL_MASTER_DATA_ROOM, normalizeCompanyId, userRoomName } from './realtime-socket-auth';
import { RealtimeEvents, type RealtimeEventName } from './realtime.events';
import type { UserListRealtimePayload } from './realtime-master-data.payload';
import { buildTaskListPayload } from './realtime-task.payload';
import { MutationBusService } from './sync/mutation-bus.service';
import { RealtimeSyncModeService } from './sync/realtime-sync-mode.service';
import type { MutationQueueService } from './sync/mutation-queue.service';

@Injectable()
export class RealtimeService {
  private readonly log = new Logger(RealtimeService.name);
  private io: Server | null = null;
  private dashboardSchedule:
    | ((section: 'orders' | 'tasks' | 'inventory' | 'kpi' | 'all') => void)
    | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mutationBus: MutationBusService,
    private readonly syncMode: RealtimeSyncModeService,
  ) {}

  private mutationQueue: MutationQueueService | null = null;

  attachServer(server: Server): void {
    this.io = server;
    this.mutationQueue?.attachServer(server);
  }

  /** Wired from RealtimeModule after both services exist (avoids circular ctor deps). */
  attachMutationQueue(queue: MutationQueueService): void {
    this.mutationQueue = queue;
    if (this.io) queue.attachServer(this.io);
  }

  private notify(
    mutationId: string,
    companyId?: string | null,
    userId?: string | null,
  ): void {
    this.mutationBus.publish({ mutationId, companyId, userId });
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

  /** Ungated emit — used for presence / session (not Module Versions sync). */
  private emitToRoomRaw(
    room: string,
    event: RealtimeEventName,
    payload: Record<string, unknown>,
  ): void {
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

  private emitToRoom(room: string, event: RealtimeEventName, payload: Record<string, unknown>): void {
    if (!this.syncMode.emitLegacy()) return;
    this.emitToRoomRaw(room, event, payload);
  }

  private emit(companyId: string, event: RealtimeEventName, payload: Record<string, unknown>): void {
    if (!this.syncMode.emitLegacy()) return;
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
    payload: {
      orderId: string; status: string; listItem?: Record<string, unknown> },
  ): void {
    this.notify('InboundCreated', companyId);
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
    this.notify('InboundUpdated', companyId);
    this.emit(companyId, RealtimeEvents.INBOUND_ORDER_UPDATED, payload);
    this.scheduleDashboard('orders');
  }

  emitOutboundOrderCreated(
    companyId: string,
    payload: {
      orderId: string; status: string; listItem?: Record<string, unknown> },
  ): void {
    this.notify('OutboundCreated', companyId);
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
    this.notify('OutboundUpdated', companyId);
    this.emit(companyId, RealtimeEvents.OUTBOUND_ORDER_UPDATED, payload);
    this.scheduleDashboard('orders');
  }

  emitOmsOrderEvent(
    companyId: string,
    payload: {
      orderId: string; status: string; event: string },
  ): void {
    this.notify('OmsOrderEvent', companyId);
    this.emit(companyId, RealtimeEvents.OMS_ORDER_EVENT, payload);
    this.scheduleDashboard('orders');
  }

  emitOmsReturnEvent(
    companyId: string,
    payload: {
      returnId: string; status: string; event: string; omsOrderId?: string },
  ): void {
    this.notify('OmsReturnEvent', companyId);
    this.emit(companyId, RealtimeEvents.OMS_RETURN_EVENT, payload);
    this.scheduleDashboard('orders');
  }

  emitCompanyLifecycleChanged(
    companyId: string,
    payload: {
      companyId: string; status: string; action: string },
  ): void {
    this.notify('CompanyLifecycle', companyId);
    this.emit(companyId, RealtimeEvents.COMPANY_LIFECYCLE_CHANGED, payload);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.COMPANY_LIFECYCLE_CHANGED, payload);
    this.scheduleDashboard('kpi');
  }

  emitBillingRestrictionChanged(
    companyId: string,
    payload: {
      companyId: string; restricted: boolean; status?: string },
  ): void {
    this.notify('BillingRestriction', companyId);
    this.emit(companyId, RealtimeEvents.BILLING_RESTRICTION_CHANGED, payload);
    this.scheduleDashboard('kpi');
  }

  emitCodUpdated(
    companyId: string,
    payload: {
      orderId?: string; codRecordId?: string; status: string },
  ): void {
    this.notify('CodUpdated', companyId);
    this.emit(companyId, RealtimeEvents.COD_UPDATED, payload);
    this.scheduleDashboard('orders');
  }

  emitDocumentGenerated(
    companyId: string,
    payload: {
      documentId: string;
      type: string;
      referenceType: string;
      referenceId: string;
      taskId?: string | null;
      documentNumber: string;
      language: string;
      pdfUrl: string;
    },
  ): void {
    this.notify('DocumentGenerated', companyId);
    this.emit(companyId, RealtimeEvents.DOCUMENT_GENERATED, payload);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.DOCUMENT_GENERATED, {
      ...payload,
      companyId,
    });
  }

  emitDocumentSlotOverrideChanged(
    companyId: string,
    payload: {
      taskId: string; type: string; companyId: string },
  ): void {
    this.notify('DocumentSlotOverride', companyId);
    this.emit(companyId, RealtimeEvents.DOCUMENT_SLOT_OVERRIDE_CHANGED, payload);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.DOCUMENT_SLOT_OVERRIDE_CHANGED, payload);
  }

  emitFinalContractChanged(
    companyId: string | null,
    payload: {
      contractId: string; action: string; companyId?: string | null },
  ): void {
    this.notify('FinalContractChanged', companyId);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.FINAL_CONTRACT_CHANGED, payload);
    if (companyId) {
      this.emit(companyId, RealtimeEvents.FINAL_CONTRACT_CHANGED, payload);
    }
  }

  emitFormSubmitted(payload: {
      submission: {
      id: string;
      fullName: string;
      phone: string;
      email: string;
      activityType: string;
      message?: string | null;
      createdAt: Date | string;
    };
  }): void {
    this.notify('FormSubmitted');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.FORM_SUBMITTED, payload);
  }

  emitInvoiceUpdated(
    companyId: string,
    payload: {
      invoiceId: string;
      companyId: string;
      status: string;
      invoiceNumber?: string | null;
      action?: string;
    },
  ): void {
    this.notify('InvoiceUpdated', companyId);
    this.emit(companyId, RealtimeEvents.INVOICE_UPDATED, payload);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.INVOICE_UPDATED, payload);
    this.scheduleDashboard('kpi');
  }

  emitPlanUpdated(
    companyId: string,
    payload: {
      planId: string;
      companyId: string;
      active?: boolean;
      action?: string;
    },
  ): void {
    this.notify('PlanUpdated', companyId);
    this.emit(companyId, RealtimeEvents.PLAN_UPDATED, payload);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.PLAN_UPDATED, payload);
    this.scheduleDashboard('kpi');
  }

  emitBackupJobProgress(payload: {
      jobId: string;
    status: string;
    type?: string;
    progressPercent?: number;
    bytesWritten?: string | number;
    errorMessage?: string | null;
    label?: string | null;
  }): void {
    this.notify('BackupJobProgress');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.BACKUP_JOB_PROGRESS, payload);
  }

  emitBulkShippingProgress(payload: {
    jobId: string;
    status: string;
    progressPercent: number;
    totalCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
  }): void {
    this.notify('ShippingBulkProgress');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.SHIPPING_BULK_PROGRESS, payload);
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
    this.notify('TaskUpdated', companyId);
    this.emit(companyId, RealtimeEvents.TASK_UPDATED, payload);
    this.scheduleDashboard('tasks');
  }

  emitInventoryChanged(
    companyId: string,
    payload: {
      source?: string; orderId?: string; taskId?: string; productId?: string },
  ): void {
    this.notify('InventoryChanged', companyId);
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
    this.notify('ProductCreated', companyId);
    this.emit(companyId, RealtimeEvents.PRODUCT_CREATED, { product });
    this.scheduleDashboard('kpi');
  }

  emitProductUpdated(companyId: string, product: Record<string, unknown>): void {
    this.notify('ProductUpdated', companyId);
    this.emit(companyId, RealtimeEvents.PRODUCT_UPDATED, { product });
    this.scheduleDashboard('kpi');
  }

  emitProductArchived(companyId: string, productId: string): void {
    this.notify('ProductArchived', companyId);
    this.emit(companyId, RealtimeEvents.PRODUCT_ARCHIVED, { productId });
    this.scheduleDashboard('kpi');
  }

  emitProductDeleted(companyId: string, productId: string): void {
    this.notify('ProductDeleted', companyId);
    this.emit(companyId, RealtimeEvents.PRODUCT_DELETED, { productId });
    this.scheduleDashboard('kpi');
  }

  emitUserCreated(user: UserListRealtimePayload): void {
    this.notify('UserCreated', user.companyId);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.USER_CREATED, { user });
    if (user.companyId) {
      this.emit(user.companyId, RealtimeEvents.USER_CREATED, { user });
    }
    this.scheduleDashboard('kpi');
  }

  emitUserUpdated(user: UserListRealtimePayload): void {
    this.notify('UserUpdated', user.companyId);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.USER_UPDATED, { user });
    if (user.companyId) {
      this.emit(user.companyId, RealtimeEvents.USER_UPDATED, { user });
    }
  }

  emitUserDeleted(userId: string, companyId: string | null): void {
    this.notify('UserDeleted', companyId);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.USER_DELETED, { userId });
    if (companyId) {
      this.emit(companyId, RealtimeEvents.USER_DELETED, { userId });
    }
  }

  emitWarehouseCreated(warehouse: Record<string, unknown>): void {
    this.notify('WarehouseCreated');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.WAREHOUSE_CREATED, { warehouse });
  }

  emitWarehouseUpdated(warehouse: Record<string, unknown>): void {
    this.notify('WarehouseUpdated');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.WAREHOUSE_UPDATED, { warehouse });
  }

  emitLocationCreated(location: Record<string, unknown>): void {
    this.notify('LocationCreated');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.LOCATION_CREATED, { location });
    this.scheduleDashboard('inventory');
  }

  emitLocationUpdated(location: Record<string, unknown>): void {
    this.notify('LocationUpdated');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.LOCATION_UPDATED, { location });
    this.scheduleDashboard('inventory');
  }

  emitLocationArchived(warehouseId: string, locationId: string): void {
    this.notify('LocationArchived');
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.LOCATION_ARCHIVED, {
      warehouseId,
      locationId,
    });
    this.scheduleDashboard('inventory');
  }

  emitReturnCreated(
    companyId: string,
    payload: {
      listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.notify('ReturnCreated', companyId);
    this.emit(companyId, RealtimeEvents.RETURN_CREATED, payload);
    this.scheduleDashboard('kpi');
  }

  emitReturnUpdated(
    companyId: string,
    payload: {
      listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.notify('ReturnUpdated', companyId);
    this.emit(companyId, RealtimeEvents.RETURN_UPDATED, payload);
  }

  emitReturnConfirmed(
    companyId: string,
    payload: {
      listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.notify('ReturnConfirmed', companyId);
    this.emit(companyId, RealtimeEvents.RETURN_CONFIRMED, payload);
  }

  emitReturnCompleted(
    companyId: string,
    payload: {
      listItem: Record<string, unknown>; return: Record<string, unknown> },
  ): void {
    this.notify('ReturnCompleted', companyId);
    this.emit(companyId, RealtimeEvents.RETURN_COMPLETED, payload);
    this.scheduleDashboard('inventory');
    this.scheduleDashboard('kpi');
  }

  emitCycleCountCreated(
    companyId: string,
    payload: {
      listItem: Record<string, unknown>; count: Record<string, unknown> },
  ): void {
    this.notify('CycleCountCreated', companyId);
    this.emit(companyId, RealtimeEvents.CYCLE_COUNT_CREATED, payload);
    this.scheduleDashboard('kpi');
  }

  emitCycleCountUpdated(
    companyId: string,
    payload: {
      listItem: Record<string, unknown>; count: Record<string, unknown> },
  ): void {
    this.notify('CycleCountUpdated', companyId);
    this.emit(companyId, RealtimeEvents.CYCLE_COUNT_UPDATED, payload);
  }

  emitCycleCountCompleted(
    companyId: string,
    payload: {
      listItem: Record<string, unknown>; count: Record<string, unknown> },
  ): void {
    this.notify('CycleCountCompleted', companyId);
    this.emit(companyId, RealtimeEvents.CYCLE_COUNT_COMPLETED, payload);
    this.scheduleDashboard('inventory');
    this.scheduleDashboard('kpi');
  }

  emitAdjustmentCreated(companyId: string, adjustment: Record<string, unknown>): void {
    this.notify('AdjustmentCreated', companyId);
    this.emit(companyId, RealtimeEvents.ADJUSTMENT_CREATED, { adjustment });
  }

  emitAdjustmentApproved(companyId: string, adjustment: Record<string, unknown>): void {
    this.notify('AdjustmentApproved', companyId);
    this.emit(companyId, RealtimeEvents.ADJUSTMENT_APPROVED, { adjustment });
    this.scheduleDashboard('inventory');
  }

  emitTransferCreated(companyId: string, transfer: Record<string, unknown>): void {
    this.notify('TransferCreated', companyId);
    this.emit(companyId, RealtimeEvents.TRANSFER_CREATED, { transfer });
  }

  emitTransferCompleted(companyId: string, transfer: Record<string, unknown>): void {
    this.notify('TransferCompleted', companyId);
    this.emit(companyId, RealtimeEvents.TRANSFER_COMPLETED, { transfer });
    this.scheduleDashboard('inventory');
  }

  emitDashboardKpiUpdated(patch: Record<string, unknown>): void {
    this.notify('DashboardUpdated');
    this.emitDashboard(RealtimeEvents.DASHBOARD_KPI_UPDATED, patch);
  }

  emitDashboardInventoryUpdated(patch: Record<string, unknown>): void {
    this.notify('DashboardUpdated');
    this.emitDashboard(RealtimeEvents.DASHBOARD_INVENTORY_UPDATED, patch);
  }

  emitDashboardOrdersUpdated(patch: Record<string, unknown>): void {
    this.notify('DashboardUpdated');
    this.emitDashboard(RealtimeEvents.DASHBOARD_ORDERS_UPDATED, patch);
  }

  emitDashboardTasksUpdated(patch: Record<string, unknown>): void {
    this.notify('DashboardUpdated');
    this.emitDashboard(RealtimeEvents.DASHBOARD_TASKS_UPDATED, patch);
  }

  emitPresenceOnline(presence: Record<string, unknown>): void {
    // Live UI indicator only — do not bump Module Versions (avoids sync storms).
    this.emitToRoomRaw(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.PRESENCE_ONLINE, { presence });
  }

  emitPresenceOffline(presence: Record<string, unknown>): void {
    this.emitToRoomRaw(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.PRESENCE_OFFLINE, { presence });
  }

  emitAuthSessionChanged(
    userId: string,
    payload: { type: string; userId: string; reason?: string },
  ): void {
    this.notify('SessionChanged', null, userId);
    // Session force-logout needs the typed payload — always emit.
    this.emitToUserRaw(userId, RealtimeEvents.AUTH_SESSION_CHANGED, payload);
    this.emitToRoomRaw(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.AUTH_SESSION_CHANGED, payload);
  }

  private emitToUserRaw(
    userId: string,
    event: RealtimeEventName,
    payload: Record<string, unknown>,
  ): void {
    if (!this.io) {
      this.log.debug(`Skip ${event} (socket server not ready).`);
      return;
    }
    try {
      this.io.to(userRoomName(userId)).emit(event, { ...payload, at: new Date().toISOString() });
    } catch (err) {
      this.log.warn(`Emit ${event} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  emitToUser(userId: string, event: RealtimeEventName, payload: Record<string, unknown>): void {
    if (!this.syncMode.emitLegacy()) return;
    this.emitToUserRaw(userId, event, payload);
  }

  emitAuditLogCreated(auditLog: Record<string, unknown>, companyId: string | null): void {
    this.notify('AuditLogCreated', companyId);
    this.emitToRoom(INTERNAL_MASTER_DATA_ROOM, RealtimeEvents.AUDIT_LOG_CREATED, { auditLog });
    if (companyId) {
      this.emit(companyId, RealtimeEvents.AUDIT_LOG_CREATED, { auditLog });
    }
  }

  emitNotificationCreated(
    notification: Record<string, unknown>,
    target: { userId?: string | null; companyId?: string | null },
  ): void {
    this.notify('NotificationCreated', target.companyId, target.userId);
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
    this.notify('NotificationRead', null, userId);
    this.emitToUser(userId, RealtimeEvents.NOTIFICATION_READ, payload);
  }

  emitNotificationDeleted(userId: string, notificationId: string): void {
    this.notify('NotificationDeleted', null, userId);
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
