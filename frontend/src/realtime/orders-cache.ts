import type { QueryClient } from '@tanstack/react-query';

import type { InboundOrder } from '../api/inbound';
import type { OutboundOrder } from '../api/outbound';
import type { PageResult } from '../api/client';
import { QK } from '../constants/query-keys';

type InboundListRow = InboundOrder;
type OutboundListRow = OutboundOrder;

function patchOrderListQueries<T extends { id: string }>(
  qc: QueryClient,
  queryKeyPrefix: readonly string[],
  row: Partial<T> & { id: string },
  mode: 'insert' | 'update',
): void {
  qc.setQueriesData<PageResult<T>>({ queryKey: queryKeyPrefix }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((item) => item.id === row.id);
    if (mode === 'insert') {
      if (idx >= 0) {
        const next = [...prev.items];
        next[idx] = { ...next[idx], ...row };
        return { ...prev, items: next };
      }
      return { ...prev, items: [row as T, ...prev.items], total: prev.total + 1 };
    }
    if (idx < 0) {
      return { ...prev, items: [row as T, ...prev.items], total: prev.total + 1 };
    }
    const next = [...prev.items];
    next[idx] = { ...next[idx], ...row };
    return { ...prev, items: next };
  });
}

function patchOrderDetail<T extends { id: string; status: string }>(
  qc: QueryClient,
  queryKeyPrefix: readonly string[],
  orderId: string,
  patch: Partial<T>,
): void {
  qc.setQueryData<T>([...queryKeyPrefix, orderId], (prev) =>
    prev ? { ...prev, ...patch } : prev,
  );
}

function asInboundRow(raw: Record<string, unknown>): Partial<InboundListRow> & { id: string } {
  return raw as Partial<InboundListRow> & { id: string };
}

function asOutboundRow(raw: Record<string, unknown>): Partial<OutboundListRow> & { id: string } {
  return raw as Partial<OutboundListRow> & { id: string };
}

export function patchInboundCreated(
  qc: QueryClient,
  payload: { listItem?: Record<string, unknown>; orderId?: string; status?: string },
): void {
  if (payload.listItem?.id) {
    const row = asInboundRow(payload.listItem);
    patchOrderListQueries(qc, QK.inboundOrders, row, 'insert');
    patchOrderDetail(qc, QK.inboundOrders, row.id, row);
  } else if (payload.orderId && payload.status) {
    patchOrderListQueries(
      qc,
      QK.inboundOrders,
      { id: payload.orderId, status: payload.status as InboundOrder['status'] },
      'update',
    );
    patchOrderDetail(qc, QK.inboundOrders, payload.orderId, {
      id: payload.orderId,
      status: payload.status as InboundOrder['status'],
    });
  }
}

export function patchInboundUpdated(
  qc: QueryClient,
  payload: { listItem?: Record<string, unknown>; orderId?: string; status?: string },
): void {
  if (payload.listItem?.id) {
    const row = asInboundRow(payload.listItem);
    patchOrderListQueries(qc, QK.inboundOrders, row, 'update');
    patchOrderDetail(qc, QK.inboundOrders, row.id, row);
  } else if (payload.orderId && payload.status) {
    patchOrderListQueries(
      qc,
      QK.inboundOrders,
      { id: payload.orderId, status: payload.status as InboundOrder['status'] },
      'update',
    );
    patchOrderDetail(qc, QK.inboundOrders, payload.orderId, {
      id: payload.orderId,
      status: payload.status as InboundOrder['status'],
    });
  }
}

export function patchOutboundCreated(
  qc: QueryClient,
  payload: { listItem?: Record<string, unknown>; orderId?: string; status?: string },
): void {
  if (payload.listItem?.id) {
    const row = asOutboundRow(payload.listItem);
    patchOrderListQueries(qc, QK.outboundOrders, row, 'insert');
    patchOrderDetail(qc, QK.outboundOrders, row.id, row);
  } else if (payload.orderId && payload.status) {
    patchOrderListQueries(
      qc,
      QK.outboundOrders,
      { id: payload.orderId, status: payload.status as OutboundOrder['status'] },
      'update',
    );
    patchOrderDetail(qc, QK.outboundOrders, payload.orderId, {
      id: payload.orderId,
      status: payload.status as OutboundOrder['status'],
    });
  }
}

export function patchOutboundUpdated(
  qc: QueryClient,
  payload: { listItem?: Record<string, unknown>; orderId?: string; status?: string },
): void {
  if (payload.listItem?.id) {
    const row = asOutboundRow(payload.listItem);
    patchOrderListQueries(qc, QK.outboundOrders, row, 'update');
    patchOrderDetail(qc, QK.outboundOrders, row.id, row);
  } else if (payload.orderId && payload.status) {
    patchOrderListQueries(
      qc,
      QK.outboundOrders,
      { id: payload.orderId, status: payload.status as OutboundOrder['status'] },
      'update',
    );
    patchOrderDetail(qc, QK.outboundOrders, payload.orderId, {
      id: payload.orderId,
      status: payload.status as OutboundOrder['status'],
    });
  }
}
