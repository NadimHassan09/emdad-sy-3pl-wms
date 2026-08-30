import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';
import {
  assertPreviousOmsStatusOrThrow,
  canRevertCancel,
  resolveOutboundRestoreStatus,
  resolvePreviousOmsStatus,
  snapshotOnEnteringCancelled,
} from './oms-cancel-revert';

describe('oms-cancel-revert', () => {
  describe('snapshotOnEnteringCancelled', () => {
    it('captures the live OMS and outbound statuses', () => {
      expect(
        snapshotOnEnteringCancelled(
          OmsOrderStatus.confirmed_waiting_for_admin_approval,
          OutboundOrderStatus.draft,
        ),
      ).toEqual({
        cancelledFromStatus: OmsOrderStatus.confirmed_waiting_for_admin_approval,
        cancelledFromOutboundStatus: OutboundOrderStatus.draft,
      });
    });

    it('does not snapshot an already-cancelled outbound', () => {
      expect(
        snapshotOnEnteringCancelled(OmsOrderStatus.processing, OutboundOrderStatus.cancelled),
      ).toEqual({
        cancelledFromStatus: OmsOrderStatus.processing,
        cancelledFromOutboundStatus: null,
      });
    });
  });

  describe('resolvePreviousOmsStatus', () => {
    it('prefers cancelledFromStatus when restorable', () => {
      expect(
        resolvePreviousOmsStatus({
          cancelledFromStatus: OmsOrderStatus.processing,
          events: [{ eventType: 'oms.confirmed' }],
        }),
      ).toBe(OmsOrderStatus.processing);
    });

    it('uses the last high-confidence event before cancel', () => {
      expect(
        resolvePreviousOmsStatus({
          events: [
            { eventType: 'oms.confirmed' },
            { eventType: 'oms.approved', payload: { omsStatus: 'processing' } },
            { eventType: 'oms.cancelled' },
          ],
        }),
      ).toBe(OmsOrderStatus.processing);
    });

    it('refuses timestamp-free guess when nothing is confident', () => {
      expect(resolvePreviousOmsStatus({ events: [{ eventType: 'order.updated' }] })).toBeNull();
      expect(() => assertPreviousOmsStatusOrThrow(null)).toThrow(InvalidStateException);
      expect(() => assertPreviousOmsStatusOrThrow(null)).toThrow(
        /Cannot safely determine previous OMS status/,
      );
    });

    it('allows Out for Delivery restore targets from snapshot', () => {
      expect(
        resolvePreviousOmsStatus({ cancelledFromStatus: OmsOrderStatus.shipped }),
      ).toBe(OmsOrderStatus.shipped);
      expect(
        resolvePreviousOmsStatus({
          cancelledFromStatus: OmsOrderStatus.out_for_delivery,
        }),
      ).toBe(OmsOrderStatus.out_for_delivery);
    });

    it('refuses unsafe restore targets such as delivered', () => {
      expect(
        resolvePreviousOmsStatus({ cancelledFromStatus: OmsOrderStatus.delivered }),
      ).toBeNull();
    });
  });

  describe('canRevertCancel', () => {
    it('allows client only for pre-approval restore targets', () => {
      expect(
        canRevertCancel({
          orderStatus: OmsOrderStatus.cancelled,
          restoreTo: OmsOrderStatus.waiting_for_confirmation,
          actor: 'client',
        }),
      ).toBe(true);
      expect(
        canRevertCancel({
          orderStatus: OmsOrderStatus.cancelled,
          restoreTo: OmsOrderStatus.processing,
          actor: 'client',
        }),
      ).toBe(false);
      expect(
        canRevertCancel({
          orderStatus: OmsOrderStatus.cancelled,
          restoreTo: OmsOrderStatus.processing,
          actor: 'admin',
        }),
      ).toBe(true);
      expect(
        canRevertCancel({
          orderStatus: OmsOrderStatus.cancelled,
          restoreTo: OmsOrderStatus.out_for_delivery,
          actor: 'admin',
        }),
      ).toBe(true);
      expect(
        canRevertCancel({
          orderStatus: OmsOrderStatus.cancelled,
          restoreTo: OmsOrderStatus.shipped,
          actor: 'client',
        }),
      ).toBe(false);
    });
  });

  describe('resolveOutboundRestoreStatus', () => {
    it('prefers the cancel snapshot', () => {
      expect(
        resolveOutboundRestoreStatus({
          cancelledFromOutboundStatus: OutboundOrderStatus.picking,
          outboundCancelledAt: new Date(),
          hasActiveReservations: false,
        }),
      ).toBe(OutboundOrderStatus.picking);
    });

    it('uses OMS-path heuristic when cancelledAt is null', () => {
      expect(
        resolveOutboundRestoreStatus({
          outboundCancelledAt: null,
          hasActiveReservations: true,
        }),
      ).toBe(OutboundOrderStatus.allocated);
      expect(
        resolveOutboundRestoreStatus({
          outboundCancelledAt: null,
          hasActiveReservations: false,
        }),
      ).toBe(OutboundOrderStatus.draft);
    });

    it('requires audit previous status after a full outbound cancel', () => {
      expect(
        resolveOutboundRestoreStatus({
          outboundCancelledAt: new Date(),
          hasActiveReservations: false,
        }),
      ).toBeNull();
      expect(
        resolveOutboundRestoreStatus({
          outboundCancelledAt: new Date(),
          hasActiveReservations: false,
          auditPreviousStatus: OutboundOrderStatus.packing,
        }),
      ).toBe(OutboundOrderStatus.packing);
    });

    it('restores OFD outbound from cancel snapshot', () => {
      expect(
        resolveOutboundRestoreStatus({
          cancelledFromOutboundStatus: OutboundOrderStatus.out_for_delivery,
          outboundCancelledAt: new Date(),
          hasActiveReservations: false,
        }),
      ).toBe(OutboundOrderStatus.out_for_delivery);
      expect(
        resolveOutboundRestoreStatus({
          cancelledFromOutboundStatus: OutboundOrderStatus.shipped,
          outboundCancelledAt: new Date(),
          hasActiveReservations: false,
        }),
      ).toBe(OutboundOrderStatus.shipped);
    });
  });
});
