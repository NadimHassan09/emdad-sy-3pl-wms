import {
  buildDestinationKey,
  createQuoteFingerprint,
  isQuoteFingerprintFresh,
} from './quote-freshness';

describe('quote-freshness', () => {
  it('accepts matching fresh fingerprint', () => {
    const fp = createQuoteFingerprint({
      providerCode: 'SILA_SY',
      serviceId: 'SILA_SY:cour_1:1',
      currency: 'SYP',
      amount: 150,
      deliveryType: 'hub',
      packageType: 'box',
      weightKg: 1,
      destinationKey: 'addr:damascus|damascus|',
      partsKey: '1',
      ttlMs: 60_000,
    });
    expect(
      isQuoteFingerprintFresh(fp, {
        providerCode: 'SILA_SY',
        serviceId: 'SILA_SY:cour_1:1',
        currency: 'SYP',
        amount: 150,
        deliveryType: 'hub',
        packageType: 'box',
        weightKg: 1,
        destinationKey: 'addr:damascus|damascus|',
        partsKey: '1',
      }),
    ).toBe(true);
  });

  it('rejects expired or mismatched fingerprints', () => {
    const fp = createQuoteFingerprint({
      providerCode: 'BABEL_EXPRESS',
      serviceId: 'BABEL_EXPRESS:address',
      currency: 'USD',
      amount: 2,
      deliveryType: 'address',
      packageType: 'box',
      weightKg: 1,
      destinationKey: buildDestinationKey({ neighbourhoodId: 12 }),
      quotedAt: new Date(Date.now() - 10 * 60 * 1000),
      ttlMs: 1000,
    });
    expect(
      isQuoteFingerprintFresh(fp, {
        providerCode: 'BABEL_EXPRESS',
        serviceId: 'BABEL_EXPRESS:address',
        currency: 'USD',
        amount: 2,
        deliveryType: 'address',
        packageType: 'box',
        weightKg: 1,
        destinationKey: 'hood:12',
      }),
    ).toBe(false);

    const fresh = createQuoteFingerprint({
      providerCode: 'BABEL_EXPRESS',
      serviceId: 'BABEL_EXPRESS:address',
      currency: 'USD',
      amount: 2,
      deliveryType: 'address',
      packageType: 'box',
      weightKg: 1,
      destinationKey: 'hood:12',
    });
    expect(
      isQuoteFingerprintFresh(fresh, {
        providerCode: 'BABEL_EXPRESS',
        serviceId: 'BABEL_EXPRESS:hub',
        currency: 'USD',
        amount: 2,
        deliveryType: 'hub',
        packageType: 'box',
        weightKg: 1,
        destinationKey: 'hood:12',
      }),
    ).toBe(false);
  });
});
