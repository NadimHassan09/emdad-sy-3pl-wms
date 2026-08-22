import { ConflictException } from '@nestjs/common';

import {
  assertCompanyBarcodeAvailable,
  barcodeChanged,
  normalizeProductBarcode,
} from './product-barcode.util';

describe('product-barcode.util', () => {
  describe('normalizeProductBarcode', () => {
    it('returns null for empty or whitespace', () => {
      expect(normalizeProductBarcode('')).toBeNull();
      expect(normalizeProductBarcode('   ')).toBeNull();
      expect(normalizeProductBarcode(undefined)).toBeNull();
    });

    it('trims non-empty values', () => {
      expect(normalizeProductBarcode('  BC-1  ')).toBe('BC-1');
    });
  });

  describe('barcodeChanged', () => {
    it('detects change vs unchanged', () => {
      expect(barcodeChanged('BC-1', 'BC-1')).toBe(false);
      expect(barcodeChanged(' BC-1 ', 'BC-1')).toBe(false);
      expect(barcodeChanged('BC-1', 'BC-2')).toBe(true);
      expect(barcodeChanged(null, null)).toBe(false);
    });
  });

  describe('assertCompanyBarcodeAvailable', () => {
    it('passes when no conflicting product exists', async () => {
      const db = {
        product: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      await expect(
        assertCompanyBarcodeAvailable(db, 'company-1', 'BC-NEW'),
      ).resolves.toBeUndefined();
    });

    it('throws ConflictException when another product holds the barcode', async () => {
      const db = {
        product: {
          findFirst: jest.fn().mockResolvedValue({ id: 'other-id' }),
        },
      };
      await expect(
        assertCompanyBarcodeAvailable(db, 'company-1', 'BC-DUP'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('skips check for blank barcode', async () => {
      const db = {
        product: { findFirst: jest.fn() },
      };
      await assertCompanyBarcodeAvailable(db, 'company-1', '   ');
      expect(db.product.findFirst).not.toHaveBeenCalled();
    });
  });
});
