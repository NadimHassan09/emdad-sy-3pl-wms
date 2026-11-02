import { Prisma } from '@prisma/client';

import {
  composeDestinationAddress,
  deriveCodStatus,
  mapOutboundStatusToOms,
  serializeOmsOrder,
  serializeOmsOrderListItem,
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

  it('prefers structured parts over short bare city destinationAddress', () => {
    expect(
      composeDestinationAddress({
        destinationAddress: 'دمشق',
        city: 'دمشق',
        district: 'محافظة دمشق',
        addressLine1: 'ابن عساكر',
        addressLine2: 'شارع ابن عساكر الرئيسي بناء 10',
      }),
    ).toBe('ابن عساكر, محافظة دمشق, دمشق, شارع ابن عساكر الرئيسي بناء 10');
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
    expect(mapOutboundStatusToOms('allocated')).toBe('processing');
    expect(mapOutboundStatusToOms('confirmed')).toBe('processing');
  });

  it('maps shipping preparation outbound statuses to ready_to_ship immediately after packing', () => {
    expect(mapOutboundStatusToOms('waiting_for_shipping_method')).toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('waiting_for_shipping_details')).toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('ready_to_ship')).toBe('ready_to_ship');
  });

  it('maps ready_to_ship and shipped correctly; never auto-delivered', () => {
    expect(mapOutboundStatusToOms('ready_to_ship')).toBe('ready_to_ship');
    expect(mapOutboundStatusToOms('shipped')).toBe('shipped');
    expect(mapOutboundStatusToOms('out_for_delivery')).toBe('shipped');
    expect(mapOutboundStatusToOms('delivered')).toBeNull();
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

  it('10. carrier name and AWB always match the same active shipment', () => {
    const order = {
      id: 'o2',
      orderNumber: 'OMS-2',
      status: 'processing',
      carrier: 'مسارات',
      trackingNumber: 'OLD-AWB',
      shippingServiceId: 'SILA_SY:old:area',
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      lines: [],
      outboundOrder: {
        id: 'out-2',
        orderNumber: 'OUT-2',
        status: 'waiting_for_shipping_details',
        carrier: 'مسارات',
        trackingNumber: 'OLD-AWB',
        shippingServiceId: 'SILA_SY:new:area',
        carrierShipments: [
          {
            status: 'created',
            supersededAt: null,
            trackingNumber: 'NEW-AWB',
            providerCode: 'SILA_SY',
            rawResultMeta: { courier_id: 'new', courier_name: 'ترابط' },
          },
        ],
      },
    };

    const detail = serializeOmsOrder(order as never);
    const list = serializeOmsOrderListItem(order as never);
    expect(detail.carrier).toBe('ترابط');
    expect(detail.trackingNumber).toBe('NEW-AWB');
    expect(list.carrier).toBe('ترابط');
    expect(list.trackingNumber).toBe('NEW-AWB');
    expect(list.linkedOutboundOrder?.hasCarrierShipment).toBe(true);
  });

  it('12. cancelled/superseded shipment is not presented as the active shipment', () => {
    const order = {
      id: 'o3',
      orderNumber: 'OMS-3',
      status: 'processing',
      carrier: null,
      trackingNumber: null,
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      lines: [],
      outboundOrder: {
        id: 'out-3',
        orderNumber: 'OUT-3',
        status: 'waiting_for_shipping_details',
        carrier: null,
        trackingNumber: null,
        carrierShipments: [
          {
            status: 'failed',
            supersededAt: new Date(),
            trackingNumber: 'CANCELLED-AWB',
            externalAwb: 'cargo-old',
            providerCode: 'SILA_SY',
            rawResultMeta: { courier_name: 'مسارات' },
          },
        ],
      },
    };
    const list = serializeOmsOrderListItem(order as never);
    expect(list.trackingNumber).toBeNull();
    expect(list.linkedOutboundOrder?.hasCarrierShipment).toBe(false);
    expect(list.carrier).toBeNull();
    expect(list.cancellationUnconfirmed).toBe(false);
  });

  it('keeps an active Babel AWB while lookup cancellation is unconfirmed', () => {
    const order = {
      id: 'o-babel-lookup',
      orderNumber: 'OMS-2026-02291',
      status: 'processing',
      carrier: 'Babel Express',
      trackingNumber: '260303707929',
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      lines: [],
      outboundOrder: {
        id: 'out-babel-lookup',
        orderNumber: 'OUT-02291',
        status: 'waiting_for_shipping_details',
        carrier: 'Babel Express',
        trackingNumber: '260303707929',
        shippingProviderCode: 'BABEL_EXPRESS',
        carrierShipments: [
          {
            status: 'created',
            supersededAt: null,
            trackingNumber: '260303707929',
            externalAwb: '260303707929',
            providerCode: 'BABEL_EXPRESS',
            rawResultMeta: {
              babelLookup: {
                state: 'not_found',
                at: '2026-10-22T10:00:00.000Z',
                errorMessage: 'Shipment not found',
              },
            },
          },
        ],
      },
    };
    const list = serializeOmsOrderListItem(order as never);
    const detail = serializeOmsOrder(order as never);
    expect(list.trackingNumber).toBe('260303707929');
    expect(list.carrier).toBe('Babel Express');
    expect(list.cancellationUnconfirmed).toBe(true);
    expect(detail.cancellationUnconfirmed).toBe(true);
    expect(list.linkedOutboundOrder?.hasCarrierShipment).toBe(true);
  });

  it('does not pair a confirmed Karam shipment with a stale TARABUT name or old AWB', () => {
    const order = {
      id: 'o-karam',
      orderNumber: 'OMS-KARAM',
      status: 'processing',
      carrier: 'TARABUT',
      trackingNumber: 'TARABUT-OLD-AWB',
      shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      lines: [],
      outboundOrder: {
        id: 'out-karam',
        orderNumber: 'OUT-KARAM',
        status: 'ready_to_ship',
        carrier: 'TARABUT',
        trackingNumber: 'TARABUT-OLD-AWB',
        shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
        shippingHubId: 'hub-1',
        carrierShipments: [
          {
            status: 'created',
            supersededAt: null,
            trackingNumber: 'KARAM-NEW-AWB',
            providerCode: 'SILA_SY',
            rawResultMeta: {
              courier_id: '9575208d-3587-4d23-84b3-cdc97d09b60e',
              courier_name: 'Karam',
              shipments: [{ remote_label_code: 'TARABUT-OLD-AWB' }],
            },
          },
        ],
      },
    };
    const detail = serializeOmsOrder(order as never);
    const list = serializeOmsOrderListItem(order as never);
    expect(detail.carrier).toBe('كرم للشحن');
    expect(detail.shippingCarrierName).toBe('كرم للشحن');
    expect(detail.trackingNumber).toBe('KARAM-NEW-AWB');
    expect(detail.awbPending).toBe(false);
    expect(detail.shippingHubId).toBe('hub-1');
    expect(list.carrier).toBe('كرم للشحن');
    expect(list.trackingNumber).toBe('KARAM-NEW-AWB');
    expect(list.trackingNumber).not.toBe('TARABUT-OLD-AWB');
  });

  it('shows the confirmed carrier with a pending AWB when the new AWB is not issued yet', () => {
    const order = {
      id: 'o-pending',
      orderNumber: 'OMS-PENDING',
      status: 'processing',
      carrier: 'TARABUT',
      trackingNumber: 'TARABUT-OLD-AWB',
      shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      lines: [],
      outboundOrder: {
        id: 'out-pending',
        orderNumber: 'OUT-PENDING',
        status: 'ready_to_ship',
        carrier: 'كرم للشحن',
        trackingNumber: null,
        shippingServiceId: 'SILA_SY:9575208d-3587-4d23-84b3-cdc97d09b60e:area',
        carrierShipments: [
          {
            status: 'created',
            supersededAt: null,
            trackingNumber: null,
            providerCode: 'SILA_SY',
            rawResultMeta: {
              courier_id: '9575208d-3587-4d23-84b3-cdc97d09b60e',
              courier_name: 'كرم للشحن',
              awbPendingReassignment: true,
              previousAwb: 'TARABUT-OLD-AWB',
            },
          },
        ],
      },
    };
    const detail = serializeOmsOrder(order as never);
    expect(detail.carrier).toBe('كرم للشحن');
    expect(detail.trackingNumber).toBeNull();
    expect(detail.awbPending).toBe(true);
  });

  it('1-3. Babel AWB and name come from the same active shipment, not leftover TARABUT', () => {
    const order = {
      id: 'o-babel',
      orderNumber: 'OMS-2026-02291',
      status: 'processing',
      carrier: 'ترابط',
      trackingNumber: '260303707929',
      shippingProviderCode: null,
      shippingServiceId: null,
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      lines: [],
      outboundOrder: {
        id: 'out-babel',
        orderNumber: 'OUT-BABEL',
        status: 'waiting_for_shipping_details',
        carrier: 'ترابط',
        trackingNumber: '260303707929',
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingServiceId: 'BABEL_EXPRESS:address',
        carrierShipments: [
          {
            status: 'created',
            supersededAt: null,
            trackingNumber: '260303707929',
            providerCode: 'BABEL_EXPRESS',
            rawResultMeta: { awb: '260303707929' },
          },
        ],
      },
    };
    const detail = serializeOmsOrder(order as never);
    const list = serializeOmsOrderListItem(order as never);
    expect(detail.carrier).toBe('Babel Express');
    expect(detail.shippingCarrierName).toBe('Babel Express');
    expect(detail.trackingNumber).toBe('260303707929');
    expect(list.carrier).toBe('Babel Express');
    expect(list.trackingNumber).toBe('260303707929');
    expect(detail.carrier).not.toBe('ترابط');
  });

  it('5. pending Babel AWB does not display the previous TARABUT AWB', () => {
    const order = {
      id: 'o-pending-babel',
      orderNumber: 'OMS-PENDING-BABEL',
      status: 'processing',
      carrier: 'ترابط',
      trackingNumber: 'TARABUT-OLD-AWB',
      shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      lines: [],
      outboundOrder: {
        id: 'out-pending-babel',
        orderNumber: 'OUT-PENDING-BABEL',
        status: 'waiting_for_shipping_details',
        carrier: null,
        trackingNumber: 'TARABUT-OLD-AWB',
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingServiceId: 'BABEL_EXPRESS:address',
        carrierShipments: [
          {
            status: 'created',
            supersededAt: null,
            trackingNumber: null,
            providerCode: 'BABEL_EXPRESS',
            rawResultMeta: { awbPendingReassignment: true, previousAwb: 'TARABUT-OLD-AWB' },
          },
        ],
      },
    };
    const detail = serializeOmsOrder(order as never);
    expect(detail.carrier).toBe('Babel Express');
    expect(detail.trackingNumber).toBeNull();
    expect(detail.awbPending).toBe(true);
  });

  it('does not expose an active return for Field Delivery without a requested/approved return', () => {
    const order = {
      id: 'o-fd',
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      status: 'failed_delivery',
      lines: [],
      omsReturns: [
        { id: 'ret-hist', status: 'completed', returnNumber: 'RET-OLD' },
        { id: 'ret-cancel', status: 'cancelled', returnNumber: 'RET-CXL' },
      ],
      outboundOrder: null,
    };
    const detail = serializeOmsOrder(order as never);
    expect(detail.activeReturn).toBeNull();
    expect(detail.omsReturns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ret-hist', status: 'completed' }),
      ]),
    );
  });

  it('exposes only requested/approved returns as active pending receipt', () => {
    const order = {
      id: 'o-pending',
      destinationAddress: 'x',
      addressLine1: null,
      city: null,
      district: null,
      addressLine2: null,
      subtotal: new Prisma.Decimal('1'),
      shippingFee: null,
      codAmount: null,
      status: 'return_pending_receipt',
      lines: [],
      omsReturns: [
        { id: 'ret-hist', status: 'completed', returnNumber: 'RET-OLD' },
        {
          id: 'ret-open',
          status: 'requested',
          returnNumber: 'RET-OPEN',
          reason: 'Field return',
          carrierReturnStage: 'return_created',
        },
      ],
      outboundOrder: null,
    };
    const detail = serializeOmsOrder(order as never);
    expect(detail.activeReturn).toEqual(
      expect.objectContaining({ id: 'ret-open', returnNumber: 'RET-OPEN', status: 'requested' }),
    );
  });
});
