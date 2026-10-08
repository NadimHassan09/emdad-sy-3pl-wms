import { ShippingTrackingService } from './shipping-tracking.service';
import type { NormalizedTrackingStatus } from './shipping-provider.interface';

/**
 * Provider × Status × OMS-stage matrix (plan verification).
 * Asserts phase classification + expected action class without hitting DB.
 */
describe('Carrier status matrix (Provider × Status × Stage)', () => {
  const service = new ShippingTrackingService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const cases: Array<{
    name: string;
    normalized: NormalizedTrackingStatus;
    oms: string;
    outbound: string;
    expectPreOfd: boolean;
  }> = [
    {
      name: 'Babel cancel before confirm',
      normalized: 'cancelled',
      oms: 'ready_to_ship',
      outbound: 'waiting_for_shipping_details',
      expectPreOfd: true,
    },
    {
      name: 'Babel cancel after confirm waiting dispatch',
      normalized: 'cancelled',
      oms: 'ready_to_ship',
      outbound: 'ready_to_ship',
      expectPreOfd: true,
    },
    {
      name: 'Babel cancel after OFD',
      normalized: 'cancelled',
      oms: 'out_for_delivery',
      outbound: 'out_for_delivery',
      expectPreOfd: false,
    },
    {
      name: 'Sila disposed after OFD',
      normalized: 'cancelled',
      oms: 'shipped',
      outbound: 'shipped',
      expectPreOfd: false,
    },
    {
      name: 'DeliveryFailed after OFD',
      normalized: 'delivery_failed',
      oms: 'out_for_delivery',
      outbound: 'out_for_delivery',
      expectPreOfd: false,
    },
    {
      name: 'Delivered after OFD',
      normalized: 'delivered',
      oms: 'out_for_delivery',
      outbound: 'out_for_delivery',
      expectPreOfd: false,
    },
    {
      name: 'Returned-to-sender after OFD',
      normalized: 'returned_to_sender',
      oms: 'failed_delivery',
      outbound: 'out_for_delivery',
      expectPreOfd: false,
    },
    {
      name: 'Sila sub-courier cancel pre-OFD (ترابط)',
      normalized: 'cancelled',
      oms: 'processing',
      outbound: 'waiting_for_shipping_details',
      expectPreOfd: true,
    },
  ];

  it.each(cases)('$name → preOfd=$expectPreOfd', ({ oms, outbound, expectPreOfd }) => {
    expect(service.isPreOfd(oms, outbound)).toBe(expectPreOfd);
  });

  it('treats failed_delivery OMS as post-warehouse (left warehouse)', () => {
    expect(service.isPreOfd('failed_delivery', 'out_for_delivery')).toBe(false);
  });

  it('treats delivered/returned as post-warehouse', () => {
    expect(service.isPreOfd('delivered', 'delivered')).toBe(false);
    expect(service.isPreOfd('returned', 'returned')).toBe(false);
  });
});
