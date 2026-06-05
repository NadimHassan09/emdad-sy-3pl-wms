import type { QueryClient } from '@tanstack/react-query';

import type { ClientStockRow } from '../services/stockService';

type StockPage = { items: ClientStockRow[]; total: number; limit?: number; offset?: number };

type ProductsPage = {
  items: Array<{ id: string; totalOnHand?: string }>;
  total: number;
};

export function patchClientStockRow(qc: QueryClient, stockRow: ClientStockRow): void {
  qc.setQueriesData<StockPage>({ queryKey: ['client', 'stock'] }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((row) => row.productId === stockRow.productId);
    if (idx < 0) {
      return {
        ...prev,
        items: [stockRow, ...prev.items],
        total: prev.total + 1,
      };
    }
    const next = [...prev.items];
    next[idx] = { ...next[idx], ...stockRow };
    return { ...prev, items: next };
  });

  qc.setQueriesData<ProductsPage>({ queryKey: ['client', 'products'] }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((p) => p.id === stockRow.productId);
    if (idx < 0) return prev;
    const next = [...prev.items];
    next[idx] = { ...next[idx], totalOnHand: stockRow.totalQuantity };
    return { ...prev, items: next };
  });
}
