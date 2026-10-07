import type { QueryClient } from '@tanstack/react-query';

import type {
  ClientInboundOrderDetail,
  ClientInboundOrderRow,
} from '../services/clientInboundOrdersService';
import type {
  ClientOutboundOrderDetail,
  ClientOutboundOrderRow,
} from '../services/clientOutboundOrdersService';

type Paged<T> = { items: T[]; total: number; limit?: number; offset?: number };

function patchOrderLists<T extends { id: string; status: string }>(
  qc: QueryClient,
  listKeyPrefix: readonly string[],
  row: T,
  mode: 'insert' | 'update',
): void {
  qc.setQueriesData<Paged<T>>({ queryKey: listKeyPrefix }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((item) => item.id === row.id);
    if (mode === 'insert') {
      if (idx >= 0) {
        const next = [...prev.items];
        next[idx] = { ...next[idx], ...row };
        return { ...prev, items: next };
      }
      return { ...prev, items: [row, ...prev.items], total: prev.total + 1 };
    }
    if (idx < 0) {
      return { ...prev, items: [row, ...prev.items], total: prev.total + 1 };
    }
    const next = [...prev.items];
    next[idx] = { ...next[idx], ...row };
    return { ...prev, items: next };
  });
}

function patchOrderStatus(
  qc: QueryClient,
  listKeyPrefix: readonly string[],
  orderId: string,
  patch: Partial<{ status: string }>,
): void {
  qc.setQueriesData<Paged<{ id: string; status: string }>>(
    { queryKey: listKeyPrefix },
    (prev) => {
      if (!prev?.items) return prev;
      const idx = prev.items.findIndex((item) => item.id === orderId);
      if (idx < 0) return prev;
      const next = [...prev.items];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, items: next };
    },
  );
}

export function patchClientInboundCreated(
  qc: QueryClient,
  payload: { listItem?: ClientInboundOrderRow; orderId?: string; status?: string },
): void {
  if (payload.listItem) {
    patchOrderLists(qc, ['client', 'inbound-orders'], payload.listItem, 'insert');
  }
  if (payload.orderId && payload.status) {
    patchOrderStatus(qc, ['client', 'inbound-orders'], payload.orderId, {
      status: payload.status,
    });
    qc.setQueryData<ClientInboundOrderDetail>(
      ['client', 'inbound-orders', payload.orderId],
      (prev) => (prev ? { ...prev, status: payload.status! } : prev),
    );
  }
}

export function patchClientInboundUpdated(
  qc: QueryClient,
  payload: { listItem?: ClientInboundOrderRow; orderId?: string; status?: string },
): void {
  if (payload.listItem) {
    patchOrderLists(qc, ['client', 'inbound-orders'], payload.listItem, 'update');
  } else if (payload.orderId && payload.status) {
    patchOrderStatus(qc, ['client', 'inbound-orders'], payload.orderId, {
      status: payload.status,
    });
    qc.setQueryData<ClientInboundOrderDetail>(
      ['client', 'inbound-orders', payload.orderId],
      (prev) => (prev ? { ...prev, status: payload.status! } : prev),
    );
  }
}

export function patchClientOutboundCreated(
  qc: QueryClient,
  payload: { listItem?: ClientOutboundOrderRow; orderId?: string; status?: string },
): void {
  if (payload.listItem) {
    patchOrderLists(qc, ['client', 'outbound-orders'], payload.listItem, 'insert');
  }
  if (payload.orderId && payload.status) {
    patchOrderStatus(qc, ['client', 'outbound-orders'], payload.orderId, {
      status: payload.status,
    });
    qc.setQueryData<ClientOutboundOrderDetail>(
      ['client', 'outbound-orders', payload.orderId],
      (prev) => (prev ? { ...prev, status: payload.status! } : prev),
    );
  }
}

export function patchClientOutboundUpdated(
  qc: QueryClient,
  payload: { listItem?: ClientOutboundOrderRow; orderId?: string; status?: string },
): void {
  if (payload.listItem) {
    patchOrderLists(qc, ['client', 'outbound-orders'], payload.listItem, 'update');
  } else if (payload.orderId && payload.status) {
    patchOrderStatus(qc, ['client', 'outbound-orders'], payload.orderId, {
      status: payload.status,
    });
    qc.setQueryData<ClientOutboundOrderDetail>(
      ['client', 'outbound-orders', payload.orderId],
      (prev) => (prev ? { ...prev, status: payload.status! } : prev),
    );
  }
}
