import { OutboundOrderStatus } from '@prisma/client';

import {
  isEligibleForBulkShipping,
  recommendCheapestProvider,
  resolveBulkProviderSelection,
} from './bulk-shipping.eligibility';
import { MANUAL_SHIPPING_CODE } from './shipping.constants';

describe('bulk-shipping.eligibility', () => {
  describe('isEligibleForBulkShipping', () => {
    it('ready_to_ship without carrier shipment → eligible', () => {
      expect(
        isEligibleForBulkShipping({
          status: OutboundOrderStatus.ready_to_ship,
          trackingNumber: null,
          carrierShipments: [],
        }),
      ).toBe(true);
    });

    it('packing → not eligible', () => {
      expect(
        isEligibleForBulkShipping({
          status: OutboundOrderStatus.packing,
          carrierShipments: [],
        }),
      ).toBe(false);
    });

    it('waiting_for_shipping_details → not eligible', () => {
      expect(
        isEligibleForBulkShipping({
          status: OutboundOrderStatus.waiting_for_shipping_details,
          carrierShipments: [],
        }),
      ).toBe(false);
    });

    it('shipped → not eligible', () => {
      expect(
        isEligibleForBulkShipping({
          status: OutboundOrderStatus.shipped,
          carrierShipments: [],
        }),
      ).toBe(false);
    });

    it('ready_to_ship with created carrier shipment → not eligible', () => {
      expect(
        isEligibleForBulkShipping({
          status: OutboundOrderStatus.ready_to_ship,
          carrierShipments: [{ status: 'created' }],
        }),
      ).toBe(false);
    });

    it('ready_to_ship with tracking number → not eligible', () => {
      expect(
        isEligibleForBulkShipping({
          status: OutboundOrderStatus.ready_to_ship,
          trackingNumber: 'AWB-1',
          carrierShipments: [],
        }),
      ).toBe(false);
    });
  });

  describe('recommendCheapestProvider', () => {
    it('recommends cheapest valid quote', () => {
      const best = recommendCheapestProvider([
        { providerCode: 'A', price: 100, currency: 'USD' },
        { providerCode: 'B', price: 80, currency: 'USD' },
        { providerCode: 'C', price: 120, currency: 'USD' },
      ]);
      expect(best?.providerCode).toBe('B');
      expect(best?.price).toBe(80);
    });

    it('excludes failed/manual and returns null when no quotes', () => {
      expect(recommendCheapestProvider([])).toBeNull();
      expect(
        recommendCheapestProvider([
          { providerCode: MANUAL_SHIPPING_CODE, price: 0, currency: 'USD' },
        ]),
      ).toBeNull();
    });
  });

  describe('resolveBulkProviderSelection', () => {
    it('prefers override, then recommendation, then current carrier, else Manual', () => {
      expect(
        resolveBulkProviderSelection({
          recommendedCode: 'BABEL_EXPRESS',
          currentMethod: 'manual',
          currentProviderCode: null,
          overrideCode: 'MANUAL',
        }),
      ).toBe('MANUAL');

      expect(
        resolveBulkProviderSelection({
          recommendedCode: 'BABEL_EXPRESS',
          currentMethod: 'manual',
          currentProviderCode: null,
        }),
      ).toBe('BABEL_EXPRESS');

      expect(
        resolveBulkProviderSelection({
          recommendedCode: null,
          currentMethod: 'carrier',
          currentProviderCode: 'BABEL_EXPRESS',
        }),
      ).toBe('BABEL_EXPRESS');

      expect(
        resolveBulkProviderSelection({
          recommendedCode: null,
          currentMethod: 'manual',
          currentProviderCode: null,
        }),
      ).toBe(MANUAL_SHIPPING_CODE);
    });
  });
});
