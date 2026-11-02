import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

import { mapOutboundStatusToOms } from './oms-order.mapper';
import { summarizeBatchMembers } from './oms-batch-summary';
import {
  buildOperationalStageWhere,
  omsNavStatusBucket,
} from './oms-operational-stage';

describe('OMS Ready to Ship Lifecycle Invariants', () => {
  describe('1. Packing completed → Ready to Ship / Shipping Details', () => {
    it('maps waiting_for_shipping_method to ready_to_ship immediately after packing', () => {
      const omsStatus = mapOutboundStatusToOms(
        OutboundOrderStatus.waiting_for_shipping_method,
      );
      expect(omsStatus).toBe(OmsOrderStatus.ready_to_ship);
    });

    it('summarizes a batch with waiting_for_shipping_method as readyToShip in shipping_details stage', () => {
      const summary = summarizeBatchMembers([
        {
          status: 'ready_to_ship',
          outboundStatus: 'waiting_for_shipping_method',
        },
      ]);
      expect(summary.orderCount).toBe(1);
      expect(summary.pickedCount).toBe(1);
      expect(summary.packedCount).toBe(1);
      expect(summary.readyToShipCount).toBe(1);
      expect(summary.stageKey).toBe('shipping_details');
      expect(summary.stageKind).toBe('operational');
    });
  });

  describe('2. Existing Processing / Shipping Details → Ready to Ship mapping', () => {
    it('maps waiting_for_shipping_details to ready_to_ship', () => {
      const omsStatus = mapOutboundStatusToOms(
        OutboundOrderStatus.waiting_for_shipping_details,
      );
      expect(omsStatus).toBe(OmsOrderStatus.ready_to_ship);
    });

    it('batch summary counts waiting_for_shipping_details member under readyToShip', () => {
      const summary = summarizeBatchMembers([
        {
          status: 'ready_to_ship',
          outboundStatus: 'waiting_for_shipping_details',
        },
      ]);
      expect(summary.readyToShipCount).toBe(1);
      expect(summary.stageKey).toBe('shipping_details');
    });
  });

  describe('3. Existing Processing / Shipping Confirmation → Ready to Ship mapping', () => {
    it('maps outbound ready_to_ship to OMS ready_to_ship', () => {
      const omsStatus = mapOutboundStatusToOms(OutboundOrderStatus.ready_to_ship);
      expect(omsStatus).toBe(OmsOrderStatus.ready_to_ship);
    });

    it('batch summary classifies outbound ready_to_ship as operational dispatch stage', () => {
      const summary = summarizeBatchMembers([
        {
          status: 'ready_to_ship',
          outboundStatus: 'ready_to_ship',
        },
      ]);
      expect(summary.readyToShipCount).toBe(1);
      expect(summary.stageKey).toBe('dispatch');
      expect(summary.stageKind).toBe('operational');
    });
  });

  describe('4. Genuine Processing / Picking remains Processing', () => {
    it('maps picking, allocated, and draft outbound to processing', () => {
      expect(mapOutboundStatusToOms(OutboundOrderStatus.picking)).toBe(
        OmsOrderStatus.processing,
      );
      expect(mapOutboundStatusToOms(OutboundOrderStatus.allocated)).toBe(
        OmsOrderStatus.processing,
      );
      expect(mapOutboundStatusToOms(OutboundOrderStatus.draft)).toBe(
        OmsOrderStatus.processing,
      );
    });

    it('batch summary classifies picking member under processing, picking stage, not ready to ship', () => {
      const summary = summarizeBatchMembers([
        {
          status: 'processing',
          outboundStatus: 'picking',
        },
      ]);
      expect(summary.pickedCount).toBe(0);
      expect(summary.packedCount).toBe(0);
      expect(summary.readyToShipCount).toBe(0);
      expect(summary.stageKey).toBe('picking');
      expect(summary.stageKind).toBe('operational');
    });
  });

  describe('5. Genuine Processing / Packing remains Processing', () => {
    it('maps packing outbound status to processing', () => {
      expect(mapOutboundStatusToOms(OutboundOrderStatus.packing)).toBe(
        OmsOrderStatus.processing,
      );
    });

    it('batch summary classifies packing member with picked=1, packed=0, readyToShip=0', () => {
      const summary = summarizeBatchMembers([
        {
          status: 'processing',
          outboundStatus: 'packing',
        },
      ]);
      expect(summary.pickedCount).toBe(1);
      expect(summary.packedCount).toBe(0);
      expect(summary.readyToShipCount).toBe(0);
      expect(summary.stageKey).toBe('packing');
      expect(summary.stageKind).toBe('operational');
    });
  });

  describe('6. Operational Stage Prisma Where Queries', () => {
    it('buildOperationalStageWhere for picking and packing requires processing status', () => {
      const pickingWhere = buildOperationalStageWhere('picking');
      const packingWhere = buildOperationalStageWhere('packing');

      expect(JSON.stringify(pickingWhere)).toContain(OmsOrderStatus.processing);
      expect(JSON.stringify(packingWhere)).toContain(OmsOrderStatus.processing);
      expect(JSON.stringify(pickingWhere)).not.toContain(OmsOrderStatus.ready_to_ship);
      expect(JSON.stringify(packingWhere)).not.toContain(OmsOrderStatus.ready_to_ship);
    });

    it('buildOperationalStageWhere for shipping_details requires ready_to_ship status', () => {
      const shippingDetailsWhere = buildOperationalStageWhere('shipping_details');
      expect(JSON.stringify(shippingDetailsWhere)).toContain(OmsOrderStatus.ready_to_ship);
      expect(JSON.stringify(shippingDetailsWhere)).toContain(
        OutboundOrderStatus.waiting_for_shipping_method,
      );
      expect(JSON.stringify(shippingDetailsWhere)).toContain(
        OutboundOrderStatus.waiting_for_shipping_details,
      );
    });

    it('buildOperationalStageWhere for shipping_confirmation requires ready_to_ship status', () => {
      const shippingConfirmationWhere = buildOperationalStageWhere(
        'shipping_confirmation',
      );
      expect(JSON.stringify(shippingConfirmationWhere)).toContain(
        OmsOrderStatus.ready_to_ship,
      );
      expect(JSON.stringify(shippingConfirmationWhere)).toContain(
        OutboundOrderStatus.waiting_for_shipping_method,
      );
    });
  });

  describe('7. Status Navigation Counters Bucketing', () => {
    it('places ready_to_ship into the ready_to_ship bucket', () => {
      expect(omsNavStatusBucket(OmsOrderStatus.ready_to_ship)).toBe('ready_to_ship');
    });

    it('places processing into the processing bucket', () => {
      expect(omsNavStatusBucket(OmsOrderStatus.processing)).toBe('processing');
    });

    it('places legacy picking and packing into processing bucket', () => {
      expect(omsNavStatusBucket(OmsOrderStatus.picking)).toBe('processing');
      expect(omsNavStatusBucket(OmsOrderStatus.packing)).toBe('processing');
    });
  });
});
