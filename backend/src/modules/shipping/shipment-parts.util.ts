import type { ShippingCarton } from './shipping-cartons.types';

/**
 * Build Babel createShipment / calculatePrice `parts` from physical order units.
 * Babel OpenAPI ShipmentPart is weight-only; L/W/H are for WMS UI/display only.
 */
export type PhysicalShipmentPart = {
  productId: string;
  productName: string;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

export type OrderLineForParts = {
  productId: string;
  productName: string;
  quantity: number;
  weightKg: number | null | undefined;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

export function buildPhysicalShipmentParts(lines: OrderLineForParts[]): PhysicalShipmentPart[] {
  const parts: PhysicalShipmentPart[] = [];
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(Number(line.quantity)));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const weight = Number(line.weightKg);
    const unitWeight = Number.isFinite(weight) && weight > 0 ? weight : 0.1;
    for (let i = 0; i < qty; i++) {
      parts.push({
        productId: line.productId,
        productName: line.productName,
        weightKg: unitWeight,
        lengthCm: line.lengthCm ?? null,
        widthCm: line.widthCm ?? null,
        heightCm: line.heightCm ?? null,
      });
    }
  }
  return parts;
}

/** Babel API parts: one entry per physical unit (weight kg). Envelope must be a single part of weight 1. */
export function toBabelWeightParts(
  parts: PhysicalShipmentPart[],
  packageType: 'box' | 'envelope',
): Array<{ weight: number }> {
  if (packageType === 'envelope') {
    return [{ weight: 1 }];
  }
  if (parts.length === 0) {
    return [{ weight: 0.1 }];
  }
  return parts.map((p) => ({
    weight: Math.max(0.1, Number(p.weightKg) || 0.1),
  }));
}

export function totalWeightKg(parts: PhysicalShipmentPart[]): number {
  return parts.reduce((sum, p) => sum + (Number(p.weightKg) || 0), 0);
}

export function cartonWeightKg(
  carton: ShippingCarton,
  weightByProductId: Map<string, number>,
): number {
  let sum = 0;
  for (const line of carton.lines) {
    const unit = weightByProductId.get(line.productId) ?? 0.1;
    const qty = Math.max(0, Math.floor(Number(line.quantity)) || 0);
    if (qty <= 0) continue;
    sum += unit * qty;
  }
  return Math.round(sum * 10000) / 10000;
}

export function totalCartonsWeightKg(
  cartons: ShippingCarton[],
  weightByProductId: Map<string, number>,
): number {
  let sum = 0;
  for (const c of cartons) sum += cartonWeightKg(c, weightByProductId);
  return Math.round(sum * 10000) / 10000;
}

export function totalCartonsVolumeCbm(cartons: ShippingCarton[]): number {
  let sum = 0;
  for (const c of cartons) {
    sum += (c.lengthCm * c.widthCm * c.heightCm) / 1_000_000;
  }
  return Math.round(sum * 1_000_000) / 1_000_000;
}

/** One Babel part per carton (weight kg). */
export function babelPartsFromCartons(
  cartons: ShippingCarton[],
  weightByProductId: Map<string, number>,
  packageType: 'box' | 'envelope',
): Array<{ weight: number }> {
  if (packageType === 'envelope') return [{ weight: 1 }];
  if (cartons.length === 0) return [{ weight: 0.1 }];
  return cartons.map((c) => ({
    weight: Math.max(0.1, cartonWeightKg(c, weightByProductId)),
  }));
}
