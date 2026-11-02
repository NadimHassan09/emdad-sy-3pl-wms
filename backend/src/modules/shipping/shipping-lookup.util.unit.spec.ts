import {
  inactiveShipmentState,
  isBabelShipmentNotFoundMessage,
  isCancellationUnconfirmed,
  isProviderLookupNotFoundEvent,
  PROVIDER_LOOKUP_NOT_FOUND_EVENT,
  readBabelLookupMeta,
} from './shipping-lookup.util';

describe('shipping-lookup.util', () => {
  it('recognizes Babel Shipment not found without treating other errors as missing', () => {
    expect(isBabelShipmentNotFoundMessage('Shipment not found')).toBe(true);
    expect(isBabelShipmentNotFoundMessage('Babel Express HTTP 500')).toBe(false);
    expect(isBabelShipmentNotFoundMessage('Network timeout')).toBe(false);
  });

  it('does not treat missing lookup meta as confirmed cancellation', () => {
    expect(isCancellationUnconfirmed(null)).toBe(false);
    expect(isCancellationUnconfirmed({ babelLookup: { state: 'ok', at: '2026-10-22' } })).toBe(false);
    expect(
      isCancellationUnconfirmed({
        babelLookup: { state: 'not_found', at: '2026-10-22', errorMessage: 'Shipment not found' },
      }),
    ).toBe(true);
    expect(readBabelLookupMeta({ babelLookup: { state: 'error', at: 'x' } })?.state).toBe('error');
  });

  it('classifies local shipment activity without inventing cancel from lookup errors', () => {
    expect(isProviderLookupNotFoundEvent({ eventType: PROVIDER_LOOKUP_NOT_FOUND_EVENT })).toBe(true);
    expect(inactiveShipmentState({ status: 'created', supersededAt: null })).toBe('active');
    expect(inactiveShipmentState({ status: 'failed', supersededAt: new Date() })).toBe('superseded');
    expect(inactiveShipmentState({ status: 'failed', supersededAt: null })).toBe('cancelled');
  });
});
