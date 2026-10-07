import type { QueryClient } from '@tanstack/react-query';

import type { ClientProductRow } from '../services/clientProductsService';

type ProductsPage = {
  items: ClientProductRow[];
  total: number;
  limit?: number;
  offset?: number;
};

export function patchClientProductCreated(qc: QueryClient, product: ClientProductRow): void {
  qc.setQueriesData<ProductsPage>({ queryKey: ['client', 'products'] }, (prev) => {
    if (!prev?.items) return prev;
    if (prev.items.some((p) => p.id === product.id)) return prev;
    return { ...prev, items: [product, ...prev.items], total: prev.total + 1 };
  });
}

export function patchClientProductUpdated(qc: QueryClient, product: ClientProductRow): void {
  qc.setQueriesData<ProductsPage>({ queryKey: ['client', 'products'] }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((p) => p.id === product.id);
    if (idx < 0) {
      return { ...prev, items: [product, ...prev.items], total: prev.total + 1 };
    }
    const next = [...prev.items];
    next[idx] = { ...next[idx], ...product };
    return { ...prev, items: next };
  });
}

export function patchClientProductArchived(qc: QueryClient, productId: string): void {
  qc.setQueriesData<ProductsPage>({ queryKey: ['client', 'products'] }, (prev) => {
    if (!prev?.items) return prev;
    return {
      ...prev,
      items: prev.items.filter((p) => p.id !== productId),
      total: Math.max(0, prev.total - 1),
    };
  });
}
