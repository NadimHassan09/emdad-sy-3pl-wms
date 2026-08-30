import type { OutboundOrder } from '../../api/outbound';
import type {
  ShippingConfigPayload,
  ShippingDeliveryType,
  ShippingPackageType,
} from '../../api/shipping';

export type ShippingCurrency = 'USD' | 'SYP';

export type OrderProductCatalog = {
  productId: string;
  productName: string;
  weightKg: number;
  orderedQty: number;
};

export type CartonLineValue = {
  lineId: string;
  productId: string;
  quantity: string;
};

export type ShippingCartonValue = {
  cartonId: string;
  lines: CartonLineValue[];
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

export type StoredShippingCarton = {
  lines: Array<{ productId: string; quantity: number }>;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

/** Carrier shipping review form — defaults live in state, not only in the UI. */
export type CarrierShippingFormValue = {
  city: string;
  district: string;
  addressLine1: string;
  addressLine2: string;
  packageType: ShippingPackageType;
  packageCount: string;
  cartons: ShippingCartonValue[];
  catalog: OrderProductCatalog[];
  currency: ShippingCurrency;
  deliveryType: ShippingDeliveryType;
  shippingProviderCode: string;
};

export function providerSupportedCurrencies(providerCode: string): ShippingCurrency[] {
  const code = providerCode.trim().toUpperCase();
  if (code === 'BABEL_EXPRESS' || code === 'BABEL') return ['USD', 'SYP'];
  return ['USD', 'SYP'];
}

export function currencyAfterCarrierSelect(providerCode: string): ShippingCurrency {
  const supported = providerSupportedCurrencies(providerCode);
  if (supported.length === 1 && supported[0] === 'SYP') return 'SYP';
  return 'USD';
}

function numStr(v: string | number | null | undefined, fallback = '0'): string {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : fallback;
}

export function newLineId(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newCartonId(): string {
  return `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCartonLine(productId = ''): CartonLineValue {
  return { lineId: newLineId(), productId, quantity: '1' };
}

export function emptyCarton(defaultProductId = ''): ShippingCartonValue {
  return {
    cartonId: newCartonId(),
    lines: [emptyCartonLine(defaultProductId)],
    lengthCm: '10',
    widthCm: '10',
    heightCm: '10',
  };
}

export function buildCatalogFromOrder(order: OutboundOrder): OrderProductCatalog[] {
  return (order.lines ?? [])
    .filter((l) => Number(l.requestedQuantity) > 0)
    .map((l) => {
      const orderedQty = Math.max(0, Math.floor(Number(l.requestedQuantity)) || 0);
      const w = Number(l.product?.weightKg);
      return {
        productId: l.productId,
        productName: l.product?.name?.trim() || l.product?.sku || 'Product',
        weightKg: Number.isFinite(w) && w > 0 ? w : 0.1,
        orderedQty,
      };
    });
}

function parseStoredCartons(raw: unknown): StoredShippingCarton[] | null {
  if (!Array.isArray(raw)) return null;
  const out: StoredShippingCarton[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (!Array.isArray(r.lines)) continue;
    const lines: StoredShippingCarton['lines'] = [];
    for (const ln of r.lines) {
      if (!ln || typeof ln !== 'object') continue;
      const l = ln as Record<string, unknown>;
      const productId = typeof l.productId === 'string' ? l.productId : '';
      const quantity = Number(l.quantity);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
      lines.push({ productId, quantity: Math.floor(quantity) });
    }
    const lengthCm = Number(r.lengthCm);
    const widthCm = Number(r.widthCm);
    const heightCm = Number(r.heightCm);
    if (lines.length === 0 || !Number.isFinite(lengthCm) || lengthCm <= 0) continue;
    out.push({
      lines,
      lengthCm,
      widthCm: Number.isFinite(widthCm) && widthCm > 0 ? widthCm : 10,
      heightCm: Number.isFinite(heightCm) && heightCm > 0 ? heightCm : 10,
    });
  }
  return out.length > 0 ? out : null;
}

function cartonsFromStored(stored: StoredShippingCarton[]): ShippingCartonValue[] {
  return stored.map((c) => ({
    cartonId: newCartonId(),
    lines: c.lines.map((ln) => ({
      lineId: newLineId(),
      productId: ln.productId,
      quantity: String(ln.quantity),
    })),
    lengthCm: String(c.lengthCm),
    widthCm: String(c.widthCm),
    heightCm: String(c.heightCm),
  }));
}

/** Default: one carton containing all order lines at full quantity. */
export function buildDefaultCartons(catalog: OrderProductCatalog[]): ShippingCartonValue[] {
  if (catalog.length === 0) return [emptyCarton()];
  return [
    {
      cartonId: newCartonId(),
      lines: catalog.map((p) => ({
        lineId: newLineId(),
        productId: p.productId,
        quantity: String(p.orderedQty),
      })),
      lengthCm: '10',
      widthCm: '10',
      heightCm: '10',
    },
  ];
}

export function buildCarrierShippingFormFromOrder(order: OutboundOrder): CarrierShippingFormValue {
  const catalog = buildCatalogFromOrder(order);
  const stored = parseStoredCartons(order.shippingPackages);
  const cartons = stored ? cartonsFromStored(stored) : buildDefaultCartons(catalog);
  const savedPkg = order.shippingPackageType;
  const savedDelivery = order.shippingDeliveryType;
  const savedCurrency = (order.currency ?? 'USD').trim().toUpperCase();

  return {
    city: (order.city ?? '').trim(),
    district: (order.district ?? '').trim(),
    addressLine1: (order.addressLine1 ?? '').trim(),
    addressLine2: (order.addressLine2 ?? '').trim(),
    packageType: savedPkg === 'envelope' ? 'envelope' : 'box',
    packageCount: String(cartons.length),
    cartons,
    catalog,
    currency: savedCurrency === 'SYP' ? 'SYP' : 'USD',
    deliveryType: savedDelivery === 'hub' ? 'hub' : 'address',
    shippingProviderCode: (order.shippingProviderCode ?? '').trim(),
  };
}

export function resizeCartons(
  cartons: ShippingCartonValue[],
  count: number,
  catalog: OrderProductCatalog[],
): ShippingCartonValue[] {
  const n = Math.max(1, Math.min(50, Math.floor(count) || 1));
  const next = [...cartons];
  while (next.length < n) {
    next.push(emptyCarton(catalog[0]?.productId ?? ''));
  }
  return next.slice(0, n);
}

export function cartonWeightKg(
  carton: ShippingCartonValue,
  catalog: OrderProductCatalog[],
): number {
  const byId = new Map(catalog.map((p) => [p.productId, p.weightKg]));
  let sum = 0;
  for (const line of carton.lines) {
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const unit = byId.get(line.productId) ?? 0.1;
    sum += unit * qty;
  }
  return Math.round(sum * 10000) / 10000;
}

export function totalCartonsWeightKg(
  cartons: ShippingCartonValue[],
  catalog: OrderProductCatalog[],
): number {
  let sum = 0;
  for (const c of cartons) sum += cartonWeightKg(c, catalog);
  return Math.round(sum * 10000) / 10000;
}

export function totalCartonsVolumeCbm(cartons: ShippingCartonValue[]): number {
  let sum = 0;
  for (const c of cartons) {
    const L = Number(c.lengthCm);
    const W = Number(c.widthCm);
    const H = Number(c.heightCm);
    if (!Number.isFinite(L) || !Number.isFinite(W) || !Number.isFinite(H)) continue;
    if (L <= 0 || W <= 0 || H <= 0) continue;
    sum += (L * W * H) / 1_000_000;
  }
  return Math.round(sum * 1_000_000) / 1_000_000;
}

export type PackingSummaryRow = {
  productId: string;
  productName: string;
  ordered: number;
  packed: number;
  remaining: number;
  overPacked: boolean;
};

export function packingSummary(
  cartons: ShippingCartonValue[],
  catalog: OrderProductCatalog[],
): PackingSummaryRow[] {
  const packedByProduct = new Map<string, number>();
  for (const carton of cartons) {
    for (const line of carton.lines) {
      const qty = Math.floor(Number(line.quantity));
      if (!line.productId || !Number.isFinite(qty) || qty <= 0) continue;
      packedByProduct.set(
        line.productId,
        (packedByProduct.get(line.productId) ?? 0) + qty,
      );
    }
  }
  return catalog.map((p) => {
    const packed = packedByProduct.get(p.productId) ?? 0;
    return {
      productId: p.productId,
      productName: p.productName,
      ordered: p.orderedQty,
      packed,
      remaining: Math.max(0, p.orderedQty - packed),
      overPacked: packed > p.orderedQty,
    };
  });
}

export function hasOverPacking(summary: PackingSummaryRow[]): boolean {
  return summary.some((r) => r.overPacked);
}

export function toStoredCartons(cartons: ShippingCartonValue[]): StoredShippingCarton[] {
  return cartons
    .map((c) => {
      const lines = c.lines
        .map((ln) => ({
          productId: ln.productId.trim(),
          quantity: Math.floor(Number(ln.quantity)),
        }))
        .filter((ln) => ln.productId && Number.isFinite(ln.quantity) && ln.quantity > 0);
      const lengthCm = Number(c.lengthCm);
      const widthCm = Number(c.widthCm);
      const heightCm = Number(c.heightCm);
      if (
        lines.length === 0 ||
        !Number.isFinite(lengthCm) ||
        !Number.isFinite(widthCm) ||
        !Number.isFinite(heightCm) ||
        lengthCm <= 0 ||
        widthCm <= 0 ||
        heightCm <= 0
      ) {
        return null;
      }
      return { lines, lengthCm, widthCm, heightCm };
    })
    .filter((c): c is StoredShippingCarton => c != null);
}

export function toBabelPartsFromCartons(
  cartons: ShippingCartonValue[],
  catalog: OrderProductCatalog[],
  packageType: ShippingPackageType,
): Array<{ weight: number }> {
  if (packageType === 'envelope') return [{ weight: 1 }];
  const stored = toStoredCartons(cartons);
  if (stored.length === 0) return [{ weight: 0.1 }];
  return stored.map((_, idx) => ({
    weight: Math.max(0.1, cartonWeightKg(cartons[idx], catalog)),
  }));
}

export function contentsFromCartons(
  cartons: ShippingCartonValue[],
  catalog: OrderProductCatalog[],
): string {
  const names = new Set<string>();
  const byId = new Map(catalog.map((p) => [p.productId, p.productName]));
  for (const c of cartons) {
    for (const ln of c.lines) {
      const name = byId.get(ln.productId);
      if (name) names.add(name);
    }
  }
  return [...names].join(', ');
}

export type CarrierShippingSavePayload = ShippingConfigPayload & {
  city?: string | null;
  district?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  currency?: string | null;
  shippingPackages?: StoredShippingCarton[] | null;
};

export function carrierFormToSavePayload(
  form: CarrierShippingFormValue,
): CarrierShippingSavePayload {
  const stored = toStoredCartons(form.cartons);
  const weight =
    form.packageType === 'envelope'
      ? 1
      : totalCartonsWeightKg(form.cartons, form.catalog);
  const volume = form.packageType === 'envelope' ? 0 : totalCartonsVolumeCbm(form.cartons);
  return {
    shippingMethod: 'carrier',
    shippingProviderCode: form.shippingProviderCode.trim() || null,
    shippingPackageType: form.packageType || 'box',
    shippingContents: contentsFromCartons(form.cartons, form.catalog) || null,
    shippingDeliveryType: form.deliveryType || 'address',
    shippingPickupType: 'hub',
    shippingPayer: 'receiver',
    shippingWeightKg: weight > 0 ? weight : null,
    shippingVolumeCbm: volume >= 0 ? volume : 0,
    shippingPackages: stored.length > 0 ? stored : null,
    city: form.city.trim() || null,
    district: form.district.trim() || null,
    addressLine1: form.addressLine1.trim() || null,
    addressLine2: form.addressLine2.trim() || null,
    currency: form.currency || 'USD',
  };
}

/** @deprecated Use cartons.length — parts = physical cartons for carriers. */
export function totalParts(cartons: ShippingCartonValue[]): number {
  return cartons.length;
}
