import type { QueryClient } from '@tanstack/react-query';

import type { LedgerRow, ProductStockSummaryRow } from '../api/inventory';
import type { PageResult } from '../api/client';
import { QK } from '../constants/query-keys';

type StockRowPayload = {
  productId: string;
  productName?: string;
  sku?: string;
  totalQuantity?: string;
  uom?: string;
  expiryDate?: string | null;
};

type ProductSummaryPayload = {
  productId: string;
  totalQuantity: string;
  product?: { id: string; sku: string; name: string; uom: string; barcode: string | null };
  client?: { id: string; name: string };
};

type InventoryPayload = {
  productId?: string;
  stockRow?: StockRowPayload;
  productSummary?: ProductSummaryPayload;
  ledgerEntry?: LedgerRow;
};

function toSummaryRow(raw: ProductSummaryPayload): ProductStockSummaryRow {
  return {
    productId: raw.productId,
    totalQuantity: raw.totalQuantity,
    product: raw.product ?? {
      id: raw.productId,
      sku: '',
      name: '',
      uom: '',
      barcode: null,
    },
    client: raw.client ?? { id: '', name: '' },
  };
}

export function patchInventoryChanged(qc: QueryClient, payload: InventoryPayload): void {
  const summary =
    payload.productSummary ??
    (payload.stockRow?.productId && payload.stockRow.totalQuantity
      ? {
          productId: payload.stockRow.productId,
          totalQuantity: payload.stockRow.totalQuantity,
          product: {
            id: payload.stockRow.productId,
            sku: payload.stockRow.sku ?? '',
            name: payload.stockRow.productName ?? '',
            uom: payload.stockRow.uom ?? '',
            barcode: null,
          },
          client: { id: '', name: '' },
        }
      : null);

  if (summary) {
    const row = toSummaryRow(summary);
    qc.setQueriesData<PageResult<ProductStockSummaryRow>>(
      { queryKey: QK.inventoryStockByProduct },
      (prev) => {
        if (!prev?.items) return prev;
        const idx = prev.items.findIndex((i) => i.productId === row.productId);
        if (idx < 0) {
          return { ...prev, items: [row, ...prev.items], total: prev.total + 1 };
        }
        const next = [...prev.items];
        next[idx] = { ...next[idx], ...row };
        return { ...prev, items: next };
      },
    );
  }

  if (payload.ledgerEntry) {
    qc.setQueriesData<PageResult<LedgerRow>>({ queryKey: QK.ledger }, (prev) => {
      if (!prev?.items) return prev;
      if (prev.items.some((r) => r.id === payload.ledgerEntry!.id)) return prev;
      return {
        ...prev,
        items: [payload.ledgerEntry!, ...prev.items],
        total: prev.total + 1,
      };
    });
  }
}
