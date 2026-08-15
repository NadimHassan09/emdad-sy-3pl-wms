import { Prisma } from '@prisma/client';

import {
  appendOmsOrderFieldFilters,
  parseOmsTotalFilterValue,
} from './oms-orders-list-filters.util';

describe('parseOmsTotalFilterValue', () => {
  it('accepts non-negative decimals', () => {
    expect(parseOmsTotalFilterValue('10')?.toString()).toBe('10');
    expect(parseOmsTotalFilterValue('10.50')?.toString()).toBe('10.5');
  });

  it('rejects empty, negative, and non-numeric values', () => {
    expect(parseOmsTotalFilterValue('')).toBeNull();
    expect(parseOmsTotalFilterValue('  ')).toBeNull();
    expect(parseOmsTotalFilterValue('-1')).toBeNull();
    expect(parseOmsTotalFilterValue('abc')).toBeNull();
    expect(parseOmsTotalFilterValue(undefined)).toBeNull();
  });
});

describe('appendOmsOrderFieldFilters', () => {
  function run(query: Parameters<typeof appendOmsOrderFieldFilters>[0]) {
    const where: Prisma.OmsOrderWhereInput = {};
    const andParts: Prisma.OmsOrderWhereInput[] = [];
    appendOmsOrderFieldFilters(query, where, andParts);
    return { where, andParts };
  }

  it('keeps quick orderSearch as OR across identifier fields', () => {
    const { andParts } = run({ orderSearch: 'OMS-1' });
    expect(andParts).toHaveLength(1);
    expect(andParts[0].OR).toEqual(
      expect.arrayContaining([
        { orderNumber: { contains: 'OMS-1', mode: 'insensitive' } },
        { recipientName: { contains: 'OMS-1', mode: 'insensitive' } },
        { recipientPhone: { contains: 'OMS-1', mode: 'insensitive' } },
      ]),
    );
  });

  it('filters orderId, customer, phone, and city with AND semantics', () => {
    const { andParts } = run({
      orderId: 'OMS-2026',
      customer: 'ahm',
      phone: '09',
      city: 'Alex',
    });
    expect(andParts).toHaveLength(4);
    expect(andParts).toEqual(
      expect.arrayContaining([
        {
          OR: expect.arrayContaining([
            { orderNumber: { contains: 'OMS-2026', mode: 'insensitive' } },
          ]),
        },
        { recipientName: { contains: 'ahm', mode: 'insensitive' } },
        { recipientPhone: { contains: '09', mode: 'insensitive' } },
        { city: { contains: 'Alex', mode: 'insensitive' } },
      ]),
    );
  });

  it('applies total operator against stored subtotal', () => {
    const { where } = run({ totalOp: 'gte', totalValue: '100' });
    expect(where.subtotal).toEqual({ gte: expect.any(Prisma.Decimal) });
    expect((where.subtotal as { gte: Prisma.Decimal }).gte.toString()).toBe('100');
  });

  it('ignores total filter when value is invalid', () => {
    const { where } = run({ totalOp: 'eq', totalValue: 'nope' });
    expect(where.subtotal).toBeUndefined();
  });

  it('combines quick search with advanced fields', () => {
    const { andParts, where } = run({
      orderSearch: 'x',
      customer: 'Ahmed',
      totalOp: 'lt',
      totalValue: '50',
    });
    expect(andParts.length).toBe(2);
    expect(where.subtotal).toEqual({ lt: expect.any(Prisma.Decimal) });
  });
});
