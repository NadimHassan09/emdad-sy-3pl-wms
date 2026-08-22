import { Prisma } from '@prisma/client';

/**
 * Product volume in cubic metres (CBM) from centimetre dimensions.
 * Volume (CBM) = (L × W × H) / 1_000_000
 *
 * Missing or non-positive dimensions → 0 CBM (never blocks inventory ops).
 */
export function computeProductVolumeCbm(
  lengthCm: number | string | Prisma.Decimal | null | undefined,
  widthCm: number | string | Prisma.Decimal | null | undefined,
  heightCm: number | string | Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  const l = toPositiveNumber(lengthCm);
  const w = toPositiveNumber(widthCm);
  const h = toPositiveNumber(heightCm);
  if (l == null || w == null || h == null) {
    return new Prisma.Decimal(0);
  }
  // Keep up to 6 decimal places to match products.volume_cbm precision.
  return new Prisma.Decimal(l).mul(w).mul(h).div(1_000_000).toDecimalPlaces(6);
}

function toPositiveNumber(
  value: number | string | Prisma.Decimal | null | undefined,
): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value.toString());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Resolve final L/W/H when partially updating a product, then derive CBM. */
export function resolveProductVolumeCbmFromDims(input: {
  lengthCm?: number | string | Prisma.Decimal | null;
  widthCm?: number | string | Prisma.Decimal | null;
  heightCm?: number | string | Prisma.Decimal | null;
  previous?: {
    lengthCm?: Prisma.Decimal | null;
    widthCm?: Prisma.Decimal | null;
    heightCm?: Prisma.Decimal | null;
  };
}): Prisma.Decimal {
  const length =
    input.lengthCm !== undefined ? input.lengthCm : input.previous?.lengthCm ?? null;
  const width =
    input.widthCm !== undefined ? input.widthCm : input.previous?.widthCm ?? null;
  const height =
    input.heightCm !== undefined ? input.heightCm : input.previous?.heightCm ?? null;
  return computeProductVolumeCbm(length, width, height);
}
