import {
  isBabelAddressDeliveryAvailable,
  isBabelCalculatePriceShippable,
} from './babel-quote.util';

describe('isBabelCalculatePriceShippable', () => {
  it('marks address with dropoff null as unshippable even if price is present', () => {
    expect(
      isBabelCalculatePriceShippable(
        {
          status: 'success',
          price: 0,
          details: { pickup: 0, dropoff: null, shipping: 0 },
        },
        'address',
      ),
    ).toBe(false);
  });

  it('marks hub zeroed fee breakdown (price 0 + shipping 0) as unshippable', () => {
    expect(
      isBabelCalculatePriceShippable(
        {
          status: 'success',
          price: 0,
          currency: 'SYP',
          details: { pickup: 0, dropoff: 0, shipping: 0 },
        },
        'hub',
      ),
    ).toBe(false);
  });

  it('allows positive hub shipping price', () => {
    expect(
      isBabelCalculatePriceShippable(
        {
          status: 'success',
          price: 10000,
          details: { pickup: 0, dropoff: 0, shipping: 10000 },
        },
        'hub',
      ),
    ).toBe(true);
  });

  it('allows address with dropoff fee and positive price', () => {
    expect(
      isBabelCalculatePriceShippable(
        {
          status: 'success',
          price: 25000,
          details: { pickup: 0, dropoff: 15000, shipping: 10000 },
        },
        'address',
      ),
    ).toBe(true);
  });

  it('does not treat price 0 alone as unshippable when shipping > 0 (possible free promo)', () => {
    expect(
      isBabelCalculatePriceShippable(
        {
          status: 'success',
          price: 0,
          details: { pickup: 0, dropoff: 0, shipping: 500 },
        },
        'hub',
      ),
    ).toBe(true);
  });

  it('isBabelAddressDeliveryAvailable matches dropoff null', () => {
    expect(isBabelAddressDeliveryAvailable({ dropoff: null })).toBe(false);
    expect(isBabelAddressDeliveryAvailable({ dropoff: 0 })).toBe(true);
    expect(isBabelAddressDeliveryAvailable({ dropoff: 1500 })).toBe(true);
  });
});
