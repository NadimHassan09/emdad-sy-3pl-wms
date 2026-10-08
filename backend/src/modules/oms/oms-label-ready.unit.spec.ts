import { shippingLabelReadiness } from './oms-label-ready';

describe('shippingLabelReadiness', () => {
  it('does not treat an unconfirmed assignment or manual shipping without a tracking number as a label', () => {
    expect(
      shippingLabelReadiness({
        status: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        trackingNumber: 'AWB-1',
        hasCreatedCarrierShipment: true,
      }),
    ).toBe('not_confirmed');
    expect(
      shippingLabelReadiness({
        status: 'ready_to_ship',
        trackingNumber: null,
      }),
    ).toBe('no_label');
  });

  it('counts a confirmed order only when a tracking number or created shipment exists', () => {
    expect(
      shippingLabelReadiness({
        status: 'ready_to_ship',
        trackingNumber: 'AWB-9',
      }),
    ).toBe('ready');
    expect(
      shippingLabelReadiness({
        status: 'shipped',
        hasCreatedCarrierShipment: true,
      }),
    ).toBe('ready');
  });
});
