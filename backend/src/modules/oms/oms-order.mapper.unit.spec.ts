import { Prisma } from '@prisma/client';

import {
  composeDestinationAddress,
  deriveCodStatus,
  serializeOmsOrder,
} from './oms-order.mapper';

describe('composeDestinationAddress', () => {
  it('prefers legacy destinationAddress when provided', () => {
    expect(
      composeDestinationAddress({
        destinationAddress: 'Legacy block',
        city: 'Damascus',
      }),
    ).toBe('Legacy block');
  });

  it('builds structured address from parts', () => {
    expect(
      composeDestinationAddress({
        addressLine1: 'Street 1',
        district: 'Mazzeh',
        city: 'Damascus',
        addressLine2: 'Floor 2',
      }),
    ).toBe('Street 1, Mazzeh, Damascus, Floor 2');
  });
});

describe('deriveCodStatus', () => {
  it('returns pending for COD orders with amount', () => {
    expect(deriveCodStatus('COD', new Prisma.Decimal('100'))).toBe('pending');
  });

  it('returns null for prepaid orders', () => {
    expect(deriveCodStatus('PREPAID', new Prisma.Decimal('100'))).toBeNull();
  });
});

describe('serializeOmsOrder', () => {
  it('falls back to structured address when destination is empty', () => {
    const order = {
      id: 'o1',
      destinationAddress: 'old',
      addressLine1: 'Line 1',
      city: 'Aleppo',
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('10'),
      shippingFee: null,
      codAmount: null,
      lines: [
        {
          id: 'l1',
          requestedQuantity: new Prisma.Decimal('2'),
          pickedQuantity: new Prisma.Decimal('0'),
          unitPrice: new Prisma.Decimal('5'),
          lineTotal: new Prisma.Decimal('10'),
          discountAmount: null,
        },
      ],
    };

    const serialized = serializeOmsOrder(order as never);
    expect(serialized.destinationAddress).toBe('Line 1, Aleppo');
    expect(serialized.subtotal).toBe('10');
    expect(serialized.lines[0]?.requestedQuantity).toBe('2');
  });
});
