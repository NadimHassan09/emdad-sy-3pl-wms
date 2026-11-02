import { resolveShippingCarrierName } from './shipping-carrier-resolver';

describe('resolveShippingCarrierName', () => {
  it('10. prefers the active shipment courier over a stale order.carrier', () => {
    expect(
      resolveShippingCarrierName({
        carrier: 'مسارات',
        shippingServiceId: 'SILA_SY:old-id:area',
        outboundOrder: {
          carrier: 'مسارات',
          shippingServiceId: 'SILA_SY:new-id:area',
          carrierShipments: [
            {
              status: 'created',
              supersededAt: null,
              providerCode: 'SILA_SY',
              rawResultMeta: { courier_id: 'new-id', courier_name: 'ترابط' },
            },
          ],
        },
      }),
    ).toBe('ترابط');
  });

  it('does not keep TARABUT from order.carrier or shippingServiceId when the active shipment is Karam', () => {
    expect(
      resolveShippingCarrierName({
        carrier: 'TARABUT',
        shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
        outboundOrder: {
          carrier: 'TARABUT',
          shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
          carrierShipments: [
            {
              status: 'created',
              supersededAt: null,
              providerCode: 'SILA_SY',
              rawResultMeta: {
                courier_id: '9575208d-3587-4d23-84b3-cdc97d09b60e',
                courier_name: 'Karam',
              },
            },
          ],
        },
      }),
    ).toBe('كرم للشحن');
  });

  it('1. successful Babel shipment replaces stale TARABUT identity', () => {
    expect(
      resolveShippingCarrierName({
        carrier: 'ترابط',
        shippingProviderCode: null,
        shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
        outboundOrder: {
          carrier: 'ترابط',
          shippingProviderCode: 'BABEL_EXPRESS',
          shippingServiceId: 'BABEL_EXPRESS:address',
          carrierShipments: [
            {
              status: 'created',
              supersededAt: null,
              providerCode: 'BABEL_EXPRESS',
              rawResultMeta: { awb: '260303707929' },
            },
          ],
        },
      }),
    ).toBe('Babel Express');
  });

  it('keeps Sila courier identity when the active shipment is still SILA_SY', () => {
    expect(
      resolveShippingCarrierName({
        carrier: 'ترابط',
        shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
        outboundOrder: {
          carrier: 'ترابط',
          shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
          carrierShipments: [
            {
              status: 'created',
              supersededAt: null,
              providerCode: 'SILA_SY',
              rawResultMeta: {
                courier_id: 'fd4f088d-243b-4582-bb72-bb97c69b589c',
                courier_name: 'ترابط',
              },
            },
          ],
        },
      }),
    ).toBe('ترابط');
  });

  it('ignores cancelled/superseded shipment courier identity', () => {
    expect(
      resolveShippingCarrierName({
        carrier: null,
        outboundOrder: {
          carrier: null,
          carrierShipments: [
            {
              status: 'failed',
              supersededAt: new Date(),
              providerCode: 'SILA_SY',
              rawResultMeta: { courier_name: 'مسارات' },
            },
          ],
        },
      }),
    ).toBeNull();
  });
});
