/** Shared product name / weight cells for admin + client order CSV export. */

export const EXPORT_PRODUCT_SELECT = { name: true, weightKg: true } as const;

type LineProduct = {
  name?: string | null;
  weightKg?: string | number | { toString(): string } | null;
};

type ExportLine = {
  product?: LineProduct | null;
};

function asLines(lines: unknown): ExportLine[] {
  if (!Array.isArray(lines)) return [];
  return lines as ExportLine[];
}

function productName(line: ExportLine): string {
  return String(line.product?.name ?? '').trim();
}

function productWeight(line: ExportLine): string {
  const w = line.product?.weightKg;
  if (w == null || w === '') return '';
  return String(w);
}

/** Join line product names in line order (` | `). */
export function exportProductNames(lines: unknown): string {
  const items = asLines(lines);
  if (items.every((l) => !productName(l))) return '';
  return items.map(productName).join(' | ');
}

/** Join catalog unit weights (kg) in the same order as names (` | `). */
export function exportProductWeights(lines: unknown): string {
  const items = asLines(lines);
  if (items.every((l) => !productWeight(l))) return '';
  return items.map(productWeight).join(' | ');
}
