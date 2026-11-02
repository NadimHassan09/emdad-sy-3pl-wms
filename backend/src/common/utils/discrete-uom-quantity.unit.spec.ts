import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertDiscreteUomNonNegativeIntegerDecimal,
  assertDiscreteUomPositiveIntegerDecimal,
  assertDiscreteUomPositiveIntegerQuantity,
  isDiscreteProductUom,
} from './discrete-uom-quantity';

describe('discrete-uom-quantity unit tests (F-06)', () => {
  describe('isDiscreteProductUom', () => {
    it('identifies discrete units correctly', () => {
      expect(isDiscreteProductUom('piece')).toBe(true);
      expect(isDiscreteProductUom('box')).toBe(true);
      expect(isDiscreteProductUom('roll')).toBe(true);
      expect(isDiscreteProductUom('pallet')).toBe(true);
      expect(isDiscreteProductUom('carton')).toBe(true);
    });

    it('identifies continuous units correctly', () => {
      expect(isDiscreteProductUom('kg')).toBe(false);
      expect(isDiscreteProductUom('litre')).toBe(false);
    });
  });

  describe('assertDiscreteUomPositiveIntegerQuantity', () => {
    it('accepts positive integers for discrete units', () => {
      expect(() => assertDiscreteUomPositiveIntegerQuantity('piece', 5, 'Quantity')).not.toThrow();
      expect(() => assertDiscreteUomPositiveIntegerQuantity('box', 1, 'Quantity')).not.toThrow();
      expect(() => assertDiscreteUomPositiveIntegerQuantity('carton', 100, 'Quantity')).not.toThrow();
    });

    it('rejects decimal / fractional quantities for discrete units', () => {
      expect(() => assertDiscreteUomPositiveIntegerQuantity('piece', 1.5, 'Quantity')).toThrow(
        BadRequestException,
      );
      expect(() => assertDiscreteUomPositiveIntegerQuantity('box', 2.01, 'Quantity')).toThrow(
        /must be a whole number/,
      );
      expect(() => assertDiscreteUomPositiveIntegerQuantity('roll', 0.5, 'Quantity')).toThrow(
        /must be a whole number/,
      );
    });

    it('accepts valid fractional quantities up to 4 decimal places for continuous units', () => {
      expect(() => assertDiscreteUomPositiveIntegerQuantity('kg', 2.5, 'Quantity')).not.toThrow();
      expect(() => assertDiscreteUomPositiveIntegerQuantity('kg', 0.1234, 'Quantity')).not.toThrow();
      expect(() => assertDiscreteUomPositiveIntegerQuantity('litre', 1.75, 'Quantity')).not.toThrow();
      expect(() => assertDiscreteUomPositiveIntegerQuantity('litre', 10, 'Quantity')).not.toThrow();
    });

    it('rejects more than 4 decimal places for continuous units', () => {
      expect(() => assertDiscreteUomPositiveIntegerQuantity('kg', 1.12345, 'Quantity')).toThrow(
        /at most 4 decimal places/,
      );
      expect(() => assertDiscreteUomPositiveIntegerQuantity('litre', 0.00001, 'Quantity')).toThrow(
        /at most 4 decimal places/,
      );
    });

    it('rejects non-positive and non-finite quantities for all units', () => {
      expect(() => assertDiscreteUomPositiveIntegerQuantity('piece', 0, 'Quantity')).toThrow(
        /must be a positive number/,
      );
      expect(() => assertDiscreteUomPositiveIntegerQuantity('kg', -1.5, 'Quantity')).toThrow(
        /must be a positive number/,
      );
      expect(() => assertDiscreteUomPositiveIntegerQuantity('kg', 0, 'Quantity')).toThrow(
        /must be a positive number/,
      );
      expect(() => assertDiscreteUomPositiveIntegerQuantity('litre', Number.NaN, 'Quantity')).toThrow(
        /must be a positive number/,
      );
      expect(() =>
        assertDiscreteUomPositiveIntegerQuantity('piece', Number.POSITIVE_INFINITY, 'Quantity'),
      ).toThrow(/must be a positive number/);
    });
  });

  describe('assertDiscreteUomPositiveIntegerDecimal', () => {
    it('accepts whole Decimals for discrete units', () => {
      expect(() =>
        assertDiscreteUomPositiveIntegerDecimal('piece', new Prisma.Decimal(10), 'Quantity'),
      ).not.toThrow();
    });

    it('rejects fractional Decimals for discrete units', () => {
      expect(() =>
        assertDiscreteUomPositiveIntegerDecimal('pallet', new Prisma.Decimal('1.5'), 'Quantity'),
      ).toThrow(/must be a whole number/);
    });

    it('accepts fractional Decimals up to 4 decimal places for continuous units', () => {
      expect(() =>
        assertDiscreteUomPositiveIntegerDecimal('kg', new Prisma.Decimal('3.1415'), 'Quantity'),
      ).not.toThrow();
    });

    it('rejects >4 decimal places for continuous units', () => {
      expect(() =>
        assertDiscreteUomPositiveIntegerDecimal('kg', new Prisma.Decimal('3.14159'), 'Quantity'),
      ).toThrow(/at most 4 decimal places/);
    });

    it('rejects zero or negative Decimals', () => {
      expect(() =>
        assertDiscreteUomPositiveIntegerDecimal('piece', new Prisma.Decimal(0), 'Quantity'),
      ).toThrow(/must be greater than zero/);
      expect(() =>
        assertDiscreteUomPositiveIntegerDecimal('kg', new Prisma.Decimal('-2.5'), 'Quantity'),
      ).toThrow(/must be greater than zero/);
    });
  });

  describe('assertDiscreteUomNonNegativeIntegerDecimal', () => {
    it('allows zero for both discrete and continuous', () => {
      expect(() =>
        assertDiscreteUomNonNegativeIntegerDecimal('piece', new Prisma.Decimal(0), 'Quantity'),
      ).not.toThrow();
      expect(() =>
        assertDiscreteUomNonNegativeIntegerDecimal('kg', new Prisma.Decimal(0), 'Quantity'),
      ).not.toThrow();
    });

    it('rejects negative Decimals', () => {
      expect(() =>
        assertDiscreteUomNonNegativeIntegerDecimal('piece', new Prisma.Decimal(-1), 'Quantity'),
      ).toThrow(/cannot be negative/);
      expect(() =>
        assertDiscreteUomNonNegativeIntegerDecimal('kg', new Prisma.Decimal('-0.5'), 'Quantity'),
      ).toThrow(/cannot be negative/);
    });
  });
});
