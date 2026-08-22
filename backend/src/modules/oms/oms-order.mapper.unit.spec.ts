import { Prisma } from '@prisma/client';

import {
  composeDestinationAddress,
  deriveCodStatus,
  mapOutboundStatusToOms,
  serializeOmsOrder,
} from './oms-order.mapper';

describe('composeDestinationAddress', () => {
  it('prefers legacy destinationAddress when provided', () => {
    expect(
      composeDestinationAddress({
        destinationAddress: 'Legacy block',
        city: 'Damascus',
      }),
    ).toBe('Legacy block');
  });

  it('builds structured address from parts', () => {
    expect(
      composeDestinationAddress({
        addressLine1: 'Street 1',
        district: 'Mazzeh',
        city: 'Damascus',
        addressLine2: 'Floor 2',
      }),
    ).toBe('Street 1, Mazzeh, Damascus, Floor 2');
  });
});

describe('deriveCodStatus', () => {
  it('returns pending for COD orders with amount', () => {
    expect(deriveCodStatus('COD', new Prisma.Decimal('100'))).toBe('pending');
  });

  it('returns null for prepaid orders', () => {
    expect(deriveCodStatus('PREPAID', new Prisma.Decimal('100'))).toBeNull();
  });
});

describe('mapOutboundStatusToOms', () => {
  it('maps prep outbound statuses to processing', () => {
    expect(mapOutboundStatusToOms('draft')).toBe('processing');
    expect(mapOutboundStatusToOms('picking')).toBe('processing');
    expect(mapOutboundStatusToOms('packing')).toBe('processing');
    expect(mapOutboundStatusToOms('waiting_for_shipping_details')).toBe('processing');
    expect(mapOutboundStatusToOms('allocated')).toBe('processing');
  });

  it('maps ready_to_ship and shipped correctly; never auto-delivered', () => {
    expect(mapOutboundStatusToOms('ready_to_ship')).toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('shipped')).toBe('shipped');
    expect(mapOutboundStatusToOms('out_for_delivery')).toBe('shipped');
    expect(mapOutboundStatusToOms('delivered')).toBeNull();
  });

  it('keeps OMS processing through shipping details; ready_to_ship only at Waiting for Dispatch', () => {
    expect(mapOutboundStatusToOms('waiting_for_shipping_details')).toBe('processing');
    expect(mapOutboundStatusToOms('waiting_for_shipping_details')).not.toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('waiting_for_shipping_details')).not.toBe('shipped');
    expect(mapOutboundStatusToOms('picking')).not.toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('packing')).not.toBe('ready_to_ship');
  });

  it('never maps picking/packing to ready_to_ship or shipped (carrier boundary)', () => {
    expect(mapOutboundStatusToOms('picking')).not.toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('picking')).not.toBe('shipped');
    expect(mapOutboundStatusToOms('packing')).not.toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('packing')).not.toBe('shipped');
    expect(mapOutboundStatusToOms('picking')).toBe('processing');
    expect(mapOutboundStatusToOms('packing')).toBe('processing');
  });

  it('maps cancelled outbound to cancelled', () => {
    expect(mapOutboundStatusToOms('cancelled')).toBe('cancelled');
  });

  it('does not map externally_fulfilled to processing (commercial OMS owns shipped)', () => {
    expect(mapOutboundStatusToOms('externally_fulfilled')).toBeNull();
  });
});

describe('serializeOmsOrder', () => {
  it('falls back to structured address when destination is empty', () => {
    const order = {
      id: 'o1',
      destinationAddress: 'old',
      addressLine1: 'Line 1',
      city: 'Aleppo',
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('10'),
      shippingFee: null,
      codAmount: null,
      lines: [
        {
          id: 'l1',
          requestedQuantity: new Prisma.Decimal('2'),
          unitPrice: new Prisma.Decimal('5'),
          lineTotal: new Prisma.Decimal('10'),
          discountAmount: null,
        },
      ],
      outboundOrder: null,
    };

    const serialized = serializeOmsOrder(order as never);
    expect(serialized.destinationAddress).toBe('Line 1, Aleppo');
    expect(serialized.subtotal).toBe('10');
    expect(serialized.lines[0]?.requestedQuantity).toBe('2');
    expect(serialized.total).toBe('10');
  });
});
