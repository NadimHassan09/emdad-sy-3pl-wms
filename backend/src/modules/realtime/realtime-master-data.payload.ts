/** Minimal list-row payloads for master-data WS events (no table dumps). */

type ProductRow = {
  id: string;
  companyId: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  trackingType: string;
  uom: string;
  expiryTracking: boolean;
  minStockThreshold: unknown;
  status: string;
  createdAt: Date;
  company?: { id: string; name: string } | null;
};

export function productRealtimePayload(product: ProductRow) {
  return {
    id: product.id,
    companyId: product.companyId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    trackingType: product.trackingType,
    uom: product.uom,
    expiryTracking: product.expiryTracking,
    minStockThreshold: Number(product.minStockThreshold ?? 0),
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    company: product.company ?? undefined,
  };
}

export type UserListRealtimePayload = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
  companyId: string | null;
  companyName: string | null;
  kind: 'system' | 'client';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
};

export function userRealtimePayload(row: UserListRealtimePayload): UserListRealtimePayload {
  return row;
}

export function warehouseRealtimePayload(wh: {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: wh.id,
    name: wh.name,
    code: wh.code,
    address: wh.address,
    city: wh.city,
    country: wh.country,
    status: wh.status,
    createdAt: wh.createdAt.toISOString(),
  };
}

export function locationRealtimePayload(loc: {
  id: string;
  warehouseId: string;
  parentId: string | null;
  name: string;
  fullPath: string;
  type: string;
  barcode: string;
  status: string;
  maxWeightKg?: unknown;
  maxCbm?: unknown;
}) {
  return {
    id: loc.id,
    warehouseId: loc.warehouseId,
    parentId: loc.parentId,
    name: loc.name,
    fullPath: loc.fullPath,
    type: loc.type,
    barcode: loc.barcode,
    status: loc.status,
    maxWeightKg: loc.maxWeightKg != null ? String(loc.maxWeightKg) : null,
    maxCbm: loc.maxCbm != null ? String(loc.maxCbm) : null,
  };
}
