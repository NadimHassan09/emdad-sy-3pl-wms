import { ShippingMethod } from '@prisma/client';

import { bulkSelectionPatch } from './bulk-shipping.selection';

describe('bulkSelectionPatch', () => {
  it('copies service, delivery type, payer, and fee currency onto the order', () => {
    expect(
      bulkSelectionPatch({
        providerCode: 'sila_sy',
        serviceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
        deliveryType: 'address',
        payer: 'sender',
        quotedCurrency: 'SYP',
      }),
    ).toEqual({
      shippingMethod: ShippingMethod.carrier,
      shippingProviderCode: 'SILA_SY',
      shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
      shippingDeliveryType: 'address',
      shippingPayer: 'sender',
      shippingQuotedCurrency: 'SYP',
    });
  });
});
