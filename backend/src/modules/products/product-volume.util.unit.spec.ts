import { Prisma } from '@prisma/client';

import {
  computeProductVolumeCbm,
  resolveProductVolumeCbmFromDims,
} from './product-volume.util';

describe('product-volume.util', () => {
  it('computes CBM from complete centimetre dimensions', () => {
    // 100 × 50 × 40 cm = 200_000 cm³ = 0.2 m³
    expect(Number(computeProductVolumeCbm(100, 50, 40))).toBeCloseTo(0.2, 6);
  });

  it('returns 0 CBM when any dimension is missing or non-positive', () => {
    expect(computeProductVolumeCbm(null, 50, 40).equals(0)).toBe(true);
    expect(computeProductVolumeCbm(100, undefined, 40).equals(0)).toBe(true);
    expect(computeProductVolumeCbm(100, 50, 0).equals(0)).toBe(true);
    expect(computeProductVolumeCbm(-1, 50, 40).equals(0)).toBe(true);
  });

  it('recomputes CBM on partial dimension updates using previous values', () => {
    const previous = {
      lengthCm: new Prisma.Decimal(100),
      widthCm: new Prisma.Decimal(50),
      heightCm: new Prisma.Decimal(40),
    };
    expect(
      Number(resolveProductVolumeCbmFromDims({ heightCm: 20, previous })),
    ).toBeCloseTo(0.1, 6);
    expect(
      resolveProductVolumeCbmFromDims({ lengthCm: null, previous }).equals(0),
    ).toBe(true);
  });
});
