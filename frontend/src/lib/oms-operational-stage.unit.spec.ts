import { describe, expect, it } from 'vitest';

import {
  orderOperationalStage,
  shouldShowOmsStageColumn,
  statusHasOperationalStages,
} from './oms-operational-stage';

describe('orderOperationalStage', () => {
  it('classifies processing warehouse stages (picking and packing)', () => {
    expect(
      orderOperationalStage({
        status: 'processing',
        linkedOutboundOrder: { status: 'picking' },
      }),
    ).toBe('picking');
    expect(
      orderOperationalStage({
        status: 'processing',
        linkedOutboundOrder: { status: 'draft' },
      }),
    ).toBe('picking');
    expect(
      orderOperationalStage({
        status: 'processing',
        linkedOutboundOrder: { status: 'packing' },
      }),
    ).toBe('packing');
  });

  it('classifies ready_to_ship shipment preparation stages', () => {
    expect(
      orderOperationalStage({
        status: 'ready_to_ship',
        linkedOutboundOrder: { status: 'waiting_for_shipping_details' },
      }),
    ).toBe('shipping_details');
    expect(
      orderOperationalStage({
        status: 'ready_to_ship',
        trackingNumber: 'AWB-1',
        linkedOutboundOrder: { status: 'waiting_for_shipping_method' },
      }),
    ).toBe('shipping_confirmation');
    expect(
      orderOperationalStage({
        status: 'ready_to_ship',
        trackingNumber: null,
        linkedOutboundOrder: {
          status: 'waiting_for_shipping_details',
          trackingNumber: null,
          hasCarrierShipment: false,
        },
      }),
    ).toBe('shipping_details');
  });

  it('returns null when the stage only repeats the general status', () => {
    expect(
      orderOperationalStage({
        status: 'shipped',
        linkedOutboundOrder: { status: 'shipped' },
      }),
    ).toBeNull();
    expect(orderOperationalStage({ status: 'delivered' })).toBeNull();
    expect(orderOperationalStage({ status: 'cancelled' })).toBeNull();
  });
});

describe('stage column visibility', () => {
  it('shows the column for all statuses, processing, and ready_to_ship', () => {
    expect(shouldShowOmsStageColumn('')).toBe(true);
    expect(shouldShowOmsStageColumn('processing')).toBe(true);
    expect(shouldShowOmsStageColumn('ready_to_ship')).toBe(true);
    expect(statusHasOperationalStages('processing')).toBe(true);
    expect(statusHasOperationalStages('ready_to_ship')).toBe(true);
  });

  it('hides the column for single-stage general statuses', () => {
    expect(shouldShowOmsStageColumn('shipped')).toBe(false);
    expect(shouldShowOmsStageColumn('delivered')).toBe(false);
    expect(statusHasOperationalStages('shipped')).toBe(false);
  });
});
