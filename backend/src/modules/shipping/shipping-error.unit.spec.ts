import {
  classifyShippingError,
  mayCreateShipment,
  packShippingError,
  phoneTail,
  unpackShippingError,
  visibleShippingError,
} from './shipping-error';

describe('classifyShippingError', () => {
  it('maps a timeout to ambiguous and blocks retry', () => {
    const error = classifyShippingError('timeout waiting for carrier response', {
      correlationId: 'OMS-1',
    });
    expect(error.category).toBe('ambiguous');
    expect(error.retrySafe).toBe(false);
    expect(error.field).toBeNull();
    expect(error.code).toBe('SHIPMENT_AMBIGUOUS');
  });

  it('does not relabel a coverage error as a fee-currency mismatch', () => {
    const error = classifyShippingError('courier_not_available_for_area', {
      codCurrency: 'USD',
      quoteCurrency: 'SYP',
    });
    expect(error.field).toBeNull();
    expect(error.message).toBe('courier_not_available_for_area');
    expect(error.message).not.toContain('quote currency');
  });

  it('keeps a COD capability rejection on the currency field', () => {
    const error = classifyShippingError('USD collection is not supported for this service.', {
      codCurrency: 'USD',
      quoteCurrency: 'SYP',
    });
    expect(error.field).toBe('currency');
    expect(error.message).toContain('not supported');
    expect(error.message).not.toContain('quote currency');
  });

  it('maps a province area to receiverNeighborhood', () => {
    const error = classifyShippingError('recipient.area_id is a whole province', {
      receiverNeighborhood: 'حمص',
    });
    expect(error.field).toBe('receiverNeighborhood');
    expect(error.currentValue).toBe('حمص');
  });

  it('maps a Babel sender payer rejection to shippingPayer', () => {
    const error = classifyShippingError('Payer as sender is not available', { payer: 'sender' });
    expect(error.field).toBe('shippingPayer');
    expect(error.currentValue).toBe('sender');
  });

  it('maps a missing sender neighbourhood separately from the receiver', () => {
    const error = classifyShippingError('sender neighbourhood could not be resolved');
    expect(error.field).toBe('senderNeighborhood');
  });

  it('maps a receiver phone separately from the sender phone', () => {
    expect(classifyShippingError('receiver phone is invalid').field).toBe('receiverPhone');
    expect(classifyShippingError('sender phone is invalid').field).toBe('senderPhone');
  });

  it('packs a field the admin screen can read', () => {
    const error = classifyShippingError('COD amount is below the carrier minimum of 1000', {
      codAmount: 26,
      codCurrency: 'SYP',
    });
    const packed = packShippingError(error);
    expect(visibleShippingError(packed)).toContain('1000');
    expect(unpackShippingError(packed)?.shippingField).toBe('codAmount');
    expect(phoneTail('+963944123456')).toBe('456');
  });
});

describe('mayCreateShipment', () => {
  it('refuses a second create while an ambiguous attempt is unconfirmed', () => {
    expect(
      mayCreateShipment({
        hasCreated: false,
        ambiguousOutstanding: true,
        acknowledged: false,
      }),
    ).toEqual({ allow: false, reason: 'ambiguous' });
  });

  it('allows create after the admin confirms no shipment exists', () => {
    expect(
      mayCreateShipment({
        hasCreated: false,
        ambiguousOutstanding: true,
        acknowledged: true,
      }).allow,
    ).toBe(true);
  });

  it('blocks when a created row already exists', () => {
    expect(
      mayCreateShipment({
        hasCreated: true,
        ambiguousOutstanding: false,
        acknowledged: true,
      }).reason,
    ).toBe('created');
  });
});
