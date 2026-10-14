import { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';
import {
  collectionCurrencyAvailability,
  combineAvailability,
  payerAvailability,
} from './shipment-availability';

describe('shipment availability', () => {
  it('does not hide a quoted service because of a local payer rule', () => {
    expect(payerAvailability(BABEL_EXPRESS_CODE, 'sender', 58)).toEqual({ available: true });
    expect(payerAvailability(SILA_SY_CODE, 'reseller', 58)).toEqual({ available: true });
    expect(payerAvailability(SILA_SY_CODE, 'receiver', 58)).toEqual({ available: true });
  });

  it('does not hide a quoted service because fee currency differs from COD currency', () => {
    expect(
      collectionCurrencyAvailability({
        providerCode: SILA_SY_CODE,
        serviceName: 'TARABUT',
        deliveryType: 'address',
        collectionCurrency: 'USD',
        codAmount: 58,
      }),
    ).toEqual({ available: true });
    expect(
      collectionCurrencyAvailability({
        providerCode: SILA_SY_CODE,
        serviceName: 'Other Courier',
        deliveryType: 'address',
        collectionCurrency: 'SYP',
        codAmount: 58,
      }).available,
    ).toBe(true);
  });

  it('combineAvailability still reports the first real block', () => {
    expect(
      combineAvailability({ available: true }, { available: false, reason: 'from provider' }).reason,
    ).toBe('from provider');
  });
});
