import { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';
import { decideCarrierCostUpdate, extractVerifiedCarrierCost } from './carrier-cost.update';

describe('verified carrier cost extraction', () => {
  it('reads Babel shipping component and ignores quote price and COD', () => {
    expect(
      extractVerifiedCarrierCost(BABEL_EXPRESS_CODE, {
        price: 25000,
        cod_amount: 900,
        details: { shipping: 600, currency: 'SYP' },
      }),
    ).toEqual({ amount: 600, currency: 'SYP' });
    expect(extractVerifiedCarrierCost(BABEL_EXPRESS_CODE, { price: 500, cod: 100 })).toBeNull();
  });

  it('reads Sila and Tarabut delivery_fee and ignores an unrelated price', () => {
    expect(
      extractVerifiedCarrierCost(SILA_SY_CODE, { delivery_fee: 500, currency: 'SYP', price: 3 }),
    ).toEqual({ amount: 500, currency: 'SYP' });
    expect(extractVerifiedCarrierCost(SILA_SY_CODE, { status: 'in_transit' })).toBeNull();
  });
});

describe('carrier cost update decisions', () => {
  const stored = {
    amount: 500,
    currency: 'SYP',
    eventAt: new Date('2026-10-16T10:00:00Z'),
    appliedEventIds: ['evt-500'],
  };

  it('updates 500 SYP to 600 SYP without inventing a client rate', () => {
    const decision = decideCarrierCostUpdate({
      providerCode: SILA_SY_CODE,
      raw: { delivery_fee: 600, currency: 'SYP' },
      externalEventId: 'evt-600',
      eventAt: new Date('2026-10-16T11:00:00Z'),
      stored,
    });
    expect(decision).toMatchObject({
      action: 'applied',
      amount: 600,
      currency: 'SYP',
      previousAmount: 500,
    });
  });

  it('does not apply a duplicate event', () => {
    expect(
      decideCarrierCostUpdate({
        providerCode: SILA_SY_CODE,
        raw: { delivery_fee: 600, currency: 'SYP' },
        externalEventId: 'evt-500',
        eventAt: new Date('2026-10-16T12:00:00Z'),
        stored,
      }).action,
    ).toBe('skipped_duplicate');
  });

  it('does not let an older event overwrite a newer cost', () => {
    expect(
      decideCarrierCostUpdate({
        providerCode: SILA_SY_CODE,
        raw: { delivery_fee: 450, currency: 'SYP' },
        externalEventId: 'evt-old',
        eventAt: new Date('2026-10-16T09:00:00Z'),
        stored,
      }).action,
    ).toBe('skipped_stale');
  });

  it('keeps the carrier cost separate from the client shipping fee', () => {
    const decision = decideCarrierCostUpdate({
      providerCode: SILA_SY_CODE,
      raw: { delivery_fee: 700, currency: 'SYP' },
      externalEventId: 'evt-700',
      eventAt: new Date('2026-10-16T13:00:00Z'),
      stored,
    });
    expect(JSON.stringify(decision)).not.toMatch(/shippingFee/);
    expect(decision.action).toBe('applied');
  });

  it('leaves the stored cost untouched when the payload has no verified cost', () => {
    expect(
      decideCarrierCostUpdate({
        providerCode: BABEL_EXPRESS_CODE,
        raw: { price: 600, type: 'EnRoute' },
        externalEventId: 'evt-no-cost',
        eventAt: new Date('2026-10-16T12:00:00Z'),
        stored,
      }).action,
    ).toBe('ignored_no_cost');
  });
});
