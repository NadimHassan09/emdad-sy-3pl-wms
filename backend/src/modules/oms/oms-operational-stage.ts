import { OmsOrderStatus, OutboundOrderStatus, Prisma } from '@prisma/client';

import { ACTIVE_CARRIER_SHIPMENT_WHERE } from '../shipping/shipping-lifecycle.util';

/**
 * Warehouse sub-stages that exist only while an OMS order is commercially "processing".
 * These match the admin stage badge (picking / packing / shipping details / confirmation).
 */
export const OMS_OPERATIONAL_STAGE_VALUES = [
  'picking',
  'packing',
  'shipping_details',
  'shipping_confirmation',
] as const;

export type OmsOperationalStage = (typeof OMS_OPERATIONAL_STAGE_VALUES)[number];

export function isOmsOperationalStage(value: string): value is OmsOperationalStage {
  return (OMS_OPERATIONAL_STAGE_VALUES as readonly string[]).includes(value);
}

/** Outbound statuses the admin UI treats as the picking stage. */
export const PICKING_OUTBOUND_STATUSES: OutboundOrderStatus[] = [
  OutboundOrderStatus.picking,
  OutboundOrderStatus.draft,
  OutboundOrderStatus.allocated,
  OutboundOrderStatus.pending_approval,
  OutboundOrderStatus.confirmed,
  OutboundOrderStatus.pending_stock,
];

export const SHIPPING_DETAILS_OUTBOUND_STATUSES: OutboundOrderStatus[] = [
  OutboundOrderStatus.waiting_for_shipping_method,
  OutboundOrderStatus.waiting_for_shipping_details,
  OutboundOrderStatus.ready_to_ship,
];

/**
 * Commercial list-filter expansions. `shipped` and `out_for_delivery` overlap;
 * the orders nav uses `shipped` as the single "out for delivery" bucket.
 */
export const OMS_LIST_STATUS_EXPANSIONS: Partial<Record<OmsOrderStatus, OmsOrderStatus[]>> = {
  [OmsOrderStatus.waiting_for_confirmation]: [
    OmsOrderStatus.waiting_for_confirmation,
    OmsOrderStatus.draft,
  ],
  [OmsOrderStatus.confirmed_waiting_for_admin_approval]: [
    OmsOrderStatus.confirmed_waiting_for_admin_approval,
    OmsOrderStatus.pending_approval,
  ],
  [OmsOrderStatus.processing]: [
    OmsOrderStatus.processing,
    OmsOrderStatus.pending,
    OmsOrderStatus.approved,
    OmsOrderStatus.confirmed,
    OmsOrderStatus.allocated,
    OmsOrderStatus.picking,
    OmsOrderStatus.packing,
  ],
  [OmsOrderStatus.ready_to_ship]: [OmsOrderStatus.ready_to_ship],
  [OmsOrderStatus.shipped]: [OmsOrderStatus.shipped, OmsOrderStatus.out_for_delivery],
  [OmsOrderStatus.out_for_delivery]: [OmsOrderStatus.out_for_delivery, OmsOrderStatus.shipped],
  [OmsOrderStatus.delivered]: [OmsOrderStatus.delivered, OmsOrderStatus.completed],
  [OmsOrderStatus.cancelled]: [OmsOrderStatus.cancelled, OmsOrderStatus.rejected],
};

/** Nav keys shown on the OMS orders status cards, in display order. */
export const OMS_NAV_STATUS_KEYS = [
  'waiting_for_confirmation',
  'confirmed_waiting_for_admin_approval',
  'processing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'failed_delivery',
  'return_pending_receipt',
  'returned',
  'cancelled',
] as const;

/** Collapse a raw OMS status into the general-status card that should count it. */
export function omsNavStatusBucket(rawStatus: string): string {
  for (const key of OMS_NAV_STATUS_KEYS) {
    const expanded = OMS_LIST_STATUS_EXPANSIONS[key as OmsOrderStatus];
    if (expanded?.includes(rawStatus as OmsOrderStatus) || key === rawStatus) {
      return key;
    }
  }
  return rawStatus;
}

/** Live sent shipment only — a cancelled/superseded AWB must not keep the order in confirmation. */
const createdShipment: Prisma.CarrierShipmentWhereInput = ACTIVE_CARRIER_SHIPMENT_WHERE;

/**
 * Shipment-sent matches the admin stage badge:
 * OMS tracking, outbound tracking, or a created carrier shipment / AWB.
 */
function shipmentSentWhere(): Prisma.OmsOrderWhereInput {
  return {
    OR: [
      { AND: [{ trackingNumber: { not: null } }, { NOT: { trackingNumber: '' } }] },
      {
        outboundOrder: {
          is: {
            AND: [{ trackingNumber: { not: null } }, { NOT: { trackingNumber: '' } }],
          },
        },
      },
      {
        outboundOrder: {
          is: { carrierShipments: { some: createdShipment } },
        },
      },
    ],
  };
}

function shipmentNotSentWhere(): Prisma.OmsOrderWhereInput {
  return {
    AND: [
      { OR: [{ trackingNumber: null }, { trackingNumber: '' }] },
      {
        outboundOrder: {
          is: {
            AND: [
              { OR: [{ trackingNumber: null }, { trackingNumber: '' }] },
              { carrierShipments: { none: createdShipment } },
            ],
          },
        },
      },
    ],
  };
}

/** Orders whose operational stage matches: picking/packing under processing, shipping stages under ready_to_ship. */
export function buildOperationalStageWhere(
  stage: OmsOperationalStage,
): Prisma.OmsOrderWhereInput {
  const processing: Prisma.OmsOrderWhereInput = {
    status: { in: OMS_LIST_STATUS_EXPANSIONS[OmsOrderStatus.processing] },
  };
  const readyToShip: Prisma.OmsOrderWhereInput = {
    status: { in: OMS_LIST_STATUS_EXPANSIONS[OmsOrderStatus.ready_to_ship] ?? [OmsOrderStatus.ready_to_ship] },
  };

  if (stage === 'picking') {
    return {
      AND: [
        processing,
        { outboundOrder: { is: { status: { in: PICKING_OUTBOUND_STATUSES } } } },
      ],
    };
  }

  if (stage === 'packing') {
    return {
      AND: [
        processing,
        { outboundOrder: { is: { status: OutboundOrderStatus.packing } } },
      ],
    };
  }

  const shippingStatus: Prisma.OmsOrderWhereInput = {
    outboundOrder: { is: { status: { in: SHIPPING_DETAILS_OUTBOUND_STATUSES } } },
  };

  if (stage === 'shipping_details') {
    return { AND: [readyToShip, shippingStatus, shipmentNotSentWhere()] };
  }

  return { AND: [readyToShip, shippingStatus, shipmentSentWhere()] };
}
