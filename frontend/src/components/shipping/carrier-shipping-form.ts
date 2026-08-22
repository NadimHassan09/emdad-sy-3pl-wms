import type { OutboundOrder } from '../../api/outbound';
import type {
  ShippingConfigPayload,
  ShippingDeliveryType,
  ShippingPackageType,
} from '../../api/shipping';

export type ShippingCurrency = 'USD' | 'SYP';

export type PackageGroupValue = {
  productId: string;
  productName: string;
  parts: number;
  weightKgPerPart: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

/** Carrier shipping review form — defaults live in state, not only in the UI. */
export type CarrierShippingFormValue = {
  city: string;
  district: string;
  addressLine1: string;
  addressLine2: string;
  packageType: ShippingPackageType;
  groups: PackageGroupValue[];
  currency: ShippingCurrency;
  deliveryType: ShippingDeliveryType;
  shippingProviderCode: string;
};

export function providerSupportedCurrencies(providerCode: string): ShippingCurrency[] {
  const code = providerCode.trim().toUpperCase();
  if (code === 'BABEL_EXPRESS' || code === 'BABEL') return ['USD', 'SYP'];
  // Unknown / future carriers: treat as USD+SYP until adapters declare otherwise.
  return ['USD', 'SYP'];
}

/** Effective form currency after selecting a carrier (USD default; SYP-only forces SYP). */
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

export function buildPackageGroupsFromOrder(order: OutboundOrder): PackageGroupValue[] {
  return (order.lines ?? [])
    .filter((l) => Number(l.requestedQuantity) > 0)
    .map((l) => {
      const qty = Math.max(0, Math.floor(Number(l.requestedQuantity)) || 0);
      const p = l.product;
      let lengthCm = numStr(p?.lengthCm, '');
      let widthCm = numStr(p?.widthCm, '');
      let heightCm = numStr(p?.heightCm, '');
      // Derive crude dims from volume when L/W/H missing (cube root of cbm → cm).
      if ((!lengthCm || !widthCm || !heightCm) && p?.volumeCbm != null && p.volumeCbm !== '') {
        const cbm = Number(p.volumeCbm);
        if (Number.isFinite(cbm) && cbm > 0) {
          const edge = Math.round(Math.cbrt(cbm * 1_000_000) * 10) / 10;
          if (!lengthCm) lengthCm = String(edge);
          if (!widthCm) widthCm = String(edge);
          if (!heightCm) heightCm = String(edge);
        }
      }
      if (!lengthCm) lengthCm = '10';
      if (!widthCm) widthCm = '10';
      if (!heightCm) heightCm = '10';
      return {
        productId: l.productId,
        productName: p?.name?.trim() || p?.sku || 'Product',
        parts: qty,
        weightKgPerPart: numStr(p?.weightKg, '1'),
        lengthCm,
        widthCm,
        heightCm,
      };
    });
}

export function buildCarrierShippingFormFromOrder(order: OutboundOrder): CarrierShippingFormValue {
  const groups = buildPackageGroupsFromOrder(order);
  const savedPkg = order.shippingPackageType;
  const savedDelivery = order.shippingDeliveryType;
  const savedCurrency = (order.currency ?? 'USD').trim().toUpperCase();

  return {
    city: (order.city ?? '').trim(),
    district: (order.district ?? '').trim(),
    addressLine1: (order.addressLine1 ?? '').trim(),
    addressLine2: (order.addressLine2 ?? '').trim(),
    packageType: savedPkg === 'envelope' ? 'envelope' : 'box',
    groups,
    currency: savedCurrency === 'SYP' ? 'SYP' : 'USD',
    deliveryType: savedDelivery === 'hub' ? 'hub' : 'address',
    shippingProviderCode: (order.shippingProviderCode ?? '').trim(),
  };
}

export function totalParts(groups: PackageGroupValue[]): number {
  return groups.reduce((sum, g) => sum + (Number.isFinite(g.parts) ? g.parts : 0), 0);
}

export function totalWeightKg(groups: PackageGroupValue[]): number {
  let sum = 0;
  for (const g of groups) {
    const w = Number(g.weightKgPerPart);
    const parts = Number(g.parts);
    if (!Number.isFinite(w) || !Number.isFinite(parts) || w < 0 || parts <= 0) continue;
    sum += w * parts;
  }
  return Math.round(sum * 10000) / 10000;
}

/** Volume m³ from L×W×H (cm) × parts, or 0. */
export function totalVolumeCbm(groups: PackageGroupValue[]): number {
  let sum = 0;
  for (const g of groups) {
    const L = Number(g.lengthCm);
    const W = Number(g.widthCm);
    const H = Number(g.heightCm);
    const parts = Number(g.parts);
    if (
      !Number.isFinite(L) ||
      !Number.isFinite(W) ||
      !Number.isFinite(H) ||
      !Number.isFinite(parts) ||
      L < 0 ||
      W < 0 ||
      H < 0 ||
      parts <= 0
    ) {
      continue;
    }
    sum += ((L * W * H) / 1_000_000) * parts;
  }
  return Math.round(sum * 1_000_000) / 1_000_000;
}

export function contentsFromGroups(groups: PackageGroupValue[]): string {
  return groups
    .map((g) => g.productName)
    .filter(Boolean)
    .join(', ');
}

/** Expand groups into Babel-style weight-only parts (one entry per physical unit). */
export function expandWeightParts(groups: PackageGroupValue[]): Array<{ weight: number }> {
  const parts: Array<{ weight: number }> = [];
  for (const g of groups) {
    const w = Number(g.weightKgPerPart);
    const n = Math.floor(Number(g.parts));
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(n) || n <= 0) continue;
    for (let i = 0; i < n; i += 1) parts.push({ weight: w });
  }
  return parts;
}

export type CarrierShippingSavePayload = ShippingConfigPayload & {
  city?: string | null;
  district?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  currency?: string | null;
};

export function carrierFormToSavePayload(
  form: CarrierShippingFormValue,
): CarrierShippingSavePayload {
  const weight = totalWeightKg(form.groups);
  const volume = totalVolumeCbm(form.groups);
  return {
    shippingMethod: 'carrier',
    shippingProviderCode: form.shippingProviderCode.trim() || null,
    shippingPackageType: form.packageType || 'box',
    shippingContents: contentsFromGroups(form.groups) || null,
    shippingDeliveryType: form.deliveryType || 'address',
    shippingPickupType: 'hub',
    shippingPayer: 'sender',
    shippingWeightKg: weight > 0 ? weight : null,
    shippingVolumeCbm: volume >= 0 ? volume : 0,
    city: form.city.trim() || null,
    district: form.district.trim() || null,
    addressLine1: form.addressLine1.trim() || null,
    addressLine2: form.addressLine2.trim() || null,
    currency: form.currency || 'USD',
  };
}
