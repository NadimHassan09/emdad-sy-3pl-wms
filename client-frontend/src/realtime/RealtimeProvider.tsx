import { useQueryClient } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { getStoredBearer } from '../services/authStorage';
import { RealtimeEvents } from './constants';
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

    const onOrdersOrInventory = (): void => {
      void qc.invalidateQueries({ queryKey: ['client', 'stock'] });
    };

    socket.on(RealtimeEvents.INBOUND_ORDER_CREATED, onOrdersOrInventory);
    socket.on(RealtimeEvents.INBOUND_ORDER_UPDATED, onOrdersOrInventory);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOrdersOrInventory);
    socket.on(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOrdersOrInventory);
    socket.on(RealtimeEvents.TASK_UPDATED, onOrdersOrInventory);
    socket.on(RealtimeEvents.INVENTORY_CHANGED, onOrdersOrInventory);

    return () => {
      socket.off(RealtimeEvents.INBOUND_ORDER_CREATED, onOrdersOrInventory);
      socket.off(RealtimeEvents.INBOUND_ORDER_UPDATED, onOrdersOrInventory);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_CREATED, onOrdersOrInventory);
      socket.off(RealtimeEvents.OUTBOUND_ORDER_UPDATED, onOrdersOrInventory);
      socket.off(RealtimeEvents.TASK_UPDATED, onOrdersOrInventory);
      socket.off(RealtimeEvents.INVENTORY_CHANGED, onOrdersOrInventory);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user, qc]);

  return <>{children}</>;
}
