import * as crypto from 'crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CarrierShipmentStatus,
  OmsOrderStatus,
  OutboundOrderStatus,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  NormalizedTrackingEvent,
  NormalizedTrackingStatus,
  ShipmentTrackingResult,
  ShippingCancelResult,
  ShippingCredentials,
  ShippingProvider,
} from './shipping-provider.interface';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingAutoReturnService } from './shipping-auto-return.service';
import {
  courierIdFromServiceId,
  extractSilaApiLookupKeys,
  extractSilaCarrierAwb,
  extractSilaCourier,
  extractSilaProviderId,
} from './providers/sila-sy/sila-identifiers';
import {
  ACTIVE_CARRIER_SHIPMENT_WHERE,
  carrierUnlinkPatch,
  confirmedCourierReassignment,
  isAwbPendingReassignment,
  isActiveCarrierShipment,
  isSilaPendingCancelMeta,
  mayUnlockToShippingDetails,
  omsStatusAfterPreDispatchUnlock,
  outboundStatusAfterPreDispatchUnlock,
  shouldApplyTrackingToOrder,
} from './shipping-lifecycle.util';
import {
  displayNameForProviderCode,
  normalizeCourierDisplayName,
  registerCourierName,
  resolveShippingCarrierName,
} from './shipping-carrier-resolver';
import {
  applyConfirmedCarrierAwbToMeta,
  mergeShipmentRawMeta,
  readSilaCancelMeta,
  withSilaCancelMeta,
  type SilaCancelMeta,
} from './providers/sila-sy/sila-meta.util';
import { SILA_SY_CODE } from './shipping.constants';
import { decideCarrierCostUpdate } from './carrier-cost.update';
import { snapshotOnEnteringCancelled } from '../oms/oms-cancel-revert';
import {
  inactiveShipmentState,
  isProviderLookupNotFoundEvent,
  type ShipmentLookupState,
} from './shipping-lookup.util';

export type CancelShipmentResult = {
  success: boolean;
  status: 'cancelled' | 'pending_confirmation' | 'unsupported' | 'refused' | 'error';
  message: string;
  orderId: string;
  orderNumber: string;
  providerCode?: string | null;
  carrierName?: string | null;
  awb?: string | null;
  errorCode?: string | null;
};

function shipmentLookupOr(value: string) {
  return [
    { externalAwb: value },
    { trackingNumber: value },
    { rawResultMeta: { path: ['id'], equals: value } },
    { rawResultMeta: { path: ['shipment_number'], equals: value } },
    { rawResultMeta: { path: ['shipment_reference'], equals: value } },
    { rawResultMeta: { path: ['tracking_token'], equals: value } },
    { rawResultMeta: { path: ['barcode'], equals: value } },
    { rawResultMeta: { path: ['shipments', '0', 'tracking_number'], equals: value } },
  ];
}

const STATUS_PROGRESS_RANK: Record<string, number> = {
  draft: 0,
  pending: 0,
  processing: 1,
  allocated: 1,
  picking: 1,
  packing: 1,
  ready_to_ship: 1,
  waiting_for_shipping_details: 1,
  shipped: 2,
  out_for_delivery: 3,
  failed_delivery: 3,
  return_pending_receipt: 4,
  delivered: 4,
  returned: 4,
  cancelled: 4,
};

const LEFT_WAREHOUSE_STATUSES = new Set<string>([
  OmsOrderStatus.shipped,
  OmsOrderStatus.out_for_delivery,
  OmsOrderStatus.failed_delivery,
  OmsOrderStatus.return_pending_receipt,
  OmsOrderStatus.delivered,
  OmsOrderStatus.returned,
  OutboundOrderStatus.shipped,
  OutboundOrderStatus.out_for_delivery,
  OutboundOrderStatus.delivered,
  OutboundOrderStatus.returned,
]);

@Injectable()
export class ShippingTrackingService {
  private readonly logger = new Logger(ShippingTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ShippingProviderRegistry,
    private readonly autoReturn: ShippingAutoReturnService,
    private readonly realtime: RealtimeService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Processes a normalized tracking event idempotently, updates OMS and Outbound order
   * statuses safely, prevents status regression, and triggers automated returns if applicable.
   */
  async processTrackingEvent(
    event: NormalizedTrackingEvent,
  ): Promise<{ success: boolean; action: string; orderId?: string; message?: string }> {
    const rawPayload = event.rawPayload ?? {};
    const payloadHash = crypto
      .createHash('sha256')
      .update(typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload))
      .digest('hex');

    const trimmedAwb = event.awb.trim();

    // 1. Idempotency Check
    const existingEvent = await this.prisma.carrierShipmentEvent.findFirst({
      where: {
        providerCode: event.providerCode,
        OR: [
          ...(event.externalEventId ? [{ externalEventId: event.externalEventId }] : []),
          ...(event.deliveryId ? [{ externalEventId: `sila-delivery:${event.deliveryId}` }] : []),
          { awb: trimmedAwb, payloadHash },
        ],
      },
      select: { id: true, status: true },
    });

    if (existingEvent && existingEvent.status === 'processed') {
      this.logger.log(`Skipping duplicate tracking event for awb=${event.awb}, type=${event.eventType}`);
      return { success: true, action: 'skipped_duplicate' };
    }

    // 2. Find Carrier Shipment
    const carrierShipment = await this.prisma.carrierShipment.findFirst({
      where: {
        OR: [
          ...shipmentLookupOr(trimmedAwb),
          { externalAwb: { contains: trimmedAwb, mode: 'insensitive' } },
          ...(event.reference?.trim()
            ? [
                { outboundOrder: { orderNumber: event.reference.trim() } },
                { outboundOrder: { omsOrder: { orderNumber: event.reference.trim() } } },
              ]
            : []),
        ],
      },
      include: {
        outboundOrder: {
          include: {
            omsOrder: true,
          },
        },
      },
    });

    let outbound: any = carrierShipment?.outboundOrder ?? null;
    let omsOrder: any = outbound?.omsOrder ?? null;
    let companyId = outbound?.companyId || omsOrder?.companyId;

    if (!carrierShipment) {
      const directOmsOrder = await this.prisma.omsOrder.findFirst({
        where: {
          OR: [
            { trackingNumber: trimmedAwb },
            { trackingNumber: { contains: trimmedAwb, mode: 'insensitive' } },
            ...(event.reference?.trim()
              ? [{ orderNumber: event.reference.trim() }]
              : []),
          ],
        },
        include: {
          outboundOrder: true,
        },
      });

      if (directOmsOrder) {
        omsOrder = directOmsOrder;
        outbound = directOmsOrder.outboundOrder ?? null;
        companyId = directOmsOrder.companyId;
      }
    }

    if (!carrierShipment && !omsOrder) {
      this.logger.warn(`No carrier shipment or OMS order found matching AWB "${trimmedAwb}". Logging unlinked event.`);
      await this.prisma.carrierShipmentEvent.create({
        data: {
          providerCode: event.providerCode,
          externalEventId: event.externalEventId,
          awb: trimmedAwb,
          eventType: event.eventType,
          normalizedStatus: event.normalizedStatus,
          status: 'unmatched_awb',
          payloadHash,
          payload: rawPayload as any,
          errorMessage: 'No matching carrier shipment or OMS order found for this AWB.',
          processedAt: new Date(),
        },
      });
      return { success: false, action: 'unmatched_awb', message: 'No shipment found for AWB' };
    }

    if (!omsOrder && carrierShipment) {
      this.logger.warn(`Shipment ${carrierShipment.id} is not linked to an OMS order.`);
    }

    if (carrierShipment && !shouldApplyTrackingToOrder(carrierShipment)) {
      const storedExternalEventId = event.deliveryId
        ? `sila-delivery:${event.deliveryId}`
        : event.externalEventId;
      await this.prisma.carrierShipmentEvent.create({
        data: {
          carrierShipmentId: carrierShipment.id,
          providerCode: event.providerCode,
          externalEventId: storedExternalEventId,
          awb: trimmedAwb,
          eventType: event.eventType,
          normalizedStatus: event.normalizedStatus,
          status: 'ignored_superseded',
          payloadHash,
          payload: rawPayload as any,
          processedAt: new Date(),
        },
      });
      this.logger.log(
        `Ignored stale tracking event for superseded shipment ${carrierShipment.id} awb=${trimmedAwb}`,
      );
      return {
        success: true,
        action: 'ignored_superseded_shipment',
        orderId: omsOrder?.id,
        message: 'Event stored on the old shipment and did not update the live order.',
      };
    }

    if (isProviderLookupNotFoundEvent(event)) {
      return this.persistUnconfirmedProviderLookup({
        event,
        carrierShipment,
        omsOrder,
        trimmedAwb,
        payloadHash,
        rawPayload,
      });
    }

    const preOfd = this.isPreOfd(omsOrder?.status, outbound?.status);
    const problemStatuses: NormalizedTrackingStatus[] = [
      'cancelled',
      'delivery_failed',
      'return_created',
      'returning_to_sender',
      'returned_to_sender',
      'returned',
    ];
    const isCarrierProblem = problemStatuses.includes(event.normalizedStatus);

    // 3. Monotonic Status Progression Check
    const currentOmsStatus = omsOrder?.status || 'ready_to_ship';
    const currentRank = STATUS_PROGRESS_RANK[currentOmsStatus] ?? 0;
    const effectiveTarget = this.targetOmsStatus(event.normalizedStatus, preOfd);
    const incomingRank = STATUS_PROGRESS_RANK[effectiveTarget] ?? 0;

    const isReturnEvent = [
      'return_created',
      'returning_to_sender',
      'returned_to_sender',
      'returned',
    ].includes(event.normalizedStatus);

    let shouldUpdateStatus = true;
    // Pre-OFD carrier problems unlock shipping — never blocked as "regression".
    if (!(preOfd && isCarrierProblem)) {
      if (
        incomingRank < currentRank &&
        (currentRank >= 4 || currentOmsStatus === 'delivered' || currentOmsStatus === 'returned')
      ) {
        this.logger.warn(
          `Prevented status regression for order ${omsOrder?.orderNumber}: current=${currentOmsStatus} (rank ${currentRank}), incoming=${event.normalizedStatus} (rank ${incomingRank})`,
        );
        shouldUpdateStatus = false;
      }
    }

    // 4. State Transitions & Business Operations
    let actionTaken = `tracking_recorded:${event.normalizedStatus}`;
    const applyReturn =
      Boolean(omsOrder) && isReturnEvent && !(preOfd && isCarrierProblem);
    if (shouldUpdateStatus && omsOrder) {
      if (preOfd && isCarrierProblem) {
        const silaPending =
          event.providerCode === SILA_SY_CODE &&
          event.normalizedStatus === 'cancelled' &&
          isSilaPendingCancelMeta(carrierShipment?.rawResultMeta);
        if (silaPending) {
          actionTaken = 'sila_cancel_pending_ignored_cargo_cancelled';
        } else {
          actionTaken = await this.handlePreDispatchCarrierFailure({
            event,
            omsOrder,
            outbound,
            carrierShipment,
            trimmedAwb,
          });
        }
      } else {
        switch (event.normalizedStatus) {
          case 'in_transit': {
            // Provider acceptance / in-transit never infers Ready to Ship or physical handover.
            actionTaken = 'tracking_recorded:in_transit';
            break;
          }

          case 'out_for_delivery': {
            if (preOfd) {
              actionTaken = 'tracking_recorded:out_for_delivery';
              break;
            }
            const wasFailed =
              omsOrder.status === OmsOrderStatus.failed_delivery ||
              omsOrder.status === OmsOrderStatus.return_pending_receipt;
            await this.prisma.omsOrder.update({
              where: { id: omsOrder.id },
              data: {
                status: OmsOrderStatus.out_for_delivery,
                outForDeliveryAt: omsOrder.outForDeliveryAt || new Date(),
              },
            });
            if (outbound) {
              await this.prisma.outboundOrder.update({
                where: { id: outbound.id },
                data: {
                  status: OutboundOrderStatus.out_for_delivery,
                  outForDeliveryAt: outbound.outForDeliveryAt || new Date(),
                },
              });
            }
            if (wasFailed) {
              await this.autoReturn.cancelUnconfirmedDraftReturns({
                omsOrderId: omsOrder.id,
                companyId,
                reason: `Auto-cancelled: carrier resumed out-for-delivery for AWB ${trimmedAwb}.`,
              });
              actionTaken = 'order_out_for_delivery_draft_return_cancelled';
            } else {
              actionTaken = 'order_out_for_delivery';
            }
            break;
          }

          case 'delivery_failed': {
            await this.prisma.omsOrder.update({
              where: { id: omsOrder.id },
              data: {
                status: OmsOrderStatus.failed_delivery,
                deliveryFailedAt: omsOrder.deliveryFailedAt || new Date(),
              },
            });
            await this.autoReturn.cancelUnconfirmedDraftReturns({
              omsOrderId: omsOrder.id,
              companyId,
              reason: 'Auto-cancelled: Field Delivery is not a return.',
            });
            actionTaken = 'order_delivery_failed';
            break;
          }

          case 'cancelled': {
            actionTaken = await this.applyIncomingCancel({
              event,
              omsOrder,
              outbound,
              carrierShipment,
            });
            break;
          }

          case 'delivered': {
            const res = await this.autoReturn.handleCarrierDeliveredEvent({
              omsOrderId: omsOrder.id,
              awb: trimmedAwb,
              timestamp: event.timestamp || new Date(),
              notes: event.notes,
            });
            actionTaken = res.actionTaken;
            break;
          }

          default:
            break;
        }
      }
    }

    if (applyReturn && omsOrder) {
      const rolledBackReturn = await this.prisma.omsReturn?.findFirst({
        where: {
          omsOrderId: omsOrder.id,
          status: 'cancelled',
          notes: { contains: 'Rollback executed' },
        },
        select: { id: true, returnNumber: true },
      });

      if (rolledBackReturn) {
        this.logger.warn(
          `Ignoring stale carrier return webhook (${event.normalizedStatus}) for order ${omsOrder.orderNumber}: return ${rolledBackReturn.returnNumber} was already rolled back.`,
        );
        actionTaken = 'ignored_rolled_back_return';
      } else {
        let stage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' =
          'returned_to_sender';
        if (event.carrierReturnStage) {
          stage = event.carrierReturnStage;
        } else if (event.normalizedStatus === 'return_created') {
          stage = 'return_created';
        } else if (event.normalizedStatus === 'returning_to_sender') {
          stage = 'returning_to_sender';
        }

        const res = await this.autoReturn.processCarrierReturnEvent({
          omsOrderId: omsOrder.id,
          awb: trimmedAwb,
          stage,
          reason: event.returnReason || event.notes,
          originalStatus: event.originalCarrierStatus || event.eventType,
          timestamp: event.timestamp || new Date(),
        });
        actionTaken = res.success ? `carrier_return_${stage}` : 'carrier_return_failed';
      }
    }

    // 5. Record Event Audit Entry
    const storedExternalEventId = event.deliveryId
      ? `sila-delivery:${event.deliveryId}`
      : event.externalEventId;
    await this.prisma.carrierShipmentEvent.create({
      data: {
        carrierShipmentId: carrierShipment?.id ?? null,
        providerCode: event.providerCode,
        externalEventId: storedExternalEventId,
        awb: trimmedAwb,
        eventType: event.eventType,
        normalizedStatus: event.normalizedStatus,
        originalCarrierStatus: event.originalCarrierStatus || event.eventType,
        eventDescription: event.eventDescription || event.notes || null,
        eventTimestamp: event.timestamp || new Date(),
        sourceType: event.sourceType || 'webhook',
        isCarrierEvent: event.isCarrierEvent ?? true,
        locationText: event.locationText || null,
        notes: event.notes || null,
        status: 'processed',
        payloadHash,
        payload: rawPayload as any,
        processedAt: new Date(),
      },
    });

    // After a verified pre-dispatch cancel the live order is unlinked. Do not write
    // identifiers from the superseded cargo back onto the order.
    if (
      carrierShipment?.providerCode === SILA_SY_CODE &&
      actionTaken !== 'pre_dispatch_carrier_failure_unlocked'
    ) {
      const previousAwb = carrierShipment.trackingNumber ?? null;
      await this.persistSilaCarrierAwb(carrierShipment, outbound, omsOrder, event.rawPayload);
      await this.persistConfirmedSilaCourier(
        carrierShipment,
        outbound,
        omsOrder,
        event.rawPayload,
        previousAwb,
      );
    }

    // 6. Update Shipment Metadata if linked (skip if pre-dispatch already marked failed)
    if (carrierShipment && !(preOfd && isCarrierProblem)) {
      await this.prisma.carrierShipment.update({
        where: { id: carrierShipment.id },
        data: {
          lastTrackingStatus: event.normalizedStatus,
          originalCarrierStatus: event.originalCarrierStatus || event.eventType,
          originalCarrierDescription: event.eventDescription || event.notes || null,
          lastTrackingAt: new Date(),
        },
      });
      await this.applyVerifiedCarrierCost(carrierShipment, event);
    }

    // 7. Audit log in OMS Order Events
    if (omsOrder && companyId) {
      await this.prisma.omsOrderEvent.create({
        data: {
          omsOrderId: omsOrder.id,
          companyId,
          eventType: `carrier.tracking.${event.normalizedStatus}`,
          createdBy: omsOrder.createdBy,
          payload: {
            providerCode: event.providerCode,
            awb: trimmedAwb,
            eventType: event.eventType,
            actionTaken,
            notes: event.notes,
            location: event.locationText,
            preOfd,
          },
        },
      });

      this.realtime.emitOmsOrderEvent(companyId, {
        orderId: omsOrder.id,
        status: omsOrder.status,
        event: 'carrier.tracking_updated',
      });
    }

    this.logger.log(
      `Successfully processed tracking event for order=${omsOrder?.orderNumber ?? outbound?.orderNumber ?? trimmedAwb}: action=${actionTaken}`,
    );

    return {
      success: true,
      action: actionTaken,
      orderId: omsOrder?.id,
    };
  }

  /**
   * Stores a verified carrier cost on the shipment only.
   * Never writes oms/outbound shippingFee (the client rate) or shippingQuotedPrice.
   */
  private async applyVerifiedCarrierCost(
    carrierShipment: { id: string; shippingCost?: unknown; currency?: string | null; shippingCostEventAt?: Date | null },
    event: NormalizedTrackingEvent,
  ): Promise<string> {
    const applied = await this.prisma.carrierCostChange.findMany({
      where: {
        carrierShipmentId: carrierShipment.id,
        applied: true,
        externalEventId: { not: null },
      },
      select: { externalEventId: true },
    });
    const currentAmount =
      carrierShipment.shippingCost == null ? null : Number(carrierShipment.shippingCost);
    const decision = decideCarrierCostUpdate({
      providerCode: event.providerCode,
      raw: event.rawPayload,
      externalEventId: event.externalEventId,
      eventAt: event.timestamp ?? null,
      stored: {
        amount: currentAmount != null && Number.isFinite(currentAmount) ? currentAmount : null,
        currency: carrierShipment.currency ?? null,
        eventAt: carrierShipment.shippingCostEventAt ?? null,
        appliedEventIds: applied
          .map((row) => row.externalEventId)
          .filter((id): id is string => Boolean(id)),
      },
    });
    if (decision.action !== 'applied') return decision.action;

    const eventAt = event.timestamp ?? new Date();
    await this.prisma.carrierShipment.update({
      where: { id: carrierShipment.id },
      data: {
        shippingCost: decision.amount,
        ...(decision.currency ? { currency: decision.currency } : {}),
        shippingCostEventAt: eventAt,
        shippingCostSource: event.costSource ?? 'webhook',
      },
    });
    await this.prisma.carrierCostChange.create({
      data: {
        carrierShipmentId: carrierShipment.id,
        previousAmount: decision.previousAmount,
        previousCurrency: decision.previousCurrency,
        amount: decision.amount,
        currency: decision.currency,
        providerCode: event.providerCode,
        externalEventId: event.externalEventId ?? null,
        eventAt,
        source: event.costSource ?? 'webhook',
        applied: true,
      },
    });
    return 'carrier_cost_updated';
  }

  private async persistUnconfirmedProviderLookup(params: {
    event: NormalizedTrackingEvent;
    carrierShipment: any;
    omsOrder: any;
    trimmedAwb: string;
    payloadHash: string;
    rawPayload: unknown;
  }): Promise<{ success: boolean; action: string; orderId?: string; message?: string }> {
    const { event, carrierShipment, omsOrder, trimmedAwb, payloadHash, rawPayload } = params;
    const storedExternalEventId = event.externalEventId;
    await this.prisma.carrierShipmentEvent.create({
      data: {
        carrierShipmentId: carrierShipment?.id ?? null,
        providerCode: event.providerCode,
        externalEventId: storedExternalEventId,
        awb: trimmedAwb,
        eventType: event.eventType,
        normalizedStatus: event.normalizedStatus,
        status: 'processed',
        payloadHash,
        payload: rawPayload as any,
        processedAt: new Date(),
      },
    });
    if (carrierShipment?.id) {
      await this.prisma.carrierShipment.update({
        where: { id: carrierShipment.id },
        data: {
          lastTrackingAt: new Date(),
          lastErrorSafe: 'Provider lookup returned Shipment not found. Cancellation is not confirmed.',
          rawResultMeta: mergeShipmentRawMeta(carrierShipment.rawResultMeta, {
            babelLookup: {
              state: 'not_found' satisfies ShipmentLookupState,
              at: new Date().toISOString(),
              errorMessage: event.notes || 'Shipment not found',
            },
          }) as any,
        },
      });
    }
    return {
      success: true,
      action: 'provider_lookup_not_found',
      orderId: omsOrder?.id,
      message: 'Provider did not return this shipment. Cancellation is not confirmed.',
    };
  }

  async getLocalShipmentMovement(params: {
    shipment: {
      id: string;
      status?: string | null;
      supersededAt?: Date | string | null;
      trackingNumber?: string | null;
      externalAwb?: string | null;
      providerCode?: string | null;
      lastErrorSafe?: string | null;
    };
    providerName?: string | null;
  }): Promise<ShipmentTrackingResult> {
    const { shipment, providerName } = params;
    const shipmentState = inactiveShipmentState(shipment);
    const events = await this.prisma.carrierShipmentEvent.findMany({
      where: { carrierShipmentId: shipment.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        createdAt: true,
        processedAt: true,
        eventTimestamp: true,
        eventType: true,
        normalizedStatus: true,
        originalCarrierStatus: true,
        eventDescription: true,
        locationText: true,
        notes: true,
        sourceType: true,
        isCarrierEvent: true,
        awb: true,
      },
    });
    const awb = (shipment.trackingNumber || shipment.externalAwb || '').trim();
    const historical =
      shipmentState === 'superseded'
        ? 'This shipment was replaced and is no longer the active carrier assignment.'
        : 'This shipment is no longer active. Historical AWB is kept for audit.';
    return {
      providerCode: shipment.providerCode || 'UNKNOWN',
      providerName: providerName || shipment.providerCode || 'Carrier',
      awb,
      events: events.map((row) => ({
        timestamp: (row.eventTimestamp || row.processedAt || row.createdAt).toISOString(),
        title: row.eventDescription || row.originalCarrierStatus || row.eventType,
        originalDescription: row.eventDescription || row.originalCarrierStatus || null,
        location: row.locationText || null,
        notes: row.notes || row.normalizedStatus,
        color: shipmentState === 'superseded' ? 'warning' : 'info',
        code: row.originalCarrierStatus || row.normalizedStatus,
        source: row.isCarrierEvent ? ('carrier' as const) : ('emdad' as const),
      })),
      shipmentState,
      lookupState: 'ok',
      cancellationUnconfirmed: false,
      message: historical,
    };
  }

  /**
   * True while goods are still in warehouse (not yet shipped / OFD / failed / delivered).
   */
  isPreOfd(omsStatus?: string | null, outboundStatus?: string | null): boolean {
    if (omsStatus && LEFT_WAREHOUSE_STATUSES.has(omsStatus)) return false;
    if (outboundStatus && LEFT_WAREHOUSE_STATUSES.has(outboundStatus)) return false;
    return true;
  }

  /**
   * Carrier cancelled/failed before goods left the warehouse:
   * supersede shipment, undo confirm, unlock shipping, flag batch row red.
   */
  private async handlePreDispatchCarrierFailure(params: {
    event: NormalizedTrackingEvent;
    omsOrder: any;
    outbound: any;
    carrierShipment: any;
    trimmedAwb: string;
  }): Promise<string> {
    const { event, omsOrder, outbound, carrierShipment, trimmedAwb } = params;
    const reason =
      (event.returnReason || event.notes || event.originalCarrierStatus || event.eventType || 'cancelled')
        .toString()
        .trim()
        .slice(0, 400);
    const carrierLabel =
      (omsOrder.carrier || outbound?.carrier || event.providerCode || 'Carrier').toString().trim();
    const issueNote =
      `Provider cancelled: ${reason} | Carrier: ${carrierLabel} | AWB: ${trimmedAwb}`.slice(0, 500);

    const now = new Date();
    if (carrierShipment) {
      await this.prisma.carrierShipment.update({
        where: { id: carrierShipment.id },
        data: {
          status: CarrierShipmentStatus.failed,
          supersededAt: now,
          lastTrackingStatus: event.normalizedStatus,
          lastTrackingAt: now,
          lastErrorSafe: issueNote,
          nextPollAt: null,
        },
      });
    }

    // Mark any other created shipments on this outbound as failed too.
    if (outbound?.id) {
      await this.prisma.carrierShipment.updateMany({
        where: {
          outboundOrderId: outbound.id,
          status: CarrierShipmentStatus.created,
          ...(carrierShipment ? { id: { not: carrierShipment.id } } : {}),
        },
        data: {
          status: CarrierShipmentStatus.failed,
          supersededAt: now,
          lastErrorSafe: issueNote,
          nextPollAt: null,
        },
      });
    }

    const unlink = carrierUnlinkPatch();
    if (outbound?.id && mayUnlockToShippingDetails(omsOrder.status)) {
      const outboundData: Record<string, unknown> = {
        ...unlink,
        status: outboundStatusAfterPreDispatchUnlock(outbound.status),
      };
      await this.prisma.outboundOrder.update({
        where: { id: outbound.id },
        data: outboundData,
      });
    }

    if (mayUnlockToShippingDetails(omsOrder.status)) {
      await this.prisma.omsOrder.update({
        where: { id: omsOrder.id },
        data: {
          ...unlink,
          status: omsStatusAfterPreDispatchUnlock(omsOrder.status),
        },
      });
    }

    // Auto-flag every active batch membership for this order (red row).
    await this.prisma.omsBatchOrder.updateMany({
      where: {
        omsOrderId: omsOrder.id,
        removedAt: null,
      },
      data: { issueNote },
    });

    this.logger.warn(
      `Pre-dispatch carrier failure for order=${omsOrder.orderNumber} awb=${trimmedAwb}: unlocked shipping + batch issueNote`,
    );

    return 'pre_dispatch_carrier_failure_unlocked';
  }

  /**
   * Polls live tracking status for an active shipment by AWB and updates the system.
   */
  async syncShipmentByAwb(
    awb: string,
    providerCode?: string,
  ): Promise<{ success: boolean; event?: NormalizedTrackingEvent; message?: string }> {
    const trimmed = awb.trim();
    if (!trimmed) return { success: false, message: 'AWB required' };

    const shipment = await this.prisma.carrierShipment.findFirst({
      where: {
        OR: shipmentLookupOr(trimmed),
      },
      include: {
        provider: {
          include: { connection: true },
        },
      },
    });

    if (!shipment) {
      return { success: false, message: 'Shipment not found for this AWB' };
    }

    const code = providerCode || shipment.providerCode;
    const adapter = this.registry.get(code);
    if (!adapter || !adapter.pollTracking) {
      return { success: false, message: `Provider ${code} does not support tracking polling.` };
    }

    const connection = shipment.provider.connection;
    if (!connection || connection.status !== 'connected' || !connection.encryptedUsername) {
      return { success: false, message: `Provider ${code} is not connected.` };
    }

    const credentials: ShippingCredentials = {
      username: this.encryption.decrypt(connection.encryptedUsername),
      password: connection.encryptedPassword ? this.encryption.decrypt(connection.encryptedPassword) : '',
    };

    const trackingEvent = await adapter.pollTracking(credentials, trimmed);
    if (!trackingEvent) {
      return { success: false, message: 'No new tracking information returned by provider.' };
    }
    trackingEvent.costSource = 'poll';

    const result = await this.processTrackingEvent(trackingEvent);
    return {
      success: result.success,
      event: trackingEvent,
      message: result.action,
    };
  }

  /**
   * Retrieves shipment movement events from the integrated carrier API.
   * Gracefully falls back when provider is not configured or fails.
   */
  async getShipmentTrackingHistory(params: {
    awb: string;
    providerCode?: string | null;
    carrierName?: string | null;
  }): Promise<ShipmentTrackingResult> {
    const trimmed = (params.awb || '').trim();
    if (!trimmed) {
      return {
        providerCode: params.providerCode || 'UNKNOWN',
        providerName: params.carrierName || 'Unknown Carrier',
        awb: '',
        events: [],
        message: 'لا توجد بيانات لحركة الشحنة حالياً.',
      };
    }

    let code = (params.providerCode || '').toUpperCase().trim();
    const carrierName = (params.carrierName || '').toLowerCase().trim();

    if (!code) {
      if (carrierName.includes('babel')) {
        code = 'BABEL_EXPRESS';
      } else if (
        carrierName.includes('sila') ||
        carrierName.includes('مسارات') ||
        carrierName.includes('ترابط') ||
        carrierName.includes('ديليفرو') ||
        carrierName.includes('masarat')
      ) {
        code = 'SILA_SY';
      }
    }

    if (!code) {
      const shipment = await this.prisma.carrierShipment.findFirst({
        where: {
          OR: shipmentLookupOr(trimmed),
        },
        select: { providerCode: true },
      });
      if (shipment?.providerCode) {
        code = shipment.providerCode;
      }
    }

    if (!code) {
      return {
        providerCode: 'UNKNOWN',
        providerName: params.carrierName || 'Carrier',
        awb: trimmed,
        events: [],
        message: 'لا توجد بيانات لحركة الشحنة من شركة الشحن.',
      };
    }

    let adapter;
    try {
      adapter = this.registry.get(code);
    } catch {
      return {
        providerCode: code,
        providerName: params.carrierName || code,
        awb: trimmed,
        events: [],
        message: 'لا توجد بيانات لحركة الشحنة من شركة الشحن.',
      };
    }

    if (!adapter || !adapter.getTrackingHistory) {
      return {
        providerCode: code,
        providerName: params.carrierName || code,
        awb: trimmed,
        events: [],
        message: 'لا توجد بيانات لحركة الشحنة من شركة الشحن.',
      };
    }

    const connection = await this.prisma.shippingProviderConnection.findFirst({
      where: { provider: { code } },
    });

    if (!connection || connection.status !== 'connected' || !connection.encryptedUsername) {
      return {
        providerCode: code,
        providerName: params.carrierName || code,
        awb: trimmed,
        events: [],
        message: 'شركة الشحن غير متصلة بالنظام حالياً.',
      };
    }

    try {
      const credentials: ShippingCredentials = {
        username: this.encryption.decrypt(connection.encryptedUsername),
        password: connection.encryptedPassword ? this.encryption.decrypt(connection.encryptedPassword) : '',
      };

      const result = await adapter.getTrackingHistory(credentials, trimmed);
      if (!result) {
        return {
          providerCode: code,
          providerName: params.carrierName || code,
          awb: trimmed,
          events: [],
          message: 'لا توجد بيانات لحركة الشحنة من شركة الشحن.',
        };
      }
      const withHistory = await this.withSilaAlternateHistory(
        adapter,
        credentials,
        code,
        trimmed,
        result,
      );
      return this.finalizeTrackingHistoryIdentity(code, trimmed, params.carrierName, withHistory);
    } catch (err: any) {
      this.logger.error(`Error querying tracking history for awb=${trimmed}, provider=${code}: ${err?.message}`);
      return {
        providerCode: code,
        providerName: params.carrierName || code,
        awb: trimmed,
        events: [],
        error: 'تعذر الحصول على حركة الشحنة من شركة الشحن حالياً.',
      };
    }
  }

  /**
   * Incoming Sila cancel completes OMS only when Emdad did not already store
   * pending_confirmation. Babel post-OFD cancel stays failed_delivery.
   */
  private async applyIncomingCancel(params: {
    event: NormalizedTrackingEvent;
    omsOrder: any;
    outbound: any;
    carrierShipment: any;
  }): Promise<string> {
    const { event, omsOrder, outbound, carrierShipment } = params;
    if (event.providerCode === SILA_SY_CODE) {
      const pending = readSilaCancelMeta(carrierShipment?.rawResultMeta);
      if (pending?.state === 'pending_confirmation') {
        return 'sila_cancel_pending_ignored_cargo_cancelled';
      }
      if (
        omsOrder.status === OmsOrderStatus.delivered ||
        omsOrder.status === OmsOrderStatus.returned ||
        omsOrder.status === OmsOrderStatus.cancelled
      ) {
        return 'sila_cancel_ignored_terminal_oms';
      }
      const snap = snapshotOnEnteringCancelled(omsOrder.status, outbound?.status ?? null);
      await this.prisma.omsOrder.update({
        where: { id: omsOrder.id },
        data: {
          status: OmsOrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelledFromStatus: snap.cancelledFromStatus,
          cancelledFromOutboundStatus: snap.cancelledFromOutboundStatus,
        },
      });
      if (outbound?.id && outbound.status !== OutboundOrderStatus.cancelled) {
        await this.prisma.outboundOrder.update({
          where: { id: outbound.id },
          data: { status: OutboundOrderStatus.cancelled },
        });
      }
      if (carrierShipment?.id) {
        await this.writeSilaCancelMeta(carrierShipment.id, carrierShipment.rawResultMeta, null);
      }
      return 'order_cancelled_from_sila';
    }

    await this.prisma.omsOrder.update({
      where: { id: omsOrder.id },
      data: {
        status: OmsOrderStatus.failed_delivery,
        deliveryFailedAt: omsOrder.deliveryFailedAt || new Date(),
      },
    });
    return 'order_carrier_cancelled_failed_delivery';
  }

  /**
   * One Sila cancel PUT from an operator action. Repeat while pending is GET-only.
   */
  async requestSilaCancel(params: {
    outboundOrderId?: string | null;
    orderNumber?: string | null;
  }): Promise<ShippingCancelResult | null> {
    if (!params.outboundOrderId) return null;
    const shipment = await this.prisma.carrierShipment.findFirst({
      where: {
        outboundOrderId: params.outboundOrderId,
        providerCode: SILA_SY_CODE,
        status: CarrierShipmentStatus.created,
      },
      orderBy: { createdAt: 'desc' },
      include: { provider: { include: { connection: true } } },
    });
    if (!shipment) return null;

    const silaId = (shipment.externalAwb || '').trim();
    if (!silaId) {
      return {
        outcome: 'refused',
        errorCode: 'missing_sila_id',
        message: 'This Sila shipment has no cargo id yet, so it cannot be cancelled at Sila.',
      };
    }

    const pending = readSilaCancelMeta(shipment.rawResultMeta);
    const credentials = this.credentialsFromConnection(shipment.provider.connection);
    const adapter = this.registry.get(SILA_SY_CODE);
    if (!credentials || !adapter) {
      return {
        outcome: 'refused',
        errorCode: 'sila_not_connected',
        message: 'Sila-SY is not connected.',
      };
    }

    if (pending?.state === 'pending_confirmation') {
      if (!adapter.pollTracking) {
        return {
          outcome: 'pending_confirmation',
          courierCancel: pending.courierCancel,
          message: pending.message || 'Cancellation is still waiting for the courier.',
        };
      }
      const latest = await adapter.pollTracking(credentials, silaId);
      const cargoStatus = String(
        (latest?.rawPayload as { status?: string } | null)?.status ||
          latest?.originalCarrierStatus ||
          '',
      ).toLowerCase();
      // Guide: cargo.cancelled after pending_confirmation is not courier confirmation.
      return {
        outcome: 'pending_confirmation',
        courierCancel: pending.courierCancel,
        cargoStatus,
        message:
          pending.message ||
          'Cancellation is still waiting for the courier. The OMS order is not cancelled.',
      };
    }

    if (!adapter.cancelShipment) {
      return {
        outcome: 'refused',
        errorCode: 'cancel_unsupported',
        message: 'Sila cancel is not available.',
      };
    }

    const result = await adapter.cancelShipment(credentials, silaId);
    if (result.outcome === 'pending_confirmation') {
      await this.writeSilaCancelMeta(shipment.id, shipment.rawResultMeta, {
        state: 'pending_confirmation',
        courierCancel: result.courierCancel,
        message: result.message,
        at: new Date().toISOString(),
      });
    } else if (result.outcome === 'cancelled' || result.outcome === 'already_cancelled') {
      await this.writeSilaCancelMeta(shipment.id, shipment.rawResultMeta, {
        state: result.outcome,
        courierCancel: result.courierCancel,
        message: result.message,
        at: new Date().toISOString(),
      });
    }
    return result;
  }

  async clearSilaCancelMeta(carrierShipmentId: string, previous: unknown): Promise<void> {
    await this.writeSilaCancelMeta(carrierShipmentId, previous, null);
  }

  private async writeSilaCancelMeta(
    carrierShipmentId: string,
    previous: unknown,
    silaCancel: SilaCancelMeta | null,
  ): Promise<void> {
    const latest = await this.prisma.carrierShipment.findUnique({
      where: { id: carrierShipmentId },
      select: { rawResultMeta: true },
    });
    await this.prisma.carrierShipment.update({
      where: { id: carrierShipmentId },
      data: {
        rawResultMeta: withSilaCancelMeta(
          latest?.rawResultMeta ?? previous,
          {},
          silaCancel,
        ) as object,
      },
    });
  }

  /**
   * Cancel an active carrier shipment for an OMS order.
   * If the carrier confirms cancellation, the order returns to Ready to Ship / Shipping Details.
   * If the carrier does not support cancel or refuses, state remains unchanged.
   */
  async cancelCarrierShipmentForOrder(params: {
    omsOrderId: string;
    user: { id: string; role: string; companyId?: string | null };
    reason?: string;
    force?: boolean;
  }): Promise<CancelShipmentResult> {
    const { omsOrderId, user, reason, force } = params;
    if (
      user.role !== 'super_admin' &&
      user.role !== 'wh_manager' &&
      user.role !== 'wh_operator'
    ) {
      throw new ForbiddenException(
        'Shipment cancellation is restricted to warehouse staff and administrators.',
      );
    }

    const omsOrder = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: {
        outboundOrder: {
          include: {
            carrierShipments: {
              where: { supersededAt: null },
              orderBy: { createdAt: 'desc' },
              include: { provider: { include: { connection: true } } },
            },
          },
        },
      },
    });

    if (!omsOrder) {
      throw new NotFoundException(`Order with ID ${omsOrderId} not found.`);
    }

    if (user.role !== 'super_admin' && user.companyId && omsOrder.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this order.');
    }

    if (!mayUnlockToShippingDetails(omsOrder.status)) {
      return {
        success: false,
        status: 'refused',
        message: `Cannot cancel shipment: order is in status "${omsOrder.status}" and has already progressed past shipment preparation.`,
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        errorCode: 'invalid_status',
      };
    }

    const outbound = omsOrder.outboundOrder;
    const activeShipment = outbound?.carrierShipments?.find((cs) =>
      isActiveCarrierShipment(cs),
    );

    if (!activeShipment) {
      return {
        success: false,
        status: 'refused',
        message: 'Order does not have an active carrier shipment to cancel.',
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        errorCode: 'no_active_shipment',
      };
    }

    const providerCode = activeShipment.providerCode;
    const awb = activeShipment.externalAwb || activeShipment.trackingNumber;
    const resolvedCarrierName =
      resolveShippingCarrierName({
        carrier: omsOrder.carrier,
        shippingProviderCode: providerCode,
        shippingServiceId: omsOrder.shippingServiceId || outbound?.shippingServiceId,
        outboundOrder: outbound,
      }) ||
      displayNameForProviderCode(providerCode) ||
      providerCode;

    if (providerCode === 'manual' || !providerCode) {
      await this.applyConfirmedShipmentCancellation({
        omsOrder,
        outbound,
        carrierShipment: activeShipment,
        user,
        reason: reason || 'Manual shipment cancelled by admin',
      });
      return {
        success: true,
        status: 'cancelled',
        message: 'Manual shipment cancelled successfully. Order returned to Shipping Details.',
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        providerCode,
        carrierName: resolvedCarrierName,
        awb,
      };
    }

    const adapter = this.registry.get(providerCode);
    const credentials = this.credentialsFromConnection(activeShipment.provider?.connection);

    if (providerCode === SILA_SY_CODE) {
      const silaCancel = await this.requestSilaCancel({
        outboundOrderId: outbound!.id,
        orderNumber: omsOrder.orderNumber,
      });

      if (!silaCancel) {
        return {
          success: false,
          status: 'error',
          message: 'Failed to initiate cancellation with Sila-SY.',
          orderId: omsOrder.id,
          orderNumber: omsOrder.orderNumber,
          providerCode,
          carrierName: resolvedCarrierName,
          awb,
          errorCode: 'sila_failed',
        };
      }

      if (silaCancel.outcome === 'pending_confirmation') {
        return {
          success: false,
          status: 'pending_confirmation',
          message:
            silaCancel.message ||
            'Cancellation was submitted to Sila and is waiting for courier confirmation. The shipment remains active until confirmed.',
          orderId: omsOrder.id,
          orderNumber: omsOrder.orderNumber,
          providerCode,
          carrierName: resolvedCarrierName,
          awb,
          errorCode: 'pending_courier_confirmation',
        };
      }

      if (silaCancel.outcome === 'refused' || silaCancel.outcome === 'retry') {
        return {
          success: false,
          status: 'refused',
          message: silaCancel.message || 'Sila refused cancellation.',
          orderId: omsOrder.id,
          orderNumber: omsOrder.orderNumber,
          providerCode,
          carrierName: resolvedCarrierName,
          awb,
          errorCode: silaCancel.errorCode || 'sila_refused',
        };
      }

      await this.applyConfirmedShipmentCancellation({
        omsOrder,
        outbound,
        carrierShipment: activeShipment,
        user,
        reason: reason || `Sila cancellation confirmed (${silaCancel.courierCancel || 'confirmed'})`,
        cancelResult: silaCancel,
      });

      return {
        success: true,
        status: 'cancelled',
        message: 'Sila shipment cancelled successfully. Order returned to Shipping Details.',
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        providerCode,
        carrierName: resolvedCarrierName,
        awb,
      };
    }

    if (!adapter || !adapter.cancelShipment) {
      const provName = displayNameForProviderCode(providerCode) || adapter?.code || providerCode;
      if (force) {
        await this.applyConfirmedShipmentCancellation({
          omsOrder,
          outbound,
          carrierShipment: activeShipment,
          user,
          reason: reason || `Manual WMS shipment release by admin (${provName} automated cancel unsupported)`,
        });
        return {
          success: true,
          status: 'cancelled',
          message: `${provName} shipment cancelled manually in WMS. Order returned to Shipping Details.`,
          orderId: omsOrder.id,
          orderNumber: omsOrder.orderNumber,
          providerCode,
          carrierName: resolvedCarrierName,
          awb,
        };
      }
      return {
        success: false,
        status: 'unsupported',
        message: `${provName} does not support automated cancellation via API. Please cancel the shipment directly in the ${provName} portal.`,
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        providerCode,
        carrierName: resolvedCarrierName,
        awb,
        errorCode: 'cancel_unsupported',
      };
    }

    if (!credentials) {
      return {
        success: false,
        status: 'error',
        message: `Provider ${providerCode} is not connected or credentials are missing.`,
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        providerCode,
        carrierName: resolvedCarrierName,
        awb,
        errorCode: 'provider_not_connected',
      };
    }

    try {
      const cancelResult = await adapter.cancelShipment(credentials, awb || '');
      if (cancelResult.outcome === 'cancelled' || cancelResult.outcome === 'already_cancelled') {
        await this.applyConfirmedShipmentCancellation({
          omsOrder,
          outbound,
          carrierShipment: activeShipment,
          user,
          reason: reason || cancelResult.message || 'Carrier cancellation confirmed',
          cancelResult,
        });

        return {
          success: true,
          status: 'cancelled',
          message: cancelResult.message || 'Shipment cancelled successfully. Order returned to Shipping Details.',
          orderId: omsOrder.id,
          orderNumber: omsOrder.orderNumber,
          providerCode,
          carrierName: resolvedCarrierName,
          awb,
        };
      }

      if (cancelResult.outcome === 'pending_confirmation') {
        return {
          success: false,
          status: 'pending_confirmation',
          message: cancelResult.message || 'Cancellation is pending carrier confirmation.',
          orderId: omsOrder.id,
          orderNumber: omsOrder.orderNumber,
          providerCode,
          carrierName: resolvedCarrierName,
          awb,
          errorCode: 'pending_confirmation',
        };
      }

      if (cancelResult.errorCode === 'cancel_unsupported') {
        if (force) {
          await this.applyConfirmedShipmentCancellation({
            omsOrder,
            outbound,
            carrierShipment: activeShipment,
            user,
            reason: reason || `Manual WMS shipment release by admin (${providerCode} automated cancel unsupported)`,
            cancelResult,
          });
          return {
            success: true,
            status: 'cancelled',
            message: `${providerCode} shipment cancelled manually in WMS. Order returned to Shipping Details.`,
            orderId: omsOrder.id,
            orderNumber: omsOrder.orderNumber,
            providerCode,
            carrierName: resolvedCarrierName,
            awb,
          };
        }
      }

      return {
        success: false,
        status: cancelResult.errorCode === 'cancel_unsupported' ? 'unsupported' : 'refused',
        message: cancelResult.message || 'Carrier refused cancellation.',
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        providerCode,
        carrierName: resolvedCarrierName,
        awb,
        errorCode: cancelResult.errorCode || 'carrier_refused',
      };
    } catch (err: any) {
      this.logger.error(`Error requesting cancellation for order ${omsOrder.orderNumber}: ${err.message}`, err.stack);
      return {
        success: false,
        status: 'error',
        message: `Carrier cancellation request failed: ${err.message}`,
        orderId: omsOrder.id,
        orderNumber: omsOrder.orderNumber,
        providerCode,
        awb,
        errorCode: 'api_error',
      };
    }
  }

  private async applyConfirmedShipmentCancellation(params: {
    omsOrder: any;
    outbound: any;
    carrierShipment: any;
    user: { id: string; role: string; companyId?: string | null };
    reason: string;
    cancelResult?: any;
  }): Promise<void> {
    const { omsOrder, outbound, carrierShipment, user, reason, cancelResult } = params;
    const now = new Date();
    const unlink = carrierUnlinkPatch();

    await this.prisma.$transaction(async (tx) => {
      await tx.carrierShipment.update({
        where: { id: carrierShipment.id },
        data: {
          status: CarrierShipmentStatus.failed,
          supersededAt: now,
          lastTrackingStatus: 'cancelled',
          lastTrackingAt: now,
          lastErrorSafe: `Manually cancelled by admin: ${reason}`.slice(0, 500),
          nextPollAt: null,
          rawResultMeta: cancelResult
            ? (mergeShipmentRawMeta(carrierShipment.rawResultMeta, { cancelResult, cancelledAt: now.toISOString() }) as object)
            : carrierShipment.rawResultMeta,
        },
      });

      if (outbound?.id) {
        await tx.carrierShipment.updateMany({
          where: {
            outboundOrderId: outbound.id,
            status: { in: [CarrierShipmentStatus.created, CarrierShipmentStatus.pending] },
            id: { not: carrierShipment.id },
          },
          data: {
            status: CarrierShipmentStatus.failed,
            supersededAt: now,
            lastErrorSafe: `Superseded by cancellation of shipment ${carrierShipment.id}`,
            nextPollAt: null,
          },
        });
      }

      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ carrierShipmentId: carrierShipment.id, cancelledAt: now.toISOString(), cancelledBy: user.id }))
        .digest('hex');

      await tx.carrierShipmentEvent.create({
        data: {
          carrierShipmentId: carrierShipment.id,
          providerCode: carrierShipment.providerCode,
          externalEventId: `cancel:${carrierShipment.id}:${now.getTime()}`,
          awb: carrierShipment.externalAwb || carrierShipment.trackingNumber,
          eventType: 'shipment.cancelled',
          normalizedStatus: 'cancelled',
          sourceType: 'manual',
          isCarrierEvent: false,
          eventTimestamp: now,
          notes: `Cancelled by ${user.role}: ${reason}`,
          payloadHash,
          payload: {
            cancelledBy: user.id,
            userRole: user.role,
            reason,
            cancelResult: cancelResult ?? null,
          },
        },
      });

      if (outbound?.id) {
        await tx.outboundOrder.update({
          where: { id: outbound.id },
          data: {
            ...unlink,
            status: OutboundOrderStatus.waiting_for_shipping_details,
          },
        });
      }

      await tx.omsOrder.update({
        where: { id: omsOrder.id },
        data: {
          ...unlink,
          status: OmsOrderStatus.ready_to_ship,
        },
      });

      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: omsOrder.id,
          companyId: omsOrder.companyId,
          eventType: 'shipment.cancelled',
          createdBy: user.id,
          payload: {
            providerCode: carrierShipment.providerCode,
            awb: carrierShipment.externalAwb || carrierShipment.trackingNumber,
            reason,
            carrierShipmentId: carrierShipment.id,
            cancelledAt: now.toISOString(),
          },
        },
      });

      await tx.omsBatchOrder.updateMany({
        where: { omsOrderId: omsOrder.id, removedAt: null },
        data: {
          issueNote: `Shipment cancelled (${carrierShipment.providerCode}): order returned to Shipping Details.`,
        },
      });
    });

    this.realtime.emitOmsOrderEvent(omsOrder.companyId, {
      orderId: omsOrder.id,
      status: OmsOrderStatus.ready_to_ship,
      event: 'shipment.cancelled',
    });
  }

  private credentialsFromConnection(
    connection: {
      status?: string | null;
      encryptedUsername?: string | null;
      encryptedPassword?: string | null;
    } | null,
  ): ShippingCredentials | null {
    if (!connection || connection.status !== 'connected' || !connection.encryptedUsername) {
      return null;
    }
    return {
      username: this.encryption.decrypt(connection.encryptedUsername),
      password: connection.encryptedPassword
        ? this.encryption.decrypt(connection.encryptedPassword)
        : '',
    };
  }

  /**
   * Pull the live Sila cargo and store the courier AWB only.
   * Does not run processTrackingEvent, so OMS/outbound status is unchanged.
   */
  async refreshSilaCarrierIdentifiers(outboundOrderId: string): Promise<{
    success: boolean;
    matched: boolean;
    trackingNumber: string | null;
    omsStatus: string | null;
    outboundStatus: string | null;
    message: string;
  }> {
    const shipment = await this.prisma.carrierShipment.findFirst({
      where: { outboundOrderId, providerCode: SILA_SY_CODE },
      orderBy: { createdAt: 'desc' },
      include: {
        outboundOrder: { include: { omsOrder: true } },
        provider: { include: { connection: true } },
      },
    });
    if (!shipment?.externalAwb) {
      return {
        success: false,
        matched: false,
        trackingNumber: null,
        omsStatus: null,
        outboundStatus: null,
        message: 'No Sila carrier shipment with a cargo id for this outbound order.',
      };
    }

    const adapter = this.registry.get(SILA_SY_CODE);
    if (!adapter?.pollTracking) {
      return {
        success: false,
        matched: false,
        trackingNumber: shipment.trackingNumber ?? null,
        omsStatus: shipment.outboundOrder?.omsOrder?.status ?? null,
        outboundStatus: shipment.outboundOrder?.status ?? null,
        message: 'Sila adapter does not support cargo lookup.',
      };
    }

    const credentials = this.credentialsFromConnection(shipment.provider.connection);
    if (!credentials) {
      return {
        success: false,
        matched: false,
        trackingNumber: shipment.trackingNumber ?? null,
        omsStatus: shipment.outboundOrder?.omsOrder?.status ?? null,
        outboundStatus: shipment.outboundOrder?.status ?? null,
        message: 'Sila is not connected.',
      };
    }

    const snapshot = await adapter.pollTracking(credentials, shipment.externalAwb);
    const cargo =
      snapshot?.rawPayload && typeof snapshot.rawPayload === 'object'
        ? (snapshot.rawPayload as Record<string, unknown>)
        : null;
    const cargoId = extractSilaProviderId(cargo);
    const token =
      cargo && typeof cargo.tracking_token === 'string' ? cargo.tracking_token.trim() : '';
    const matched =
      Boolean(cargoId) &&
      [cargoId, token].includes(shipment.externalAwb.trim());
    if (!matched || !cargo) {
      return {
        success: false,
        matched: false,
        trackingNumber: shipment.trackingNumber ?? null,
        omsStatus: shipment.outboundOrder?.omsOrder?.status ?? null,
        outboundStatus: shipment.outboundOrder?.status ?? null,
        message: 'Live Sila cargo did not match the stored shipment identifier. No local write.',
      };
    }

    const beforeOms = shipment.outboundOrder?.omsOrder?.status ?? null;
    const beforeOutbound = shipment.outboundOrder?.status ?? null;
    const previousAwb = shipment.trackingNumber ?? null;
    await this.persistSilaCarrierAwb(
      shipment,
      shipment.outboundOrder,
      shipment.outboundOrder?.omsOrder ?? null,
      cargo,
    );
    await this.persistConfirmedSilaCourier(
      shipment,
      shipment.outboundOrder,
      shipment.outboundOrder?.omsOrder ?? null,
      cargo,
      previousAwb,
    );
    const latest = await this.prisma.carrierShipment.findUnique({
      where: { id: shipment.id },
      select: {
        trackingNumber: true,
        outboundOrder: { select: { status: true, omsOrder: { select: { status: true } } } },
      },
    });
    return {
      success: true,
      matched: true,
      trackingNumber: latest?.trackingNumber ?? extractSilaCarrierAwb(cargo) ?? null,
      omsStatus: latest?.outboundOrder?.omsOrder?.status ?? beforeOms,
      outboundStatus: latest?.outboundOrder?.status ?? beforeOutbound,
      message: 'Sila courier AWB refreshed from live cargo. Order shipping status was not changed.',
    };
  }

  /**
   * When a poll or webhook payload includes the final-carrier AWB, store it on the
   * shipment and the order. Sila's own token stays in rawResultMeta and externalAwb.
   * Tracking writes must preserve silaCancel.
   */
  private async persistSilaCarrierAwb(
    carrierShipment: { id: string; trackingNumber?: string | null; rawResultMeta?: unknown },
    outbound: { id?: string } | null,
    omsOrder: { id?: string } | null,
    raw: unknown,
  ): Promise<void> {
    if (!raw || typeof raw !== 'object') return;
    const latest = await this.prisma.carrierShipment.findUnique({
      where: { id: carrierShipment.id },
      select: { rawResultMeta: true, trackingNumber: true },
    });
    const previous = latest?.rawResultMeta ?? carrierShipment.rawResultMeta;
    const prevMeta =
      previous && typeof previous === 'object' && !Array.isArray(previous)
        ? (previous as Record<string, unknown>)
        : {};
    const awb = extractSilaCarrierAwb(raw as Record<string, unknown>);
    const pending = Boolean(prevMeta.awbPendingReassignment);
    const previousAwb = typeof prevMeta.previousAwb === 'string' ? prevMeta.previousAwb.trim() : '';
    const isStaleAwbAfterReassignment =
      pending && Boolean(awb) && Boolean(previousAwb) && awb === previousAwb;
    let merged = mergeShipmentRawMeta(previous, {
      ...(raw as object),
      ...(awb && !isStaleAwbAfterReassignment
        ? { awbPendingReassignment: false, previousAwb: null }
        : {}),
    });
    if (awb && !isStaleAwbAfterReassignment) {
      merged = applyConfirmedCarrierAwbToMeta(merged, awb);
    }

    await this.prisma.carrierShipment.update({
      where: { id: carrierShipment.id },
      data: {
        ...(awb && !isStaleAwbAfterReassignment && awb !== latest?.trackingNumber
          ? { trackingNumber: awb }
          : {}),
        rawResultMeta: merged as object,
      },
    });
    if (awb && !isStaleAwbAfterReassignment && awb !== (latest?.trackingNumber || carrierShipment.trackingNumber)) {
      if (outbound?.id) {
        await this.prisma.outboundOrder.update({
          where: { id: outbound.id },
          data: { trackingNumber: awb },
        });
      }
      if (omsOrder?.id) {
        await this.prisma.omsOrder.update({
          where: { id: omsOrder.id },
          data: { trackingNumber: awb },
        });
      }
    }
  }

  /**
   * Update the live carrier display only when Sila cargo/GET confirms a courier id or name.
   * Does not create a new cargo. Status-only payloads without courier identity are ignored.
   * A courier change without a new AWB shows the new carrier with a pending AWB.
   */
  private async persistConfirmedSilaCourier(
    carrierShipment: { id: string; rawResultMeta?: unknown },
    outbound: { id?: string; shippingServiceId?: string | null; carrier?: string | null } | null,
    omsOrder: { id?: string; shippingServiceId?: string | null; carrier?: string | null } | null,
    raw: unknown,
    previousAwb?: string | null,
  ): Promise<void> {
    if (!raw || typeof raw !== 'object') return;
    const cargo = raw as Record<string, unknown>;
    const confirmed = extractSilaCourier(cargo);
    if (!confirmed.courierId && !confirmed.courierName) return;

    const storedServiceId = outbound?.shippingServiceId || omsOrder?.shippingServiceId || '';
    const decision = confirmedCourierReassignment({
      storedCourierId: courierIdFromServiceId(storedServiceId),
      storedCarrierName: outbound?.carrier || omsOrder?.carrier || null,
      confirmed: {
        courierId: confirmed.courierId || null,
        courierName: confirmed.courierName || null,
      },
    });
    if (!decision.changed) return;

    if (decision.courierId && decision.displayName) {
      registerCourierName(decision.courierId, decision.displayName);
    }
    const displayName = decision.displayName
      ? normalizeCourierDisplayName(decision.displayName)
      : null;
    const areaSuffix = storedServiceId.split(':').slice(2).join(':');
    const nextServiceId = decision.courierId
      ? `SILA_SY:${decision.courierId}${areaSuffix ? `:${areaSuffix}` : ''}`
      : storedServiceId || null;

    const payloadAwb = extractSilaCarrierAwb(cargo);
    const storedAwb = (previousAwb || '').trim();
    const pendingAwb = !payloadAwb;

    const latest = await this.prisma.carrierShipment.findUnique({
      where: { id: carrierShipment.id },
      select: { rawResultMeta: true },
    });
    const previous = latest?.rawResultMeta ?? carrierShipment.rawResultMeta;
    const merged = mergeShipmentRawMeta(previous, {
      courier_id: decision.courierId,
      courier_name: displayName,
      courierHistory: {
        previousServiceId: storedServiceId || null,
        previousCarrier: outbound?.carrier || omsOrder?.carrier || null,
        previousAwb: storedAwb || null,
        at: new Date().toISOString(),
      },
      ...(pendingAwb ? { awbPendingReassignment: true, previousAwb: storedAwb } : {}),
    });
    await this.prisma.carrierShipment.update({
      where: { id: carrierShipment.id },
      data: {
        rawResultMeta: merged as object,
        ...(pendingAwb ? { trackingNumber: null } : {}),
      },
    });
    if (outbound?.id) {
      await this.prisma.outboundOrder.update({
        where: { id: outbound.id },
        data: {
          ...(displayName ? { carrier: displayName } : {}),
          ...(nextServiceId ? { shippingServiceId: nextServiceId } : {}),
          ...(pendingAwb ? { trackingNumber: null } : {}),
        },
      });
    }
    if (omsOrder?.id) {
      await this.prisma.omsOrder.update({
        where: { id: omsOrder.id },
        data: {
          ...(displayName ? { carrier: displayName } : {}),
          ...(nextServiceId ? { shippingServiceId: nextServiceId } : {}),
          ...(pendingAwb ? { trackingNumber: null } : {}),
        },
      });
    }
  }

  /**
   * Persist confirmed Sila courier + AWB from a live GET so Order Details,
   * Shipment Movement, and the waybill read the same active identity.
   */
  private async persistSilaIdentityFromHistory(lookup: string, cargo: unknown): Promise<void> {
    const shipment = await this.prisma.carrierShipment.findFirst({
      where: {
        providerCode: SILA_SY_CODE,
        ...ACTIVE_CARRIER_SHIPMENT_WHERE,
        OR: shipmentLookupOr(lookup),
      },
      include: {
        outboundOrder: {
          select: {
            id: true,
            shippingServiceId: true,
            carrier: true,
            omsOrder: { select: { id: true, shippingServiceId: true, carrier: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!shipment) return;
    const previousAwb = shipment.trackingNumber ?? null;
    await this.persistSilaCarrierAwb(
      shipment,
      shipment.outboundOrder,
      shipment.outboundOrder?.omsOrder ?? null,
      cargo,
    );
    await this.persistConfirmedSilaCourier(
      shipment,
      shipment.outboundOrder,
      shipment.outboundOrder?.omsOrder ?? null,
      cargo,
      previousAwb,
    );
  }

  private async finalizeTrackingHistoryIdentity(
    code: string,
    lookup: string,
    fallbackCarrierName: string | null | undefined,
    result: ShipmentTrackingResult,
  ): Promise<ShipmentTrackingResult> {
    if (code === SILA_SY_CODE && result.rawPayload) {
      await this.persistSilaIdentityFromHistory(lookup, result.rawPayload);
    }
    const shipment = await this.prisma.carrierShipment.findFirst({
      where: {
        providerCode: code,
        ...ACTIVE_CARRIER_SHIPMENT_WHERE,
        OR: shipmentLookupOr(lookup),
      },
      select: {
        id: true,
        trackingNumber: true,
        providerCode: true,
        lastErrorSafe: true,
        rawResultMeta: true,
        outboundOrder: {
          select: {
            carrier: true,
            shippingProviderCode: true,
            shippingServiceId: true,
            omsOrder: {
              select: { carrier: true, shippingProviderCode: true, shippingServiceId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const pending = isAwbPendingReassignment(shipment?.rawResultMeta);
    const carrierName =
      resolveShippingCarrierName({
        carrier: shipment?.outboundOrder?.omsOrder?.carrier || shipment?.outboundOrder?.carrier,
        shippingProviderCode:
          shipment?.outboundOrder?.omsOrder?.shippingProviderCode ||
          shipment?.outboundOrder?.shippingProviderCode ||
          shipment?.providerCode,
        shippingServiceId:
          shipment?.outboundOrder?.omsOrder?.shippingServiceId ||
          shipment?.outboundOrder?.shippingServiceId,
        outboundOrder: shipment
          ? {
              carrier: shipment.outboundOrder?.carrier,
              shippingProviderCode: shipment.outboundOrder?.shippingProviderCode,
              shippingServiceId: shipment.outboundOrder?.shippingServiceId,
              carrierShipments: [
                {
                  status: 'created',
                  supersededAt: null,
                  providerCode: shipment.providerCode,
                  rawResultMeta: shipment.rawResultMeta,
                },
              ],
            }
          : null,
      }) ||
      result.providerName ||
      fallbackCarrierName ||
      code;
    const displayAwb = pending
      ? ''
      : shipment?.trackingNumber?.trim() || result.awb || lookup;
    const { rawPayload: _raw, ...safe } = result;
    if (shipment?.id && (result.lookupState === 'not_found' || result.lookupState === 'error' || result.lookupState === 'ok')) {
      const recovered = result.lookupState === 'ok';
      const previousError = String(shipment.lastErrorSafe || '');
      await this.prisma.carrierShipment.update({
        where: { id: shipment.id },
        data: {
          lastTrackingAt: new Date(),
          lastErrorSafe: recovered
            ? /cancellation is not confirmed/i.test(previousError)
              ? null
              : shipment.lastErrorSafe
            : result.lookupState === 'not_found'
              ? 'Provider lookup returned Shipment not found. Cancellation is not confirmed.'
              : (result.error || 'Provider tracking lookup failed.').slice(0, 500),
          rawResultMeta: mergeShipmentRawMeta(shipment.rawResultMeta, {
            babelLookup: recovered
              ? null
              : {
                  state: result.lookupState,
                  at: new Date().toISOString(),
                  errorMessage: result.error || result.message || null,
                },
          }) as any,
        },
      });
    }
    let mergedEvents = [...(safe.events || [])];
    if (shipment?.id) {
      const storedEvents = await this.prisma.carrierShipmentEvent.findMany({
        where: { carrierShipmentId: shipment.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          createdAt: true,
          processedAt: true,
          eventTimestamp: true,
          eventType: true,
          normalizedStatus: true,
          originalCarrierStatus: true,
          eventDescription: true,
          locationText: true,
          notes: true,
          sourceType: true,
          isCarrierEvent: true,
        },
      });

      for (const row of storedEvents) {
        const ts = (row.eventTimestamp || row.processedAt || row.createdAt).toISOString();
        const code = row.originalCarrierStatus || row.eventType || '';
        const title = row.eventDescription || row.originalCarrierStatus || row.eventType;

        const isDuplicate = mergedEvents.some((existing) => {
          const t1 = new Date(existing.timestamp).getTime();
          const t2 = new Date(ts).getTime();
          const timeClose = Math.abs(t1 - t2) < 60000;
          const sameStatus =
            (existing.code || '').toLowerCase() === code.toLowerCase() ||
            existing.title.trim() === title.trim();
          return timeClose && sameStatus;
        });

        if (!isDuplicate) {
          mergedEvents.push({
            timestamp: ts,
            title,
            originalDescription: row.eventDescription || row.originalCarrierStatus || null,
            location: row.locationText || null,
            notes: row.notes || null,
            color:
              row.normalizedStatus === 'delivered'
                ? 'success'
                : row.normalizedStatus === 'cancelled' || row.normalizedStatus === 'delivery_failed'
                  ? 'error'
                  : row.normalizedStatus === 'returning_to_sender' ||
                      row.normalizedStatus === 'returned_to_sender'
                    ? 'warning'
                    : 'info',
            code,
            source: row.isCarrierEvent ? ('carrier' as const) : ('emdad' as const),
          });
        }
      }

      mergedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return {
      ...safe,
      events: mergedEvents,
      providerName: carrierName,
      awb: displayAwb,
      awbPending: pending,
      lookupState: result.lookupState,
      cancellationUnconfirmed: Boolean(result.cancellationUnconfirmed),
      shipmentState: result.shipmentState || 'active',
    };
  }

  /**
   * Sila movement is keyed by tracking token or cargo id.
   * Older orders stored the courier barcode as the OMS tracking number, which
   * the tracking API does not accept. Retry the shipment's other identifiers.
   */
  private async withSilaAlternateHistory(
    adapter: { getTrackingHistory?: ShippingProvider['getTrackingHistory'] },
    credentials: ShippingCredentials,
    code: string,
    awb: string,
    result: ShipmentTrackingResult,
  ): Promise<ShipmentTrackingResult> {
    const missing =
      result.events.length === 0 &&
      (!result.error || /not found|cargo not found|لا توجد بيانات/i.test(result.error));
    if (code !== 'SILA_SY' || !missing || !adapter.getTrackingHistory) {
      return result;
    }
    const shipment = await this.prisma.carrierShipment.findFirst({
      where: {
        providerCode: 'SILA_SY',
        OR: shipmentLookupOr(awb),
      },
      select: { externalAwb: true, trackingNumber: true, rawResultMeta: true },
    });
    const meta =
      shipment?.rawResultMeta && typeof shipment.rawResultMeta === 'object'
        ? (shipment.rawResultMeta as Record<string, unknown>)
        : null;
    const candidates = [...new Set(
      [
        shipment?.externalAwb,
        ...extractSilaApiLookupKeys(meta, shipment?.externalAwb ?? undefined),
      ]
        .map((value) => (value || '').trim())
        .filter((value) => value && value !== awb),
    )];
    for (const candidate of candidates) {
      const next = await adapter.getTrackingHistory(credentials, candidate);
      if (next && !next.error && next.events.length > 0) return next;
    }
    return result;
  }

  /**
   * Helper mapping normalized tracking status to target OMS status.
   * Post-OFD cancel maps to failed_delivery (not commercial cancelled).
   */
  private targetOmsStatus(normalized: NormalizedTrackingStatus, preOfd = false): string {
    switch (normalized) {
      case 'in_transit':
        return 'shipped';
      case 'out_for_delivery':
        return 'out_for_delivery';
      case 'delivery_failed':
      case 'return_created':
      case 'returning_to_sender':
      case 'returned_to_sender':
      case 'cancelled':
        // Pre-OFD unlock keeps stage roughly at ready_to_ship / waiting; post → failed_delivery.
        return preOfd ? 'ready_to_ship' : 'failed_delivery';
      case 'delivered':
        return 'delivered';
      case 'returned':
        return preOfd ? 'ready_to_ship' : 'failed_delivery';
      default:
        return 'ready_to_ship';
    }
  }
}
