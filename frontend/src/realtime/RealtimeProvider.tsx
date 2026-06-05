import { useQueryClient } from '@tanstack/react-query';
import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { getAccessToken } from '../auth/authStorage';
import { RealtimeEvents } from './constants';
import type { WarehouseTaskListItem } from '../api/tasks';
import {
  patchLocationArchived,
  patchLocationCreated,
  patchLocationUpdated,
  patchProductArchived,
  patchProductCreated,
  patchProductDeleted,
  patchProductUpdated,
  patchUserCreated,
  patchUserDeleted,
  patchUserUpdated,
  patchWarehouseCreated,
  patchWarehouseUpdated,
} from './master-data-cache';
import {
  patchAdjustmentApproved,
  patchAdjustmentCreated,
  patchCycleCountCompleted,
  patchCycleCountCreated,
  patchCycleCountUpdated,
  patchReturnCompleted,
  patchReturnConfirmed,
  patchReturnCreated,
  patchReturnUpdated,
  patchTransferCompleted,
  patchTransferCreated,
  type TransferRealtimePayload,
} from './ops-cache';
import { patchCycleCountMyTasksStatus, patchTaskUpdated } from './tasks-cache';
import {
  patchInboundCreated,
  patchInboundUpdated,
  patchOutboundCreated,
  patchOutboundUpdated,
} from './orders-cache';
import { patchInventoryChanged } from './inventory-cache';
import {
  patchAuditLogCreated,
  patchNotificationCreated,
  patchNotificationDeleted,
  patchNotificationRead,
} from './activity-cache';
import {
  patchDashboardInventory,
  patchDashboardKpi,
  patchDashboardOrders,
  patchDashboardTasks,
} from './dashboard-cache';
import {
  patchPresenceOffline,
  patchPresenceOnline,
  type PresenceUser,
} from './presence-cache';
import { socketHttpOrigin } from './socketBaseUrl';
import type { AuditLogSummary } from '../api/audit-logs';
import type { Product } from '../api/products';
import type { UserListRow } from '../api/users';
import type { Warehouse } from '../api/warehouses';
import type { Location } from '../api/locations';
import type { ReturnOrder, ReturnOrderListItem } from '../api/returns';
import type { CycleCountDetail, CycleCountListItem } from '../api/cycle-count';
import type { StockAdjustment } from '../api/adjustments';
import type { AppNotification } from '../services/notificationsService';

type Props = { children: ReactNode };

/**
 * Internal WMS realtime: connects to `/realtime` with JWT + tenant `companyId`
 * (same as `X-Company-Id` — use `VITE_MOCK_COMPANY_ID` in dev).
 */
export function RealtimeProvider({ children }: Props): ReactElement {
  const { user } = useAuth();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const companyId = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined)?.trim();
    if (!user || !token || !companyId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(`${socketHttpOrigin()}/realtime`, {
      auth: { token, companyId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    const onInboundCreated = (payload: {
      listItem?: Record<string, unknown>;
      orderId?: string;
      status?: string;
    }): void => {
      patchInboundCreated(qc, payload);
    };
    const onInboundUpdated = (payload: {
      listItem?: Record<string, unknown>;
      orderId?: string;
      status?: string;
    }): void => {
      patchInboundUpdated(qc, payload);
    };
    const onOutboundCreated = (payload: {
      listItem?: Record<string, unknown>;
      orderId?: string;
      status?: string;
    }): void => {
      patchOutboundCreated(qc, payload);
    };
    const onOutboundUpdated = (payload: {
      listItem?: Record<string, unknown>;
      orderId?: string;
      status?: string;
    }): void => {
      patchOutboundUpdated(qc, payload);
    };
    const onTask = (payload: {
      taskId?: string;
      task?: WarehouseTaskListItem & Record<string, unknown>;
      referenceType?: string;
      referenceId?: string;
    }): void => {
      patchTaskUpdated(qc, payload);
    };
    const onInventory = (payload: {
      productId?: string;
      stockRow?: Record<string, unknown>;
      productSummary?: Record<string, unknown>;
      ledgerEntry?: Record<string, unknown>;
    }): void => {
      patchInventoryChanged(qc, payload as Parameters<typeof patchInventoryChanged>[1]);
    };

    const onProductCreated = (payload: { product?: Product }): void => {
      if (payload?.product) patchProductCreated(qc, payload.product);
    };
    const onProductUpdated = (payload: { product?: Product }): void => {
      if (payload?.product) patchProductUpdated(qc, payload.product);
    };
    const onProductArchived = (payload: { productId?: string }): void => {
      if (payload?.productId) patchProductArchived(qc, payload.productId);
    };
    const onProductDeleted = (payload: { productId?: string }): void => {
      if (payload?.productId) patchProductDeleted(qc, payload.productId);
    };
    const onUserCreated = (payload: { user?: UserListRow }): void => {
      if (payload?.user) patchUserCreated(qc, payload.user);
    };
    const onUserUpdated = (payload: { user?: UserListRow }): void => {
      if (payload?.user) patchUserUpdated(qc, payload.user);
    };
    const onUserDeleted = (payload: { userId?: string }): void => {
      if (payload?.userId) patchUserDeleted(qc, payload.userId);
    };
    const onWarehouseCreated = (payload: { warehouse?: Warehouse }): void => {
      if (payload?.warehouse) patchWarehouseCreated(qc, payload.warehouse);
    };
    const onWarehouseUpdated = (payload: { warehouse?: Warehouse }): void => {
      if (payload?.warehouse) patchWarehouseUpdated(qc, payload.warehouse);
    };
    const onLocationCreated = (payload: { location?: Location }): void => {
      if (payload?.location) patchLocationCreated(qc, payload.location);
    };
    const onLocationUpdated = (payload: { location?: Location }): void => {
      if (payload?.location) patchLocationUpdated(qc, payload.location);
    };
    const onLocationArchived = (payload: { warehouseId?: string; locationId?: string }): void => {
      if (payload?.warehouseId && payload?.locationId) {
        patchLocationArchived(qc, payload.warehouseId, payload.locationId);
      }
    };

    const onReturnCreated = (payload: {
      listItem?: ReturnOrderListItem;
      return?: ReturnOrder;
    }): void => {
      patchReturnCreated(qc, payload);
    };
    const onReturnUpdated = (payload: {
      listItem?: ReturnOrderListItem;
      return?: ReturnOrder;
    }): void => {
      patchReturnUpdated(qc, payload);
    };
    const onReturnConfirmed = (payload: {
      listItem?: ReturnOrderListItem;
      return?: ReturnOrder;
    }): void => {
      patchReturnConfirmed(qc, payload);
    };
    const onReturnCompleted = (payload: {
      listItem?: ReturnOrderListItem;
      return?: ReturnOrder;
    }): void => {
      patchReturnCompleted(qc, payload);
    };
    const onCycleCountCreated = (payload: {
      listItem?: CycleCountListItem;
      count?: CycleCountDetail;
    }): void => {
      patchCycleCountCreated(qc, payload);
      if (payload.listItem) {
        patchCycleCountMyTasksStatus(
          qc,
          payload.listItem.id,
          payload.listItem.status,
          payload.listItem.warehouseId,
        );
      }
    };
    const onCycleCountUpdated = (payload: {
      listItem?: CycleCountListItem;
      count?: CycleCountDetail;
    }): void => {
      patchCycleCountUpdated(qc, payload);
      if (payload.listItem) {
        patchCycleCountMyTasksStatus(
          qc,
          payload.listItem.id,
          payload.listItem.status,
          payload.listItem.warehouseId,
        );
      }
    };
    const onCycleCountCompleted = (payload: {
      listItem?: CycleCountListItem;
      count?: CycleCountDetail;
    }): void => {
      patchCycleCountCompleted(qc, payload);
      if (payload.listItem) {
        patchCycleCountMyTasksStatus(
          qc,
          payload.listItem.id,
          payload.listItem.status,
          payload.listItem.warehouseId,
        );
      }
    };
    const onAdjustmentCreated = (payload: { adjustment?: StockAdjustment }): void => {
      if (payload?.adjustment) patchAdjustmentCreated(qc, payload.adjustment);
    };
    const onAdjustmentApproved = (payload: { adjustment?: StockAdjustment }): void => {
      if (payload?.adjustment) patchAdjustmentApproved(qc, payload.adjustment);
    };
    const onTransferCreated = (payload: { transfer?: TransferRealtimePayload }): void => {
      if (payload?.transfer) patchTransferCreated(qc, payload.transfer);
    };
    const onTransferCompleted = (payload: { transfer?: TransferRealtimePayload }): void => {
      if (payload?.transfer) patchTransferCompleted(qc, payload.transfer);
    };

    const onAuditLogCreated = (payload: { auditLog?: AuditLogSummary }): void => {
      if (payload?.auditLog) patchAuditLogCreated(qc, payload.auditLog);
    };
    const onNotificationCreated = (payload: { notification?: AppNotification }): void => {
      if (payload?.notification) patchNotificationCreated(qc, payload.notification);
    };
    const onNotificationRead = (payload: {
      notification?: AppNotification;
      markAllRead?: boolean;
    }): void => {
      patchNotificationRead(qc, payload);
    };
    const onNotificationDeleted = (payload: { notificationId?: string }): void => {
      if (payload?.notificationId) patchNotificationDeleted(qc, payload.notificationId);
    };

    const onDashboardKpi = (payload: Record<string, unknown>): void => {
      patchDashboardKpi(qc, payload as Parameters<typeof patchDashboardKpi>[1]);
    };
    const onDashboardInventory = (payload: Record<string, unknown>): void => {
      patchDashboardInventory(qc, payload as Parameters<typeof patchDashboardInventory>[1]);
    };
    const onDashboardOrders = (payload: Record<string, unknown>): void => {
      patchDashboardOrders(qc, payload as Parameters<typeof patchDashboardOrders>[1]);
    };
    const onDashboardTasks = (payload: Record<string, unknown>): void => {
      patchDashboardTasks(qc, payload as Parameters<typeof patchDashboardTasks>[1]);
    };
    const onPresenceOnline = (payload: { presence?: PresenceUser }): void => {
      if (payload?.presence) patchPresenceOnline(qc, payload.presence);
    };
    const onPresenceOffline = (payload: { presence?: PresenceUser }): void => {
      if (payload?.presence) patchPresenceOffline(qc, payload.presence);
    };
    const onAuthSessionChanged = (payload: {
      type?: string;
      userId?: string;
      reason?: string;
    }): void => {
      if (!payload?.type || !payload.userId) return;
      if (
        payload.userId === user.id &&
        (payload.type === 'forced_logout' || payload.type === 'expired' || payload.type === 'logout')
      ) {
        window.dispatchEvent(
          new CustomEvent('wms:session-changed', {
            detail: { type: payload.type, reason: payload.reason },
          }),
        );
      }
    };

    socket.on(RealtimeEvents.INBOUND_ORDER_CREATED, onInboundCreated);
    socket.on(RealtimeEvents.INBOUND_ORDER_UPDATED, onInboundUpdated);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutboundCreated);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutboundUpdated);
    socket.on(RealtimeEvents.TASK_UPDATED, onTask);
    socket.on(RealtimeEvents.INVENTORY_CHANGED, onInventory);
    socket.on(RealtimeEvents.PRODUCT_CREATED, onProductCreated);
    socket.on(RealtimeEvents.PRODUCT_UPDATED, onProductUpdated);
    socket.on(RealtimeEvents.PRODUCT_ARCHIVED, onProductArchived);
    socket.on(RealtimeEvents.PRODUCT_DELETED, onProductDeleted);
    socket.on(RealtimeEvents.USER_CREATED, onUserCreated);
    socket.on(RealtimeEvents.USER_UPDATED, onUserUpdated);
    socket.on(RealtimeEvents.USER_DELETED, onUserDeleted);
    socket.on(RealtimeEvents.WAREHOUSE_CREATED, onWarehouseCreated);
    socket.on(RealtimeEvents.WAREHOUSE_UPDATED, onWarehouseUpdated);
    socket.on(RealtimeEvents.LOCATION_CREATED, onLocationCreated);
    socket.on(RealtimeEvents.LOCATION_UPDATED, onLocationUpdated);
    socket.on(RealtimeEvents.LOCATION_ARCHIVED, onLocationArchived);
    socket.on(RealtimeEvents.RETURN_CREATED, onReturnCreated);
    socket.on(RealtimeEvents.RETURN_UPDATED, onReturnUpdated);
    socket.on(RealtimeEvents.RETURN_CONFIRMED, onReturnConfirmed);
    socket.on(RealtimeEvents.RETURN_COMPLETED, onReturnCompleted);
    socket.on(RealtimeEvents.CYCLE_COUNT_CREATED, onCycleCountCreated);
    socket.on(RealtimeEvents.CYCLE_COUNT_UPDATED, onCycleCountUpdated);
    socket.on(RealtimeEvents.CYCLE_COUNT_COMPLETED, onCycleCountCompleted);
    socket.on(RealtimeEvents.ADJUSTMENT_CREATED, onAdjustmentCreated);
    socket.on(RealtimeEvents.ADJUSTMENT_APPROVED, onAdjustmentApproved);
    socket.on(RealtimeEvents.TRANSFER_CREATED, onTransferCreated);
    socket.on(RealtimeEvents.TRANSFER_COMPLETED, onTransferCompleted);
    socket.on(RealtimeEvents.AUDIT_LOG_CREATED, onAuditLogCreated);
    socket.on(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
    socket.on(RealtimeEvents.NOTIFICATION_READ, onNotificationRead);
    socket.on(RealtimeEvents.NOTIFICATION_DELETED, onNotificationDeleted);
    socket.on(RealtimeEvents.DASHBOARD_KPI_UPDATED, onDashboardKpi);
    socket.on(RealtimeEvents.DASHBOARD_INVENTORY_UPDATED, onDashboardInventory);
    socket.on(RealtimeEvents.DASHBOARD_ORDERS_UPDATED, onDashboardOrders);
    socket.on(RealtimeEvents.DASHBOARD_TASKS_UPDATED, onDashboardTasks);
    socket.on(RealtimeEvents.PRESENCE_ONLINE, onPresenceOnline);
    socket.on(RealtimeEvents.PRESENCE_OFFLINE, onPresenceOffline);
    socket.on(RealtimeEvents.AUTH_SESSION_CHANGED, onAuthSessionChanged);

    return () => {
      socket.off(RealtimeEvents.INBOUND_ORDER_CREATED, onInboundCreated);
      socket.off(RealtimeEvents.INBOUND_ORDER_UPDATED, onInboundUpdated);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutboundCreated);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutboundUpdated);
      socket.off(RealtimeEvents.TASK_UPDATED, onTask);
      socket.off(RealtimeEvents.INVENTORY_CHANGED, onInventory);
      socket.off(RealtimeEvents.PRODUCT_CREATED, onProductCreated);
      socket.off(RealtimeEvents.PRODUCT_UPDATED, onProductUpdated);
      socket.off(RealtimeEvents.PRODUCT_ARCHIVED, onProductArchived);
      socket.off(RealtimeEvents.PRODUCT_DELETED, onProductDeleted);
      socket.off(RealtimeEvents.USER_CREATED, onUserCreated);
      socket.off(RealtimeEvents.USER_UPDATED, onUserUpdated);
      socket.off(RealtimeEvents.USER_DELETED, onUserDeleted);
      socket.off(RealtimeEvents.WAREHOUSE_CREATED, onWarehouseCreated);
      socket.off(RealtimeEvents.WAREHOUSE_UPDATED, onWarehouseUpdated);
      socket.off(RealtimeEvents.LOCATION_CREATED, onLocationCreated);
      socket.off(RealtimeEvents.LOCATION_UPDATED, onLocationUpdated);
      socket.off(RealtimeEvents.LOCATION_ARCHIVED, onLocationArchived);
      socket.off(RealtimeEvents.RETURN_CREATED, onReturnCreated);
      socket.off(RealtimeEvents.RETURN_UPDATED, onReturnUpdated);
      socket.off(RealtimeEvents.RETURN_CONFIRMED, onReturnConfirmed);
      socket.off(RealtimeEvents.RETURN_COMPLETED, onReturnCompleted);
      socket.off(RealtimeEvents.CYCLE_COUNT_CREATED, onCycleCountCreated);
      socket.off(RealtimeEvents.CYCLE_COUNT_UPDATED, onCycleCountUpdated);
      socket.off(RealtimeEvents.CYCLE_COUNT_COMPLETED, onCycleCountCompleted);
      socket.off(RealtimeEvents.ADJUSTMENT_CREATED, onAdjustmentCreated);
      socket.off(RealtimeEvents.ADJUSTMENT_APPROVED, onAdjustmentApproved);
      socket.off(RealtimeEvents.TRANSFER_CREATED, onTransferCreated);
      socket.off(RealtimeEvents.TRANSFER_COMPLETED, onTransferCompleted);
      socket.off(RealtimeEvents.AUDIT_LOG_CREATED, onAuditLogCreated);
      socket.off(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
      socket.off(RealtimeEvents.NOTIFICATION_READ, onNotificationRead);
      socket.off(RealtimeEvents.NOTIFICATION_DELETED, onNotificationDeleted);
      socket.off(RealtimeEvents.DASHBOARD_KPI_UPDATED, onDashboardKpi);
      socket.off(RealtimeEvents.DASHBOARD_INVENTORY_UPDATED, onDashboardInventory);
      socket.off(RealtimeEvents.DASHBOARD_ORDERS_UPDATED, onDashboardOrders);
      socket.off(RealtimeEvents.DASHBOARD_TASKS_UPDATED, onDashboardTasks);
      socket.off(RealtimeEvents.PRESENCE_ONLINE, onPresenceOnline);
      socket.off(RealtimeEvents.PRESENCE_OFFLINE, onPresenceOffline);
      socket.off(RealtimeEvents.AUTH_SESSION_CHANGED, onAuthSessionChanged);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user, qc]);

  return <>{children}</>;
}
