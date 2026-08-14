import { Prisma } from '@prisma/client';

import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { rateSnapshotToDecimals } from './billing-rate-snapshot.util';

function rates(partial: {
  fixedSubscriptionFee?: string;
  inboundOrderFee?: string;
  outboundOrderFee?: string;
}) {
  return rateSnapshotToDecimals({
    billingPlanId: 'plan-1',
    fixedSubscriptionFee: partial.fixedSubscriptionFee ?? '100.00',
    inboundOrderFee: partial.inboundOrderFee ?? '5.00',
    outboundOrderFee: partial.outboundOrderFee ?? '8.00',
    outboundBaseFee: partial.outboundOrderFee ?? '8.00',
    outboundIncludedItems: 0,
    outboundAdditionalItemFee: '0',
    packagingFee: '0',
    qualityCheckFee: '0',
    excessVolumeFeePerDay: '0',
    excessWeightFeePerDay: '0',
    reservedVolume: '10',
    reservedWeight: '0',
    snapshottedAt: new Date().toISOString(),
  });
}

describe('BillingInvoiceCalculationService.computeSystemLines', () => {
  it('builds subscription + inbound + outbound lines from rates and counts', () => {
    const lines = BillingInvoiceCalculationService.computeSystemLines(rates({}), {
      inboundCount: 3,
      outboundCount: 2,
    });

    expect(lines.map((l) => l.type)).toEqual(['subscription', 'inbound', 'outbound']);

    const sub = lines.find((l) => l.type === 'subscription')!;
    expect(sub.quantity).toBe(new Prisma.Decimal(1).toFixed(4));
    expect(sub.unitPrice).toBe(new Prisma.Decimal('100').toFixed(4));
    expect(sub.totalPrice).toBe('100.00');

    const inbound = lines.find((l) => l.type === 'inbound')!;
    expect(inbound.quantity).toBe(new Prisma.Decimal(3).toFixed(4));
    expect(inbound.unitPrice).toBe(new Prisma.Decimal('5').toFixed(4));
    expect(inbound.totalPrice).toBe('15.00');

    const outbound = lines.find((l) => l.type === 'outbound')!;
    expect(outbound.quantity).toBe(new Prisma.Decimal(2).toFixed(4));
    expect(outbound.unitPrice).toBe(new Prisma.Decimal('8').toFixed(4));
    expect(outbound.totalPrice).toBe('16.00');
  });

  it('keeps zero-qty usage lines so draft totals stay accurate when counts drop', () => {
    const lines = BillingInvoiceCalculationService.computeSystemLines(
      rates({ fixedSubscriptionFee: '50', inboundOrderFee: '10', outboundOrderFee: '12' }),
      { inboundCount: 0, outboundCount: 0 },
    );

    const inbound = lines.find((l) => l.type === 'inbound')!;
    const outbound = lines.find((l) => l.type === 'outbound')!;
    expect(inbound.quantity).toBe(new Prisma.Decimal(0).toFixed(4));
    expect(inbound.totalPrice).toBe('0.00');
    expect(outbound.quantity).toBe(new Prisma.Decimal(0).toFixed(4));
    expect(outbound.totalPrice).toBe('0.00');
  });

  it('uses simple outboundOrderFee (not tiered item math)', () => {
    const lines = BillingInvoiceCalculationService.computeSystemLines(
      rates({ outboundOrderFee: '3.50' }),
      { inboundCount: 0, outboundCount: 4 },
    );
    const outbound = lines.find((l) => l.type === 'outbound')!;
    expect(outbound.unitPrice).toBe(new Prisma.Decimal('3.5').toFixed(4));
    expect(outbound.totalPrice).toBe('14.00');
  });
});
