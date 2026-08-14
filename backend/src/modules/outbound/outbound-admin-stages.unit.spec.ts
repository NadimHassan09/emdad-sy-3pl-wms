import { OutboundOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';
import {
  assertOutboundAdminStageAction,
  nextOutboundAdminAction,
  outboundRequiresPacking,
} from './outbound-admin-stages';

describe('outbound-admin-stages', () => {
  describe('outboundRequiresPacking', () => {
    it('defaults to packing required', () => {
      expect(outboundRequiresPacking({})).toBe(true);
    });

    it('skips packing when order or plan says false', () => {
      expect(outboundRequiresPacking({ requiresPacking: false })).toBe(false);
      expect(outboundRequiresPacking({ planRequiresPacking: false })).toBe(false);
    });
  });

  describe('nextOutboundAdminAction', () => {
    it('returns approve for confirmable statuses', () => {
      expect(nextOutboundAdminAction(OutboundOrderStatus.draft, true)).toBe('approve');
      expect(nextOutboundAdminAction(OutboundOrderStatus.pending_approval, true)).toBe(
        'approve',
      );
      expect(nextOutboundAdminAction(OutboundOrderStatus.allocated, false)).toBe('approve');
    });

    it('returns complete_picking while picking', () => {
      expect(nextOutboundAdminAction(OutboundOrderStatus.picking, true)).toBe(
        'complete_picking',
      );
    });

    it('returns complete_packing only when packing required', () => {
      expect(nextOutboundAdminAction(OutboundOrderStatus.packing, true)).toBe(
        'complete_packing',
      );
      expect(nextOutboundAdminAction(OutboundOrderStatus.packing, false)).toBeNull();
    });

    it('returns complete_shipping_details while waiting_for_shipping_details', () => {
      expect(
        nextOutboundAdminAction(OutboundOrderStatus.waiting_for_shipping_details, true),
      ).toBe('complete_shipping_details');
      expect(
        nextOutboundAdminAction(OutboundOrderStatus.waiting_for_shipping_details, false),
      ).toBe('complete_shipping_details');
    });

    it('returns complete_dispatch at ready_to_ship (Waiting for Dispatch only)', () => {
      expect(nextOutboundAdminAction(OutboundOrderStatus.ready_to_ship, true)).toBe(
        'complete_dispatch',
      );
      expect(nextOutboundAdminAction(OutboundOrderStatus.ready_to_ship, false)).toBe(
        'complete_dispatch',
      );
    });

    it('returns null for terminal statuses', () => {
      expect(nextOutboundAdminAction(OutboundOrderStatus.shipped, true)).toBeNull();
      expect(nextOutboundAdminAction(OutboundOrderStatus.cancelled, true)).toBeNull();
    });
  });

  describe('assertOutboundAdminStageAction', () => {
    it('allows the happy packing path', () => {
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.draft, 'approve', true),
      ).not.toThrow();
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.picking, 'complete_picking', true),
      ).not.toThrow();
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.packing, 'complete_packing', true),
      ).not.toThrow();
      expect(() =>
        assertOutboundAdminStageAction(
          OutboundOrderStatus.waiting_for_shipping_details,
          'complete_shipping_details',
          true,
        ),
      ).not.toThrow();
      expect(() =>
        assertOutboundAdminStageAction(
          OutboundOrderStatus.ready_to_ship,
          'complete_dispatch',
          true,
        ),
      ).not.toThrow();
    });

    it('allows no-packing path (picking → shipping details → dispatch)', () => {
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.picking, 'complete_picking', false),
      ).not.toThrow();
      expect(() =>
        assertOutboundAdminStageAction(
          OutboundOrderStatus.waiting_for_shipping_details,
          'complete_shipping_details',
          false,
        ),
      ).not.toThrow();
      expect(() =>
        assertOutboundAdminStageAction(
          OutboundOrderStatus.ready_to_ship,
          'complete_dispatch',
          false,
        ),
      ).not.toThrow();
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.picking, 'complete_packing', false),
      ).toThrow(InvalidStateException);
    });

    it('rejects approve twice / pick before approval / dispatch before shipping details', () => {
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.picking, 'approve', true),
      ).toThrow(InvalidStateException);
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.draft, 'complete_picking', true),
      ).toThrow(InvalidStateException);
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.picking, 'complete_packing', true),
      ).toThrow(InvalidStateException);
      expect(() =>
        assertOutboundAdminStageAction(OutboundOrderStatus.packing, 'complete_dispatch', true),
      ).toThrow(InvalidStateException);
      expect(() =>
        assertOutboundAdminStageAction(
          OutboundOrderStatus.waiting_for_shipping_details,
          'complete_dispatch',
          true,
        ),
      ).toThrow(InvalidStateException);
      expect(() =>
        assertOutboundAdminStageAction(
          OutboundOrderStatus.shipped,
          'complete_dispatch',
          true,
        ),
      ).toThrow(InvalidStateException);
    });
  });
});
