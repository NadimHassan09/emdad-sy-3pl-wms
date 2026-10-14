import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
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
  ShippingCredentials,
} from './shipping-provider.interface';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingAutoReturnService } from './shipping-auto-return.service';

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
  delivered: 4,
  returned: 4,
  cancelled: 4,
};

function extractActualShippingPrice(
  raw: unknown,
): { amount: number; currency: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const details = b.details && typeof b.details === 'object' ? (b.details as Record<string, unknown>) : {};
  const amountRaw =
    b.shipping_cost ?? b.shippingCost ?? b.price ?? b.delivery_fee ?? details.price ?? details.shipping_cost;
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currencyRaw = b.currency ?? details.currency;
  const currency = typeof currencyRaw === 'string' && currencyRaw.trim() ? currencyRaw.trim().toUpperCase() : 'USD';
  return { amount, currency };
}

const LEFT_WAREHOUSE_STATUSES = new Set<string>([
  OmsOrderStatus.shipped,
  OmsOrderStatus.out_for_delivery,
  OmsOrderStatus.failed_delivery,
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
          { externalAwb: trimmedAwb },
          { trackingNumber: trimmedAwb },
          { externalAwb: { contains: trimmedAwb, mode: 'insensitive' } },
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
    if (shouldUpdateStatus && omsOrder) {
      if (preOfd && isCarrierProblem) {
        actionTaken = await this.handlePreDispatchCarrierFailure({
          event,
          omsOrder,
          outbound,
          carrierShipment,
          trimmedAwb,
        });
      } else {
        switch (event.normalizedStatus) {
          case 'in_transit': {
            if (
              omsOrder.status === OmsOrderStatus.ready_to_ship ||
              omsOrder.status === OmsOrderStatus.processing
            ) {
              await this.prisma.omsOrder.update({
                where: { id: omsOrder.id },
                data: { status: OmsOrderStatus.shipped },
              });
              if (outbound) {
                await this.prisma.outboundOrder.update({
                  where: { id: outbound.id },
                  data: { status: OutboundOrderStatus.shipped, shippedAt: new Date() },
                });
              }
              actionTaken = 'order_shipped';
            }
            break;
          }

          case 'out_for_delivery': {
            const wasFailed = omsOrder.status === OmsOrderStatus.failed_delivery;
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

          case 'delivery_failed':
          case 'cancelled': {
            // Failed delivery is a status only. A return draft is an admin decision.
            await this.prisma.omsOrder.update({
              where: { id: omsOrder.id },
              data: {
                status: OmsOrderStatus.failed_delivery,
                deliveryFailedAt: omsOrder.deliveryFailedAt || new Date(),
              },
            });
            actionTaken =
              event.normalizedStatus === 'cancelled'
                ? 'order_carrier_cancelled_failed_delivery'
                : 'order_delivery_failed';
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

          case 'return_created':
          case 'returning_to_sender':
          case 'returned_to_sender':
          case 'returned': {
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
            break;
          }

          default:
            break;
        }
      }
    }

    // 5. Record Event Audit Entry
    await this.prisma.carrierShipmentEvent.create({
      data: {
        carrierShipmentId: carrierShipment?.id ?? null,
        providerCode: event.providerCode,
        externalEventId: event.externalEventId,
        awb: trimmedAwb,
        eventType: event.eventType,
        normalizedStatus: event.normalizedStatus,
        status: 'processed',
        payloadHash,
        payload: rawPayload as any,
        processedAt: new Date(),
      },
    });

    // 6. Update Shipment Metadata if linked (skip if pre-dispatch already marked failed)
    if (carrierShipment && !(preOfd && isCarrierProblem)) {
      const actualPrice = extractActualShippingPrice(event.rawPayload);
      await this.prisma.carrierShipment.update({
        where: { id: carrierShipment.id },
        data: {
          lastTrackingStatus: event.normalizedStatus,
          lastTrackingAt: new Date(),
          ...(actualPrice
            ? { shippingCost: actualPrice.amount, currency: actualPrice.currency }
            : {}),
        },
      });
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

    if (carrierShipment) {
      await this.prisma.carrierShipment.update({
        where: { id: carrierShipment.id },
        data: {
          status: CarrierShipmentStatus.failed,
          lastTrackingStatus: event.normalizedStatus,
          lastTrackingAt: new Date(),
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
          lastErrorSafe: issueNote,
          nextPollAt: null,
        },
      });
    }

    if (outbound?.id) {
      const outboundData: Record<string, unknown> = {
        trackingNumber: null,
      };
      if (outbound.status === OutboundOrderStatus.ready_to_ship) {
        outboundData.status = OutboundOrderStatus.waiting_for_shipping_details;
      }
      await this.prisma.outboundOrder.update({
        where: { id: outbound.id },
        data: outboundData,
      });
    }

    await this.prisma.omsOrder.update({
      where: { id: omsOrder.id },
      data: {
        trackingNumber: null,
        // Keep commercial OMS status; unlock happens via outbound waiting_for_shipping_details.
      },
    });

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
        OR: [{ externalAwb: trimmed }, { trackingNumber: trimmed }],
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
          OR: [{ externalAwb: trimmed }, { trackingNumber: trimmed }],
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
      return result;
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
