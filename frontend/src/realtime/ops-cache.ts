import type { QueryClient } from '@tanstack/react-query';

import type { StockAdjustment } from '../api/adjustments';
import type { CycleCountDetail, CycleCountListItem } from '../api/cycle-count';
import type { ReturnOrder, ReturnOrderListItem } from '../api/returns';
import { QK } from '../constants/query-keys';

type ReturnListCache = { items?: ReturnOrderListItem[]; total: number };

function patchReturnLists(
  qc: QueryClient,
  listItem: ReturnOrderListItem,
  mode: 'insert' | 'update',
): void {
  qc.setQueriesData<ReturnListCache>({ queryKey: QK.returns.all }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((r) => r.id === listItem.id);
    if (mode === 'insert') {
      if (idx >= 0) {
        const next = [...prev.items];
        next[idx] = { ...listItem, summary: listItem.summary ?? next[idx].summary };
        return { ...prev, items: next };
      }
      return { ...prev, items: [listItem, ...prev.items], total: prev.total + 1 };
    }
    if (idx < 0) {
      return { ...prev, items: [listItem, ...prev.items], total: prev.total + 1 };
    }
    const next = [...prev.items];
    next[idx] = { ...next[idx], ...listItem };
    return { ...prev, items: next };
  });
}

function patchReturnDetail(qc: QueryClient, detail: ReturnOrder): void {
  qc.setQueryData(QK.returns.detail(detail.id), detail);
}

export function patchReturnCreated(
  qc: QueryClient,
  payload: { listItem?: ReturnOrderListItem; return?: ReturnOrder },
): void {
  if (payload.listItem) patchReturnLists(qc, payload.listItem, 'insert');
  if (payload.return) patchReturnDetail(qc, payload.return);
}

export function patchReturnUpdated(
  qc: QueryClient,
  payload: { listItem?: ReturnOrderListItem; return?: ReturnOrder },
): void {
  if (payload.listItem) patchReturnLists(qc, payload.listItem, 'update');
  if (payload.return) patchReturnDetail(qc, payload.return);
}

export function patchReturnConfirmed(
  qc: QueryClient,
  payload: { listItem?: ReturnOrderListItem; return?: ReturnOrder },
): void {
  patchReturnUpdated(qc, payload);
}

export function patchReturnCompleted(
  qc: QueryClient,
  payload: { listItem?: ReturnOrderListItem; return?: ReturnOrder },
): void {
  patchReturnUpdated(qc, payload);
}

type CycleCountListCache = { items?: CycleCountListItem[]; total: number };

function patchCycleCountLists(
  qc: QueryClient,
  listItem: CycleCountListItem,
  mode: 'insert' | 'update',
): void {
  qc.setQueriesData<CycleCountListCache>({ queryKey: QK.cycleCount.all }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((c) => c.id === listItem.id);
    if (mode === 'insert') {
      if (idx >= 0) {
        const next = [...prev.items];
        next[idx] = { ...next[idx], ...listItem };
        return { ...prev, items: next };
      }
      return { ...prev, items: [listItem, ...prev.items], total: prev.total + 1 };
    }
    if (idx < 0) {
      return { ...prev, items: [listItem, ...prev.items], total: prev.total + 1 };
    }
    const next = [...prev.items];
    next[idx] = { ...next[idx], ...listItem };
    return { ...prev, items: next };
  });
}

function patchCycleCountDetail(qc: QueryClient, detail: CycleCountDetail): void {
  qc.setQueryData(QK.cycleCount.detail(detail.id), detail);
}

export function patchCycleCountCreated(
  qc: QueryClient,
  payload: { listItem?: CycleCountListItem; count?: CycleCountDetail },
): void {
  if (payload.listItem) patchCycleCountLists(qc, payload.listItem, 'insert');
  if (payload.count) patchCycleCountDetail(qc, payload.count);
}

export function patchCycleCountUpdated(
  qc: QueryClient,
  payload: { listItem?: CycleCountListItem; count?: CycleCountDetail },
): void {
  if (payload.listItem) patchCycleCountLists(qc, payload.listItem, 'update');
  if (payload.count) patchCycleCountDetail(qc, payload.count);
}

export function patchCycleCountCompleted(
  qc: QueryClient,
  payload: { listItem?: CycleCountListItem; count?: CycleCountDetail },
): void {
  patchCycleCountUpdated(qc, payload);
}

type AdjustmentListCache = { items?: StockAdjustment[]; total: number };

export function patchAdjustmentCreated(qc: QueryClient, adjustment: StockAdjustment): void {
  qc.setQueriesData<AdjustmentListCache>({ queryKey: QK.adjustments }, (prev) => {
    if (!prev?.items) return prev;
    if (prev.items.some((a) => a.id === adjustment.id)) return prev;
    return { ...prev, items: [adjustment, ...prev.items], total: prev.total + 1 };
  });
}

export function patchAdjustmentApproved(qc: QueryClient, adjustment: StockAdjustment): void {
  qc.setQueriesData<AdjustmentListCache>({ queryKey: QK.adjustments }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((a) => a.id === adjustment.id);
    if (idx < 0) {
      return { ...prev, items: [adjustment, ...prev.items], total: prev.total + 1 };
    }
    const next = [...prev.items];
    next[idx] = adjustment;
    return { ...prev, items: next };
  });
  qc.setQueryData([...QK.adjustments, adjustment.id], adjustment);
}

export type TransferRealtimePayload = {
  referenceId: string;
  companyId: string;
  warehouseId: string;
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  lotId: string | null;
  quantity: string;
  status: 'pending' | 'completed';
  ledger?: Record<string, unknown>;
};

/** Prepend completed transfer ledger row to internal-transfer history (no full refetch). */
export function patchTransferCompleted(qc: QueryClient, transfer: TransferRealtimePayload): void {
  if (!transfer.ledger) return;
  const warehouseId = transfer.warehouseId;
  qc.setQueriesData<unknown[]>(
    { queryKey: [...QK.ledger, 'internal-transfers', warehouseId] },
    (prev) => {
      if (!Array.isArray(prev)) return prev;
      const ledger = transfer.ledger as { id?: string };
      if (ledger.id && prev.some((row) => (row as { id?: string }).id === ledger.id)) {
        return prev;
      }
      return [transfer.ledger, ...prev];
    },
  );
}

export function patchTransferCreated(_qc: QueryClient, _transfer: TransferRealtimePayload): void {
  // Atomic transfer — list UI updates on transfer.completed only.
}
