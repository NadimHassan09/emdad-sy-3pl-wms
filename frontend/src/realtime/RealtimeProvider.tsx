import { useQueryClient } from '@tanstack/react-query';
import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { getAccessToken } from '../auth/authStorage';
import { QK } from '../constants/query-keys';
import { RealtimeEvents } from './constants';
import { socketHttpOrigin } from './socketBaseUrl';

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

    const invalidateLists = (): void => {
      void qc.invalidateQueries({ queryKey: QK.inboundOrders });
      void qc.invalidateQueries({ queryKey: QK.outboundOrders });
      void qc.invalidateQueries({ queryKey: QK.tasks.all });
      void qc.invalidateQueries({ queryKey: QK.inventoryStock });
      void qc.invalidateQueries({ queryKey: [...QK.inventoryStockByProduct] });
      void qc.invalidateQueries({ queryKey: QK.ledger });
      void qc.invalidateQueries({ queryKey: QK.workflows.all });
      void qc.invalidateQueries({ queryKey: QK.dashboardOpenOrdersCharts });
    };

    const onInbound = (): void => {
      invalidateLists();
    };
    const onOutbound = (): void => {
      invalidateLists();
    };
    const onTask = (): void => {
      void qc.invalidateQueries({ queryKey: QK.tasks.all });
      void qc.invalidateQueries({ queryKey: QK.workflows.all });
      void qc.invalidateQueries({ queryKey: QK.dashboardOpenOrdersCharts });
    };
    const onInventory = (): void => {
      void qc.invalidateQueries({ queryKey: QK.inventoryStock });
      void qc.invalidateQueries({ queryKey: [...QK.inventoryStockByProduct] });
      void qc.invalidateQueries({ queryKey: QK.ledger });
    };

    socket.on(RealtimeEvents.INBOUND_ORDER_CREATED, onInbound);
    socket.on(RealtimeEvents.INBOUND_ORDER_UPDATED, onInbound);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutbound);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutbound);
    socket.on(RealtimeEvents.TASK_UPDATED, onTask);
    socket.on(RealtimeEvents.INVENTORY_CHANGED, onInventory);

    return () => {
      socket.off(RealtimeEvents.INBOUND_ORDER_CREATED, onInbound);
      socket.off(RealtimeEvents.INBOUND_ORDER_UPDATED, onInbound);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOutbound);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOutbound);
      socket.off(RealtimeEvents.TASK_UPDATED, onTask);
      socket.off(RealtimeEvents.INVENTORY_CHANGED, onInventory);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user, qc]);

  return <>{children}</>;
}
