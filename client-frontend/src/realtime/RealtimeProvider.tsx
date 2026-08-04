import { useQueryClient } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { clearStoredBearer, getStoredBearer } from '../services/authStorage';
import type { ClientNotification } from '../services/clientNotificationsService';
import type { ClientProductRow } from '../services/clientProductsService';
import type { ClientInboundOrderRow } from '../services/clientInboundOrdersService';
import type { ClientOutboundOrderRow } from '../services/clientOutboundOrdersService';
import type { ClientStockRow } from '../services/stockService';
import { RealtimeEvents } from './constants';
import {
  invalidateClientBillingConsistencyGroup,
  invalidateClientCodConsistencyGroup,
  invalidateClientDashboardConsistencyGroup,
  invalidateClientReturnsConsistencyGroup,
} from './consistency-groups';
import {
  patchClientNotificationCreated,
  patchClientNotificationRead,
} from './notifications-cache';
import {
  patchClientInboundCreated,
  patchClientInboundUpdated,
  patchClientOutboundCreated,
  patchClientOutboundUpdated,
} from './orders-cache';
import {
  patchClientProductArchived,
  patchClientProductCreated,
  patchClientProductUpdated,
} from './products-cache';
import { patchClientStockRow } from './stock-cache';
import { socketHttpOrigin } from './socketBaseUrl';

type Props = { children: ReactNode };

/** Client portal: JWT includes `companyId`; company + user rooms receive events. */
export function RealtimeProvider({ children }: Props): ReactElement {
  const { user } = useAuth();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getStoredBearer();
    const companyId = user?.companyId;
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
      listItem?: ClientInboundOrderRow;
      orderId?: string;
      status?: string;
    }): void => {
      patchClientInboundCreated(qc, payload);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onInboundUpdated = (payload: {
      listItem?: ClientInboundOrderRow;
      orderId?: string;
      status?: string;
    }): void => {
      patchClientInboundUpdated(qc, payload);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onOutboundCreated = (payload: {
      listItem?: ClientOutboundOrderRow;
      orderId?: string;
      status?: string;
    }): void => {
      patchClientOutboundCreated(qc, payload);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onOutboundUpdated = (payload: {
      listItem?: ClientOutboundOrderRow;
      orderId?: string;
      status?: string;
    }): void => {
      patchClientOutboundUpdated(qc, payload);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onOmsOrderEvent = (payload: { orderId?: string }): void => {
      if (!payload?.orderId) return;
      void qc.invalidateQueries({ queryKey: ['client', 'outbound-orders'] });
      void qc.invalidateQueries({ queryKey: ['client', 'outbound-orders', payload.orderId] });
      void qc.invalidateQueries({ queryKey: ['client', 'outbound-orders', payload.orderId, 'oms'] });
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] });
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders', payload.orderId] });
      invalidateClientCodConsistencyGroup(qc);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onInventory = (payload: { stockRow?: ClientStockRow }): void => {
      if (payload.stockRow) patchClientStockRow(qc, payload.stockRow);
      void qc.invalidateQueries({ queryKey: ['client', 'products'] });
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onProductCreated = (payload: { product?: ClientProductRow }): void => {
      if (payload.product) patchClientProductCreated(qc, payload.product);
    };
    const onProductUpdated = (payload: { product?: ClientProductRow }): void => {
      if (payload.product) patchClientProductUpdated(qc, payload.product);
    };
    const onProductArchived = (payload: { productId?: string }): void => {
      if (payload.productId) patchClientProductArchived(qc, payload.productId);
    };
    const onProductDeleted = (payload: { productId?: string }): void => {
      if (payload.productId) patchClientProductArchived(qc, payload.productId);
    };
    const onNotificationCreated = (payload: { notification?: ClientNotification }): void => {
      if (payload.notification) patchClientNotificationCreated(qc, payload.notification);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onNotificationRead = (payload: {
      notification?: ClientNotification;
      markAllRead?: boolean;
    }): void => {
      patchClientNotificationRead(qc, payload);
    };
    const onNotificationDeleted = (payload: { notificationId?: string }): void => {
      if (!payload?.notificationId) return;
      void qc.invalidateQueries({ queryKey: ['client', 'notifications'] });
    };
    const onReturnEvent = (): void => {
      invalidateClientReturnsConsistencyGroup(qc);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onOmsReturnEvent = (): void => {
      invalidateClientReturnsConsistencyGroup(qc);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onCompanyOrBilling = (payload?: { restricted?: boolean; status?: string }): void => {
      invalidateClientDashboardConsistencyGroup(qc);
      if (payload?.restricted || payload?.status === 'suspended' || payload?.status === 'archived') {
        clearStoredBearer();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('account-inactive')) {
          window.location.assign('/account-inactive');
        }
      }
    };
    const onCodUpdated = (): void => {
      invalidateClientCodConsistencyGroup(qc);
      invalidateClientDashboardConsistencyGroup(qc);
    };
    const onInvoiceOrPlanUpdated = (): void => {
      invalidateClientBillingConsistencyGroup(qc);
    };
    const onAuthSessionChanged = (payload: {
      type?: string;
      userId?: string;
      reason?: string;
    }): void => {
      if (!payload?.type || !payload.userId) return;
      if (payload.userId !== user.id) return;
      if (
        payload.type === 'forced_logout' ||
        payload.type === 'expired' ||
        payload.type === 'logout'
      ) {
        clearStoredBearer();
        if (typeof window !== 'undefined') {
          window.location.assign('/login');
        }
      }
    };

    socket.on(RealtimeEvents.INBOUND_ORDER_CREATED, onInboundCreated);
    socket.on(RealtimeEvents.INBOUND_ORDER_UPDATED, onInboundUpdated);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutboundCreated);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutboundUpdated);
    socket.on(RealtimeEvents.OMS_ORDER_EVENT, onOmsOrderEvent);
    socket.on(RealtimeEvents.TASK_UPDATED, onInventory);
    socket.on(RealtimeEvents.INVENTORY_CHANGED, onInventory);
    socket.on(RealtimeEvents.PRODUCT_CREATED, onProductCreated);
    socket.on(RealtimeEvents.PRODUCT_UPDATED, onProductUpdated);
    socket.on(RealtimeEvents.PRODUCT_ARCHIVED, onProductArchived);
    socket.on(RealtimeEvents.PRODUCT_DELETED, onProductDeleted);
    socket.on(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
    socket.on(RealtimeEvents.NOTIFICATION_READ, onNotificationRead);
    socket.on(RealtimeEvents.NOTIFICATION_DELETED, onNotificationDeleted);
    socket.on(RealtimeEvents.RETURN_CREATED, onReturnEvent);
    socket.on(RealtimeEvents.RETURN_UPDATED, onReturnEvent);
    socket.on(RealtimeEvents.RETURN_CONFIRMED, onReturnEvent);
    socket.on(RealtimeEvents.RETURN_COMPLETED, onReturnEvent);
    socket.on(RealtimeEvents.OMS_RETURN_EVENT, onOmsReturnEvent);
    socket.on(RealtimeEvents.COMPANY_LIFECYCLE_CHANGED, onCompanyOrBilling);
    socket.on(RealtimeEvents.BILLING_RESTRICTION_CHANGED, onCompanyOrBilling);
    socket.on(RealtimeEvents.COD_UPDATED, onCodUpdated);
    socket.on(RealtimeEvents.INVOICE_UPDATED, onInvoiceOrPlanUpdated);
    socket.on(RealtimeEvents.PLAN_UPDATED, onInvoiceOrPlanUpdated);
    socket.on(RealtimeEvents.AUTH_SESSION_CHANGED, onAuthSessionChanged);

    const onReconnect = (): void => {
      // Failure Handling §11: stale recovery after reconnect
      invalidateClientDashboardConsistencyGroup(qc);
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] });
      void qc.invalidateQueries({ queryKey: ['client', 'inbound-orders'] });
      void qc.invalidateQueries({ queryKey: ['client', 'outbound-orders'] });
      void qc.invalidateQueries({ queryKey: ['client', 'products'] });
      invalidateClientReturnsConsistencyGroup(qc);
      invalidateClientCodConsistencyGroup(qc);
    };
    socket.on('connect', onReconnect);

    return () => {
      socket.off(RealtimeEvents.INBOUND_ORDER_CREATED, onInboundCreated);
      socket.off(RealtimeEvents.INBOUND_ORDER_UPDATED, onInboundUpdated);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutboundCreated);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutboundUpdated);
      socket.off(RealtimeEvents.OMS_ORDER_EVENT, onOmsOrderEvent);
      socket.off(RealtimeEvents.TASK_UPDATED, onInventory);
      socket.off(RealtimeEvents.INVENTORY_CHANGED, onInventory);
      socket.off(RealtimeEvents.PRODUCT_CREATED, onProductCreated);
      socket.off(RealtimeEvents.PRODUCT_UPDATED, onProductUpdated);
      socket.off(RealtimeEvents.PRODUCT_ARCHIVED, onProductArchived);
      socket.off(RealtimeEvents.PRODUCT_DELETED, onProductDeleted);
      socket.off(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
      socket.off(RealtimeEvents.NOTIFICATION_READ, onNotificationRead);
      socket.off(RealtimeEvents.NOTIFICATION_DELETED, onNotificationDeleted);
      socket.off(RealtimeEvents.RETURN_CREATED, onReturnEvent);
      socket.off(RealtimeEvents.RETURN_UPDATED, onReturnEvent);
      socket.off(RealtimeEvents.RETURN_CONFIRMED, onReturnEvent);
      socket.off(RealtimeEvents.RETURN_COMPLETED, onReturnEvent);
      socket.off(RealtimeEvents.OMS_RETURN_EVENT, onOmsReturnEvent);
      socket.off(RealtimeEvents.COMPANY_LIFECYCLE_CHANGED, onCompanyOrBilling);
      socket.off(RealtimeEvents.BILLING_RESTRICTION_CHANGED, onCompanyOrBilling);
      socket.off(RealtimeEvents.COD_UPDATED, onCodUpdated);
      socket.off(RealtimeEvents.INVOICE_UPDATED, onInvoiceOrPlanUpdated);
      socket.off(RealtimeEvents.PLAN_UPDATED, onInvoiceOrPlanUpdated);
      socket.off(RealtimeEvents.AUTH_SESSION_CHANGED, onAuthSessionChanged);
      socket.off('connect', onReconnect);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user, qc]);

  return <>{children}</>;
}
