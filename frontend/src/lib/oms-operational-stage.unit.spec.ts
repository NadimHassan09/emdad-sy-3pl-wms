import { describe, expect, it } from 'vitest';

import {
  orderOperationalStage,
  shouldShowOmsStageColumn,
  statusHasOperationalStages,
} from './oms-operational-stage';

describe('orderOperationalStage', () => {
  it('classifies processing warehouse stages', () => {
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
    expect(
      orderOperationalStage({
        status: 'processing',
        linkedOutboundOrder: { status: 'waiting_for_shipping_details' },
      }),
    ).toBe('shipping_details');
    expect(
      orderOperationalStage({
        status: 'processing',
        trackingNumber: 'AWB-1',
        linkedOutboundOrder: { status: 'waiting_for_shipping_method' },
      }),
    ).toBe('shipping_confirmation');
  });

  it('returns null when the stage only repeats the general status', () => {
    expect(
      orderOperationalStage({
        status: 'shipped',
        linkedOutboundOrder: { status: 'shipped' },
      }),
    ).toBeNull();
    expect(
      orderOperationalStage({
        status: 'ready_to_ship',
        linkedOutboundOrder: { status: 'ready_to_ship' },
      }),
    ).toBeNull();
    expect(orderOperationalStage({ status: 'delivered' })).toBeNull();
    expect(orderOperationalStage({ status: 'cancelled' })).toBeNull();
  });
});

describe('stage column visibility', () => {
  it('shows the column for all statuses and for processing', () => {
    expect(shouldShowOmsStageColumn('')).toBe(true);
    expect(shouldShowOmsStageColumn('processing')).toBe(true);
    expect(statusHasOperationalStages('processing')).toBe(true);
  });

  it('hides the column for single-stage general statuses', () => {
    expect(shouldShowOmsStageColumn('shipped')).toBe(false);
    expect(shouldShowOmsStageColumn('delivered')).toBe(false);
    expect(shouldShowOmsStageColumn('ready_to_ship')).toBe(false);
    expect(statusHasOperationalStages('shipped')).toBe(false);
  });
});
