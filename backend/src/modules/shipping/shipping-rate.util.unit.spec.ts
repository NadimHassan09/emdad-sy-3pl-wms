import { annotateRateQuotes, type ShippingRateQuote } from './shipping-rate.util';

describe('annotateRateQuotes', () => {
  it('marks the lowest price as cheapest and recommended', () => {
    const out = annotateRateQuotes([
      {
        carrierId: 'A',
        carrierName: 'A',
        serviceId: 'std',
        serviceName: 'Standard',
        available: true,
        price: 10,
        currency: 'USD',
      },
      {
        carrierId: 'B',
        carrierName: 'B',
        serviceId: 'std',
        serviceName: 'Standard',
        available: true,
        price: 8,
        currency: 'USD',
      },
    ]);
    expect(out.find((q) => q.carrierId === 'B')?.isCheapest).toBe(true);
    expect(out.find((q) => q.carrierId === 'B')?.isRecommended).toBe(true);
    expect(out.find((q) => q.carrierId === 'A')?.isCheapest).toBe(false);
  });

  it('marks fastest only when ETA is present', () => {
    const out = annotateRateQuotes([
      {
        carrierId: 'A',
        carrierName: 'A',
        serviceId: 'std',
        serviceName: 'Standard',
        available: true,
        price: 10,
        currency: 'USD',
        estimatedDeliveryMax: 3,
      },
      {
        carrierId: 'B',
        carrierName: 'B',
        serviceId: 'exp',
        serviceName: 'Express',
        available: true,
        price: 12,
        currency: 'USD',
        estimatedDeliveryMax: 1,
      },
    ]);
    expect(out.find((q) => q.carrierId === 'B')?.isFastest).toBe(true);
    expect(out.find((q) => q.carrierId === 'A')?.isFastest).toBe(false);
  });

  it('does not invent fastest when no carrier returned an ETA', () => {
    const out = annotateRateQuotes([
      {
        carrierId: 'A',
        carrierName: 'A',
        serviceId: 'std',
        serviceName: 'Standard',
        available: true,
        price: 5,
        currency: 'USD',
      } satisfies ShippingRateQuote,
    ]);
    expect(out[0].isFastest).toBe(false);
    expect(out[0].isCheapest).toBe(true);
  });
});
