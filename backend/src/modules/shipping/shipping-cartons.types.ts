/** One product line inside a physical shipping carton. */
export type ShippingCartonLine = {
  productId: string;
  quantity: number;
};

/** Carton / package handed to the carrier (weight from catalog × qty; dims manual). */
export type ShippingCarton = {
  lines: ShippingCartonLine[];
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export function parseShippingCartons(raw: unknown): ShippingCarton[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ShippingCarton[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const linesRaw = r.lines;
    if (!Array.isArray(linesRaw)) continue;
    const lines: ShippingCartonLine[] = [];
    for (const ln of linesRaw) {
      if (!ln || typeof ln !== 'object') continue;
      const l = ln as Record<string, unknown>;
      const productId = typeof l.productId === 'string' ? l.productId.trim() : '';
      const quantity = Number(l.quantity);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
      lines.push({ productId, quantity: Math.floor(quantity) });
    }
    const lengthCm = Number(r.lengthCm);
    const widthCm = Number(r.widthCm);
    const heightCm = Number(r.heightCm);
    if (
      lines.length === 0 ||
      !Number.isFinite(lengthCm) ||
      !Number.isFinite(widthCm) ||
      !Number.isFinite(heightCm) ||
      lengthCm <= 0 ||
      widthCm <= 0 ||
      heightCm <= 0
    ) {
      continue;
    }
    out.push({
      lines,
      lengthCm,
      widthCm,
      heightCm,
    });
  }
  return out.length > 0 ? out : null;
}
