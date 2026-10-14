import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

import {
  buildOperationalStageWhere,
  omsNavStatusBucket,
  OMS_NAV_STATUS_KEYS,
} from './oms-operational-stage';

describe('omsNavStatusBucket', () => {
  it('folds legacy synonyms into the general status cards', () => {
    expect(omsNavStatusBucket(OmsOrderStatus.draft)).toBe('waiting_for_confirmation');
    expect(omsNavStatusBucket(OmsOrderStatus.pending_approval)).toBe(
      'confirmed_waiting_for_admin_approval',
    );
    expect(omsNavStatusBucket(OmsOrderStatus.picking)).toBe('processing');
    expect(omsNavStatusBucket(OmsOrderStatus.packing)).toBe('processing');
    expect(omsNavStatusBucket(OmsOrderStatus.out_for_delivery)).toBe('shipped');
    expect(omsNavStatusBucket(OmsOrderStatus.completed)).toBe('delivered');
    expect(omsNavStatusBucket(OmsOrderStatus.rejected)).toBe('cancelled');
  });

  it('keeps single-stage commercial statuses on themselves', () => {
    expect(omsNavStatusBucket('ready_to_ship')).toBe('ready_to_ship');
    expect(omsNavStatusBucket('failed_delivery')).toBe('failed_delivery');
    expect(omsNavStatusBucket('returned')).toBe('returned');
  });

  it('covers every nav key', () => {
    for (const key of OMS_NAV_STATUS_KEYS) {
      expect(omsNavStatusBucket(key)).toBe(key);
    }
  });
});

describe('buildOperationalStageWhere', () => {
  it('requires processing plus the picking outbound statuses', () => {
    const where = buildOperationalStageWhere('picking');
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: expect.objectContaining({
            in: expect.arrayContaining([OmsOrderStatus.processing]),
          }),
        }),
        {
          outboundOrder: {
            is: { status: { in: expect.arrayContaining([OutboundOrderStatus.picking]) } },
          },
        },
      ]),
    );
  });

  it('keeps packing on the packing outbound status', () => {
    const where = buildOperationalStageWhere('packing');
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          outboundOrder: { is: { status: OutboundOrderStatus.packing } },
        },
      ]),
    );
  });

  it('splits shipping details from shipment-sent confirmation', () => {
    const details = buildOperationalStageWhere('shipping_details');
    const confirmation = buildOperationalStageWhere('shipping_confirmation');
    expect(JSON.stringify(details)).toContain('"none"');
    expect(JSON.stringify(confirmation)).toContain('"some"');
    expect(JSON.stringify(details)).not.toContain('"some"');
  });
});
