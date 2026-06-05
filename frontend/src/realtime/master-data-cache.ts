import type { QueryClient } from '@tanstack/react-query';

import type { Product } from '../api/products';
import type { UserListRow } from '../api/users';
import type { Warehouse } from '../api/warehouses';
import type { Location } from '../api/locations';
import { QK } from '../constants/query-keys';

type ProductListCache = { items?: Product[]; total: number };

export function patchProductCreated(qc: QueryClient, product: Product): void {
  qc.setQueriesData<ProductListCache>({ queryKey: QK.products }, (prev) => {
    if (!prev?.items) return prev;
    if (prev.items.some((p) => p.id === product.id)) return prev;
    return { ...prev, items: [product, ...prev.items], total: prev.total + 1 };
  });
}

export function patchProductUpdated(qc: QueryClient, product: Product): void {
  qc.setQueriesData<ProductListCache>({ queryKey: QK.products }, (prev) => {
    if (!prev?.items) return prev;
    return {
      ...prev,
      items: prev.items.map((p) =>
        p.id === product.id ? { ...product, company: product.company ?? p.company } : p,
      ),
    };
  });
  qc.setQueryData([...QK.products, product.id], product);
}

export function patchProductArchived(qc: QueryClient, productId: string): void {
  qc.setQueriesData<ProductListCache>({ queryKey: QK.products }, (prev) => {
    if (!prev?.items) return prev;
    const next = prev.items.filter((p) => p.id !== productId);
    if (next.length === prev.items.length) return prev;
    return { ...prev, items: next, total: Math.max(0, prev.total - 1) };
  });
}

/** Hard delete — same list removal semantics as archive. */
export function patchProductDeleted(qc: QueryClient, productId: string): void {
  patchProductArchived(qc, productId);
  qc.removeQueries({ queryKey: [...QK.products, productId] });
}

export function patchUserCreated(qc: QueryClient, user: UserListRow): void {
  qc.setQueryData<UserListRow[]>(QK.users, (prev) => {
    if (!prev) return prev;
    if (prev.some((u) => u.id === user.id)) return prev;
    return [user, ...prev].sort((a, b) => a.email.localeCompare(b.email));
  });
  qc.setQueryData([...QK.users, user.id], user);
}

export function patchUserUpdated(qc: QueryClient, user: UserListRow): void {
  qc.setQueryData<UserListRow[]>(QK.users, (prev) => {
    if (!prev) return prev;
    const idx = prev.findIndex((u) => u.id === user.id);
    if (idx < 0) return [user, ...prev].sort((a, b) => a.email.localeCompare(b.email));
    const next = [...prev];
    next[idx] = user;
    return next.sort((a, b) => a.email.localeCompare(b.email));
  });
  qc.setQueryData([...QK.users, user.id], user);
}

export function patchUserDeleted(qc: QueryClient, userId: string): void {
  qc.setQueryData<UserListRow[]>(QK.users, (prev) => {
    if (!prev) return prev;
    return prev.filter((u) => u.id !== userId);
  });
  qc.removeQueries({ queryKey: [...QK.users, userId] });
}

export function patchWarehouseCreated(qc: QueryClient, warehouse: Warehouse): void {
  qc.setQueriesData<Warehouse[]>({ queryKey: QK.warehouses }, (prev) => {
    if (!prev) return prev;
    if (prev.some((w) => w.id === warehouse.id)) return prev;
    return [...prev, warehouse].sort((a, b) => a.code.localeCompare(b.code));
  });
}

export function patchWarehouseUpdated(qc: QueryClient, warehouse: Warehouse): void {
  qc.setQueriesData<Warehouse[]>({ queryKey: QK.warehouses }, (prev) => {
    if (!prev) return prev;
    const idx = prev.findIndex((w) => w.id === warehouse.id);
    if (idx < 0) return [...prev, warehouse].sort((a, b) => a.code.localeCompare(b.code));
    const next = [...prev];
    next[idx] = warehouse;
    return next.sort((a, b) => a.code.localeCompare(b.code));
  });
}

export function patchLocationCreated(qc: QueryClient, _location: Location): void {
  qc.invalidateQueries({ queryKey: QK.locations.all });
  qc.invalidateQueries({ queryKey: ['locations', 'lookup'] });
}

export function patchLocationUpdated(qc: QueryClient, _location: Location): void {
  qc.invalidateQueries({ queryKey: QK.locations.all });
  qc.invalidateQueries({ queryKey: ['locations', 'lookup'] });
}

export function patchLocationArchived(
  qc: QueryClient,
  _warehouseId: string,
  _locationId: string,
): void {
  qc.invalidateQueries({ queryKey: QK.locations.all });
  qc.invalidateQueries({ queryKey: ['locations', 'lookup'] });
}
