import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

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
  shipped: 2,
  out_for_delivery: 3,
  failed_delivery: 3,
  delivered: 4,
  returned: 4,
  cancelled: 4,
};

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
      // Direct OMS Order fallback lookup
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

    // 3. Monotonic Status Progression Check
    const currentOmsStatus = omsOrder?.status || 'ready_to_ship';
    const currentRank = STATUS_PROGRESS_RANK[currentOmsStatus] ?? 0;
    const incomingRank = STATUS_PROGRESS_RANK[this.targetOmsStatus(event.normalizedStatus)] ?? 0;

    let shouldUpdateStatus = true;
    if (incomingRank < currentRank && (currentRank >= 4 || currentOmsStatus === 'delivered' || currentOmsStatus === 'returned')) {
      this.logger.warn(
        `Prevented status regression for order ${omsOrder?.orderNumber}: current=${currentOmsStatus} (rank ${currentRank}), incoming=${event.normalizedStatus} (rank ${incomingRank})`,
      );
      shouldUpdateStatus = false;
    }

    // 4. State Transitions & Business Operations
    let actionTaken = `tracking_recorded:${event.normalizedStatus}`;
    if (shouldUpdateStatus && omsOrder) {
      switch (event.normalizedStatus) {
        case 'in_transit': {
          if (omsOrder.status === OmsOrderStatus.ready_to_ship || omsOrder.status === OmsOrderStatus.processing) {
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
          await this.prisma.omsOrder.update({
            where: { id: omsOrder.id },
            data: { status: OmsOrderStatus.out_for_delivery, outForDeliveryAt: new Date() },
          });
          if (outbound) {
            await this.prisma.outboundOrder.update({
              where: { id: outbound.id },
              data: { status: OutboundOrderStatus.out_for_delivery, outForDeliveryAt: new Date() },
            });
          }
          actionTaken = 'order_out_for_delivery';
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
          const res = await this.autoReturn.processCarrierReturnEvent({
            omsOrderId: omsOrder.id,
            awb: trimmedAwb,
            stage: 'return_created',
            reason: event.returnReason || event.notes,
            originalStatus: event.originalCarrierStatus || event.eventType,
            timestamp: event.timestamp || new Date(),
          });
          actionTaken = res.success ? 'order_delivery_failed_return_initiated' : 'order_delivery_failed';
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
          let stage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' = 'returned_to_sender';
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

        case 'cancelled': {
          if (omsOrder.status !== OmsOrderStatus.delivered && omsOrder.status !== OmsOrderStatus.returned) {
            await this.prisma.omsOrder.update({
              where: { id: omsOrder.id },
              data: { status: OmsOrderStatus.cancelled, cancelledAt: new Date() },
            });
            if (outbound) {
              await this.prisma.outboundOrder.update({
                where: { id: outbound.id },
                data: { status: OutboundOrderStatus.cancelled, cancelledAt: new Date() },
              });
            }
            actionTaken = 'order_cancelled';
          }
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

    // 6. Update Shipment Metadata if linked
    if (carrierShipment) {
      await this.prisma.carrierShipment.update({
        where: { id: carrierShipment.id },
        data: {
          lastTrackingStatus: event.normalizedStatus,
          lastTrackingAt: new Date(),
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
          },
        },
      });

      // Realtime Notification
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

    // Resolve provider code
    let code = (params.providerCode || '').toUpperCase().trim();
    const carrierName = (params.carrierName || '').toLowerCase().trim();

    if (!code) {
      if (carrierName.includes('babel')) {
        code = 'BABEL_EXPRESS';
      } else if (carrierName.includes('sila')) {
        code = 'SILA_SY';
      }
    }

    // Try finding associated carrier shipment in database if code is still missing
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
   */
  private targetOmsStatus(normalized: NormalizedTrackingStatus): string {
    switch (normalized) {
      case 'in_transit':
        return 'shipped';
      case 'out_for_delivery':
        return 'out_for_delivery';
      case 'delivery_failed':
      case 'return_created':
      case 'returning_to_sender':
      case 'returned_to_sender':
        return 'failed_delivery';
      case 'delivered':
        return 'delivered';
      case 'returned':
        return 'returned';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'ready_to_ship';
    }
  }
}
