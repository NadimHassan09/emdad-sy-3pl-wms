import { ConflictException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';

/**
 * Product statuses that reserve a barcode within a company.
 * Archived products are excluded so their barcodes may be reused on new catalog rows.
 */
export const BARCODE_BLOCKING_STATUSES: ProductStatus[] = ['active', 'suspended'];

export function normalizeProductBarcode(raw?: string | null): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function barcodeChanged(
  current: string | null | undefined,
  next: string | null,
): boolean {
  return normalizeProductBarcode(current) !== next;
}

export type BarcodeLookupDb = {
  product: {
    findFirst: (args: {
      where: Prisma.ProductWhereInput;
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

export async function assertCompanyBarcodeAvailable(
  db: BarcodeLookupDb,
  companyId: string,
  barcode: string,
  excludeProductId?: string,
): Promise<void> {
  const normalized = normalizeProductBarcode(barcode);
  if (!normalized) return;

  const where: Prisma.ProductWhereInput = {
    companyId,
    barcode: normalized,
    status: { in: BARCODE_BLOCKING_STATUSES },
  };
  if (excludeProductId) {
    where.NOT = { id: excludeProductId };
  }

  const existing = await db.product.findFirst({
    where,
    select: { id: true },
  });
  if (existing) {
    throw new ConflictException(
      'Barcode already in use for an active product in this company.',
    );
  }
}
