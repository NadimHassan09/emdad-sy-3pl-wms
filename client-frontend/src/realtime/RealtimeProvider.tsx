import { useQueryClient } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { getStoredBearer } from '../services/authStorage';
import type { ClientNotification } from '../services/clientNotificationsService';
import type { ClientProductRow } from '../services/clientProductsService';
import type {
  ClientInboundOrderRow,
} from '../services/clientInboundOrdersService';
import type {
  ClientOutboundOrderRow,
} from '../services/clientOutboundOrdersService';
import type { ClientStockRow } from '../services/stockService';
import { RealtimeEvents } from './constants';
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

/** Client portal: JWT includes `companyId`; only `company:{id}` room receives events. */
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
    };
    const onInboundUpdated = (payload: {
      listItem?: ClientInboundOrderRow;
      orderId?: string;
      status?: string;
    }): void => {
      patchClientInboundUpdated(qc, payload);
    };
    const onOutboundCreated = (payload: {
      listItem?: ClientOutboundOrderRow;
      orderId?: string;
      status?: string;
    }): void => {
      patchClientOutboundCreated(qc, payload);
    };
    const onOutboundUpdated = (payload: {
      listItem?: ClientOutboundOrderRow;
      orderId?: string;
      status?: string;
    }): void => {
      patchClientOutboundUpdated(qc, payload);
    };
    const onInventory = (payload: { stockRow?: ClientStockRow }): void => {
      if (payload.stockRow) patchClientStockRow(qc, payload.stockRow);
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
    const onNotificationCreated = (payload: { notification?: ClientNotification }): void => {
      if (payload.notification) patchClientNotificationCreated(qc, payload.notification);
    };
    const onNotificationRead = (payload: {
      notification?: ClientNotification;
      markAllRead?: boolean;
    }): void => {
      patchClientNotificationRead(qc, payload);
    };

    socket.on(RealtimeEvents.INBOUND_ORDER_CREATED, onInboundCreated);
    socket.on(RealtimeEvents.INBOUND_ORDER_UPDATED, onInboundUpdated);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutboundCreated);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutboundUpdated);
    socket.on(RealtimeEvents.TASK_UPDATED, onInventory);
    socket.on(RealtimeEvents.INVENTORY_CHANGED, onInventory);
    socket.on(RealtimeEvents.PRODUCT_CREATED, onProductCreated);
    socket.on(RealtimeEvents.PRODUCT_UPDATED, onProductUpdated);
    socket.on(RealtimeEvents.PRODUCT_ARCHIVED, onProductArchived);
    socket.on(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
    socket.on(RealtimeEvents.NOTIFICATION_READ, onNotificationRead);

    return () => {
      socket.off(RealtimeEvents.INBOUND_ORDER_CREATED, onInboundCreated);
      socket.off(RealtimeEvents.INBOUND_ORDER_UPDATED, onInboundUpdated);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutboundCreated);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutboundUpdated);
      socket.off(RealtimeEvents.TASK_UPDATED, onInventory);
      socket.off(RealtimeEvents.INVENTORY_CHANGED, onInventory);
      socket.off(RealtimeEvents.PRODUCT_CREATED, onProductCreated);
      socket.off(RealtimeEvents.PRODUCT_UPDATED, onProductUpdated);
      socket.off(RealtimeEvents.PRODUCT_ARCHIVED, onProductArchived);
      socket.off(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
      socket.off(RealtimeEvents.NOTIFICATION_READ, onNotificationRead);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user, qc]);

  return <>{children}</>;
}
