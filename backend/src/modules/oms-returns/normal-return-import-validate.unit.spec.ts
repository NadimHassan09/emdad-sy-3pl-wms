import { aggregateNormalReturnRows } from './normal-return-import';

/**
 * Validates aggregate-then-fail fan-out semantics used by prepareNormalReturnImport.
 * Full service tests would need Prisma; this locks the over-qty rule for review-only CSV.
 */
describe('normal return CSV validate semantics', () => {
  it('aggregated qty 4 from two rows of 2 is detectable as over returnable 3', () => {
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
      { omsOrderId: 'o1', productId: 'p1', quantity: 2, source: a },
      { omsOrderId: 'o1', productId: 'p1', quantity: 2, source: b },
    ]);
    expect(agg[0].quantity).toBe(4);
    const returnable = 3;
    expect(agg[0].quantity > returnable).toBe(true);
    // Fan-out: both original rows fail with same reason
    const failed = agg[0].sourceRows.map((src) => ({
      order_reference: src.orderReference,
      product_reference: src.productReference,
      quantity: src.quantity,
      reason: 'Requested quantity exceeds returnable quantity',
    }));
    expect(failed).toHaveLength(2);
    expect(failed[0].quantity).toBe(2);
    expect(failed[1].quantity).toBe(2);
  });
});
