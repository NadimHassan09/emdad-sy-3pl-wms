import {
  aggregateNormalReturnRows,
  resolveProductOnOrderLines,
} from './normal-return-import';

describe('normal-return-import', () => {
  describe('aggregateNormalReturnRows', () => {
    it('sums quantities and keeps contributing original rows', () => {
      const a = {
        orderReference: 'OMS-123',
        productReference: 'SKU-1',
        quantity: 2,
        rowIndex: 0,
      };
      const b = {
        orderReference: 'OMS-123',
        productReference: 'SKU-1',
        quantity: 2,
        rowIndex: 1,
      };
      const agg = aggregateNormalReturnRows([
        {
          omsOrderId: 'ord-1',
          productId: 'prod-1',
          quantity: 2,
          source: a,
        },
        {
          omsOrderId: 'ord-1',
          productId: 'prod-1',
          quantity: 2,
          source: b,
        },
      ]);
      expect(agg).toHaveLength(1);
      expect(agg[0].quantity).toBe(4);
      expect(agg[0].sourceRows).toEqual([a, b]);
    });
  });

  describe('resolveProductOnOrderLines', () => {
    const lines = [
      {
        productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        product: { sku: 'SKU-001' },
      },
      {
        productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        product: { sku: 'SKU-002' },
      },
    ];

    it('matches SKU case-insensitively', () => {
      expect(resolveProductOnOrderLines(lines, 'sku-001')?.productId).toBe(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      );
    });

    it('matches product UUID', () => {
      expect(
        resolveProductOnOrderLines(
          lines,
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        )?.product?.sku,
      ).toBe('SKU-002');
    });

    it('returns null when not on order', () => {
      expect(resolveProductOnOrderLines(lines, 'SKU-999')).toBeNull();
    });
  });
});
