import { Injectable, Logger } from '@nestjs/common';
import {
  LedgerRefType,
  MovementType,
  OmsOrderStatus,
  OmsReturnStatus,
  OutboundOrderStatus,
  Prisma,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StockHelpers } from '../inventory/stock.helpers';
import { LedgerIdempotencyService } from '../inventory/ledger-idempotency.service';
import { CodRecordsService } from '../cod/cod-records.service';

@Injectable()
export class ShippingAutoReturnService {
  private readonly logger = new Logger(ShippingAutoReturnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly stockHelpers: StockHelpers,
    private readonly ledger: LedgerIdempotencyService,
    private readonly codRecords: CodRecordsService,
  ) {}

  /**
   * Stage 1: Handles carrier return event updates (return_created, returning_to_sender, returned_to_sender).
   * CRITICAL ARCHITECTURAL RULE:
   * Carrier webhooks and polling NEVER directly restock inventory or touch ledger.
   * Order status is updated to failed_delivery (if not already), and OmsReturn draft tracks the return stage.
   * Order status only becomes 'returned' after physical warehouse confirmation.
   */
  async processCarrierReturnEvent(params: {
    omsOrderId: string;
    awb: string;
    stage: 'return_created' | 'returning_to_sender' | 'returned_to_sender';
    reason?: string;
    originalStatus?: string;
    timestamp?: Date;
    principal?: AuthPrincipal;
  }): Promise<{ success: boolean; returnId?: string; stage?: string; message?: string }> {
    const { omsOrderId, awb, stage, reason, originalStatus } = params;
    const eventTime = params.timestamp || new Date();

    this.logger.log(
      `Processing carrier return event: omsOrderId=${omsOrderId}, awb=${awb}, stage=${stage}, reason=${reason || ''}, originalStatus=${originalStatus || ''}`,
    );

    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: {
        lines: true,
        outboundOrder: { select: { id: true, status: true, orderNumber: true } },
      },
    });

    if (!order) {
      this.logger.warn(`Carrier return event aborted: OMS order ${omsOrderId} not found.`);
      return { success: false, message: 'OMS order not found' };
    }

    // Check if a completed return already exists for this order
    const existingCompleted = await this.prisma.omsReturn.findFirst({
      where: {
        omsOrderId,
        status: OmsReturnStatus.completed,
      },
      select: { id: true, returnNumber: true },
    });

    if (existingCompleted && order.status === OmsOrderStatus.returned) {
      this.logger.log(
        `Order ${order.orderNumber} is already physically confirmed and returned (returnNumber=${existingCompleted.returnNumber}).`,
      );
      return { success: true, returnId: existingCompleted.id, stage, message: 'Already physically confirmed returned' };
    }

    // System principal or passed user principal for audit logging
    const adminUser = !params.principal
      ? await this.prisma.user.findFirst({
          where: { role: 'super_admin' },
          select: { id: true, email: true },
        })
      : null;
    const principal: AuthPrincipal = params.principal || {
      id: adminUser?.id || '00000000-0000-4000-8000-0000000000aa',
      companyId: order.companyId,
      role: 'super_admin',
      tenantScope: 'all',
      authorizedCompanyIds: [],
    };

    // Find any existing active return draft (requested or approved)
    let activeReturn = await this.prisma.omsReturn.findFirst({
      where: {
        omsOrderId,
        status: { in: [OmsReturnStatus.requested, OmsReturnStatus.approved] },
      },
      include: { lines: true },
    });

    if (activeReturn) {
      // Update existing return draft with current carrier return stage and metadata
      const dataToUpdate: Prisma.OmsReturnUpdateInput = {
        carrierReturnStage: stage,
        carrierOriginalStatus: originalStatus ?? activeReturn.carrierOriginalStatus,
        carrierAwb: awb || activeReturn.carrierAwb,
      };

      if (reason && !activeReturn.reason) {
        dataToUpdate.reason = reason;
      }

      if (stage === 'return_created') {
        if (!activeReturn.carrierReturnCreatedAt) dataToUpdate.carrierReturnCreatedAt = eventTime;
      } else if (stage === 'returning_to_sender') {
        if (!activeReturn.carrierReturnCreatedAt) dataToUpdate.carrierReturnCreatedAt = eventTime;
        if (!activeReturn.carrierReturningAt) dataToUpdate.carrierReturningAt = eventTime;
      } else if (stage === 'returned_to_sender') {
        if (!activeReturn.carrierReturnCreatedAt) dataToUpdate.carrierReturnCreatedAt = eventTime;
        if (!activeReturn.carrierReturningAt) dataToUpdate.carrierReturningAt = eventTime;
        if (!activeReturn.carrierReturnedAt) dataToUpdate.carrierReturnedAt = eventTime;
      }

      activeReturn = await this.prisma.omsReturn.update({
        where: { id: activeReturn.id },
        data: dataToUpdate,
        include: { lines: true },
      });
    } else {
      // Calculate returnable lines from order lines
      const activeReturnLines = await this.prisma.omsReturnLine.findMany({
        where: {
          omsReturn: {
            omsOrderId,
            status: { in: [OmsReturnStatus.requested, OmsReturnStatus.approved, OmsReturnStatus.completed] },
          },
        },
        select: { productId: true, quantity: true },
      });
      const alreadyReturnedMap = new Map<string, Prisma.Decimal>();
      for (const rl of activeReturnLines) {
        const cur = alreadyReturnedMap.get(rl.productId) ?? new Prisma.Decimal(0);
        alreadyReturnedMap.set(rl.productId, cur.add(rl.quantity));
      }

      const returnLinesToCreate: Array<{
        productId: string;
        quantity: number;
        unitPrice: Prisma.Decimal | null;
        lotId: string | null;
      }> = [];

      for (const ol of order.lines) {
        const already = alreadyReturnedMap.get(ol.productId) ?? new Prisma.Decimal(0);
        const remaining = Number(ol.requestedQuantity.sub(already));
        if (remaining > 0) {
          returnLinesToCreate.push({
            productId: ol.productId,
            quantity: remaining,
            unitPrice: ol.unitPrice,
            lotId: ol.specificLotId,
          });
        }
      }

      if (returnLinesToCreate.length === 0) {
        let allCovered = true;
        for (const ol of order.lines) {
          const already = alreadyReturnedMap.get(ol.productId) ?? new Prisma.Decimal(0);
          if (already.lessThan(ol.requestedQuantity)) {
            allCovered = false;
            break;
          }
        }
        if (allCovered) {
          // The order's items were already completely received & restocked in prior return(s).
          // Finalize the order status to returned.
          await this.prisma.omsOrder.update({
            where: { id: omsOrderId },
            data: {
              status: OmsOrderStatus.returned,
              returnedAt: new Date(),
            },
          });
          await this.prisma.omsOrderEvent.create({
            data: {
              omsOrderId,
              companyId: order.companyId,
              eventType: 'oms.returned',
              createdBy: principal.id,
              payload: { reason: 'all_ordered_qty_already_returned_via_prior_returns' },
            },
          });
          if (order.companyId) {
            this.realtime.emitOmsOrderEvent(order.companyId, {
              orderId: order.id,
              status: OmsOrderStatus.returned,
              event: 'oms.returned',
            });
          }
          return {
            success: true,
            stage,
            message: 'All order items were already received and restocked by prior returns.',
          };
        }

        // Otherwise fallback to remaining quantity
        for (const ol of order.lines) {
          returnLinesToCreate.push({
            productId: ol.productId,
            quantity: Number(ol.requestedQuantity),
            unitPrice: ol.unitPrice,
            lotId: ol.specificLotId,
          });
        }
      }

      // Resolve warehouse & default execution plan
      let warehouseId = (
        await this.prisma.stockReservation.findFirst({
          where: { outboundOrderId: order.outboundOrderId ?? undefined },
          orderBy: { createdAt: 'desc' },
          select: { location: { select: { warehouseId: true } } },
        })
      )?.location.warehouseId;

      if (!warehouseId && order.outboundOrderId) {
        const ob = await this.prisma.outboundOrder.findUnique({
          where: { id: order.outboundOrderId },
          select: { executionPlan: true },
        });
        if (
          ob?.executionPlan &&
          typeof ob.executionPlan === 'object' &&
          'warehouseId' in ob.executionPlan &&
          typeof (ob.executionPlan as any).warehouseId === 'string'
        ) {
          warehouseId = (ob.executionPlan as any).warehouseId;
        }
      }

      if (!warehouseId) {
        const firstWh = await this.prisma.warehouse.findFirst({
          where: { status: 'active' },
          select: { id: true },
        });
        warehouseId = firstWh?.id;
      }

      let receivingDock = warehouseId
        ? await this.prisma.location.findFirst({
            where: { warehouseId, type: 'input', status: 'active' },
            select: { id: true },
          })
        : null;
      if (!receivingDock && warehouseId) {
        receivingDock = await this.prisma.location.findFirst({
          where: {
            warehouseId,
            OR: [
              { name: { contains: 'استلام', mode: 'insensitive' } },
              { name: { contains: 'dock', mode: 'insensitive' } },
            ],
            status: 'active',
          },
          select: { id: true },
        });
      }

      let returnsLocation = warehouseId
        ? await this.prisma.location.findFirst({
            where: {
              warehouseId,
              name: { equals: 'Returns', mode: 'insensitive' },
              status: 'active',
            },
            select: { id: true },
          })
        : null;
      if (!returnsLocation && warehouseId) {
        returnsLocation = await this.prisma.location.findFirst({
          where: {
            warehouseId,
            name: { contains: 'return', mode: 'insensitive' },
            status: 'active',
          },
          select: { id: true },
        });
      }
      if (!returnsLocation && warehouseId) {
        returnsLocation = await this.prisma.location.findFirst({
          where: {
            warehouseId,
            type: 'internal',
            status: 'active',
          },
          select: { id: true },
        });
      }

      const defaultDockId = receivingDock?.id ?? returnsLocation?.id;
      const defaultPutawayId = returnsLocation?.id ?? receivingDock?.id;

      const defaultPlan =
        warehouseId && defaultDockId && defaultPutawayId
          ? {
              warehouseId,
              receivingDockId: defaultDockId,
              planUpdatedAt: new Date().toISOString(),
              lines: returnLinesToCreate.map((l) => ({
                productId: l.productId,
                expectedQty: l.quantity,
                putaway: [{ locationId: defaultPutawayId, qty: l.quantity }],
              })),
            }
          : undefined;

      const returnReason = reason || originalStatus || `Carrier Return (${awb})`;
      const returnNotes = `Automated return stage (${stage}) for AWB ${awb}. Awaiting physical warehouse receipt.`;

      activeReturn = await this.prisma.omsReturn.create({
        data: {
          companyId: order.companyId,
          omsOrderId: order.id,
          status: OmsReturnStatus.requested,
          executionMode: 'admin',
          reason: returnReason,
          notes: returnNotes,
          createdBy: principal.id,
          executionPlan: (defaultPlan as unknown as Prisma.InputJsonValue) ?? undefined,
          carrierReturnStage: stage,
          carrierOriginalStatus: originalStatus,
          carrierAwb: awb,
          carrierReturnCreatedAt: eventTime,
          carrierReturningAt: stage === 'returning_to_sender' || stage === 'returned_to_sender' ? eventTime : null,
          carrierReturnedAt: stage === 'returned_to_sender' ? eventTime : null,
          lines: {
            create: returnLinesToCreate.map((l, idx) => {
              const qty = new Prisma.Decimal(l.quantity);
              const lineTotal = l.unitPrice != null ? l.unitPrice.mul(qty) : null;
              return {
                productId: l.productId,
                quantity: qty,
                unitPrice: l.unitPrice ?? undefined,
                lineTotal: lineTotal ?? undefined,
                lotId: l.lotId,
                lineNumber: idx + 1,
              };
            }),
          },
        },
        include: { lines: true },
      });
    }

    // Keep OMS Order status as failed_delivery while return is in progress / at dock
    // DO NOT set order.status to returned yet!
    if (order.status !== OmsOrderStatus.failed_delivery && order.status !== OmsOrderStatus.returned) {
      await this.prisma.omsOrder.update({
        where: { id: omsOrderId },
        data: {
          status: OmsOrderStatus.failed_delivery,
          deliveryFailedAt: order.deliveryFailedAt || eventTime,
        },
      });
    }

    // Audit event log
    await this.prisma.omsOrderEvent.create({
      data: {
        omsOrderId: order.id,
        companyId: order.companyId,
        eventType: 'carrier.return_stage_updated',
        createdBy: principal.id,
        payload: {
          omsReturnId: activeReturn.id,
          returnNumber: activeReturn.returnNumber,
          stage,
          awb,
          reason,
          originalStatus,
        },
      },
    });

    // Realtime events
    if (order.companyId) {
      this.realtime.emitOmsOrderEvent(order.companyId, {
        orderId: omsOrderId,
        status: order.status === OmsOrderStatus.returned ? OmsOrderStatus.returned : OmsOrderStatus.failed_delivery,
        event: 'carrier.return_stage_updated',
      });
      this.realtime.emitOmsReturnEvent(order.companyId, {
        returnId: activeReturn.id,
        status: activeReturn.status,
        event: 'carrier.return_stage_updated',
        omsOrderId,
      });
    }

    this.logger.log(
      `Carrier return stage (${stage}) updated for order ${order.orderNumber} (returnNumber=${activeReturn.returnNumber}). No inventory modified.`,
    );

    return {
      success: true,
      returnId: activeReturn.id,
      stage,
      message: `Return stage updated to ${stage}. Awaiting warehouse physical confirmation.`,
    };
  }

  /**
   * Stage 2: Physical receipt confirmation at the warehouse dock.
   * ONLY this method restocks inventory and sets OmsOrder.status = 'returned'.
   * Can be triggered by warehouse staff or admin from UI.
   */
  async confirmWarehouseReturnReceipt(
    user: AuthPrincipal,
    omsReturnId: string,
    receivedLines?: Array<{ productId: string; quantity: number; locationId?: string; lotId?: string }>,
    targetLocationId?: string,
  ): Promise<{ success: boolean; returnId?: string; message?: string }> {
    this.logger.log(`Confirming physical warehouse return receipt for returnId=${omsReturnId} by user=${user.id}`);

    const omsReturn = await this.prisma.omsReturn.findUnique({
      where: { id: omsReturnId },
      include: {
        lines: true,
        omsOrder: {
          include: {
            lines: true,
            outboundOrder: { select: { id: true, status: true, orderNumber: true } },
          },
        },
      },
    });

    if (!omsReturn) {
      return { success: false, message: 'Return order not found.' };
    }

    if (omsReturn.status === OmsReturnStatus.completed) {
      return { success: true, returnId: omsReturn.id, message: 'Return already completed.' };
    }

    if (omsReturn.status === OmsReturnStatus.cancelled) {
      return { success: false, message: 'Cannot confirm a cancelled return.' };
    }

    const order = omsReturn.omsOrder;
    if (!order) {
      return { success: false, message: 'Linked OMS order not found.' };
    }

    // Resolve warehouse ID
    let warehouseId: string | null = null;
    if (order.outboundOrderId) {
      const reservation = await this.prisma.stockReservation.findFirst({
        where: { outboundOrderId: order.outboundOrderId },
        orderBy: { createdAt: 'desc' },
        select: { location: { select: { warehouseId: true } } },
      });
      warehouseId = reservation?.location.warehouseId ?? null;
    }

    if (!warehouseId) {
      const defaultWh = await this.prisma.warehouse.findFirst({
        where: { status: 'active' },
        select: { id: true },
      });
      warehouseId = defaultWh?.id ?? null;
    }

    if (!warehouseId) {
      return { success: false, message: 'Cannot resolve warehouse for return.' };
    }

    // Resolve destination Returns location
    let returnLocId = targetLocationId;
    if (!returnLocId) {
      const existingLoc = await this.prisma.location.findFirst({
        where: {
          warehouseId,
          name: { equals: 'Returns', mode: 'insensitive' },
          status: 'active',
        },
        select: { id: true },
      });

      if (existingLoc) {
        returnLocId = existingLoc.id;
      } else {
        const barcode = `RET-${Date.now().toString().slice(-6)}`;
        const createdLoc = await this.prisma.location.create({
          data: {
            warehouseId,
            name: 'Returns',
            fullPath: 'Returns',
            barcode,
            type: 'quarantine',
            status: 'active',
          },
          select: { id: true },
        });
        returnLocId = createdLoc.id;
      }
    }

    const linesToRestock = receivedLines && receivedLines.length > 0
      ? receivedLines
      : omsReturn.lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          lotId: l.lotId ?? undefined,
          locationId: returnLocId,
        }));

    const now = new Date();

    // Execute atomic restock transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Restock current_stock and append ledger entries
      for (let i = 0; i < linesToRestock.length; i++) {
        const line = linesToRestock[i];
        const targetLoc = line.locationId || returnLocId!;

        await this.stockHelpers.upsertPositiveWithMeta(tx, {
          companyId: order.companyId,
          productId: line.productId,
          locationId: targetLoc,
          warehouseId,
          lotId: line.lotId ?? null,
          quantity: line.quantity,
        });

        const idemKey = `return:warehouse_confirm:${omsReturn.id}:line:${line.productId}:${i}:post`;
        await this.ledger.appendIfAbsent(tx, idemKey, {
          companyId: order.companyId,
          productId: line.productId,
          lotId: line.lotId ?? null,
          toLocationId: targetLoc,
          movementType: MovementType.return_receive,
          quantity: new Prisma.Decimal(line.quantity),
          referenceType: LedgerRefType.return_order,
          referenceId: omsReturn.id,
          operatorId: user.id,
        });
      }

      // 2. Mark OmsReturn completed with warehouse confirmation metadata
      await tx.omsReturn.update({
        where: { id: omsReturn.id },
        data: {
          status: OmsReturnStatus.completed,
          carrierReturnStage: 'warehouse_confirmed',
          warehouseConfirmedAt: now,
          warehouseConfirmedBy: user.id,
          completedAt: now,
        },
      });

      // 3. Mark OMS Order returned
      await tx.omsOrder.update({
        where: { id: order.id },
        data: {
          status: OmsOrderStatus.returned,
          returnedAt: now,
        },
      });

      // 4. Mark Outbound Order returned if linked
      if (order.outboundOrder?.id) {
        await tx.outboundOrder.update({
          where: { id: order.outboundOrder.id },
          data: {
            status: OutboundOrderStatus.returned,
            returnedAt: now,
          },
        });
      }

      // 5. Audit log
      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: order.id,
          companyId: order.companyId,
          eventType: 'return.warehouse_confirmed',
          createdBy: user.id,
          payload: {
            omsReturnId: omsReturn.id,
            returnNumber: omsReturn.returnNumber,
            restockedLocationId: returnLocId,
            linesCount: linesToRestock.length,
          },
        },
      });
    });

    // 6. Adjust COD
    try {
      await this.codRecords.markReturnedForOrder(order.id, user);
    } catch (codErr) {
      this.logger.warn(
        `COD adjustment on warehouse return confirmation for order ${order.orderNumber}: ${
          codErr instanceof Error ? codErr.message : String(codErr)
        }`,
      );
    }

    // 7. Realtime events
    if (order.companyId) {
      this.realtime.emitOmsOrderEvent(order.companyId, {
        orderId: order.id,
        status: OmsOrderStatus.returned,
        event: 'return.warehouse_confirmed',
      });
      this.realtime.emitOmsReturnEvent(order.companyId, {
        returnId: omsReturn.id,
        status: 'completed',
        event: 'return.warehouse_confirmed',
        omsOrderId: order.id,
      });
    }

    this.logger.log(
      `Warehouse return receipt successfully confirmed for order ${order.orderNumber} (returnNumber=${omsReturn.returnNumber}).`,
    );

    return {
      success: true,
      returnId: omsReturn.id,
      message: `Return ${omsReturn.returnNumber} confirmed. Inventory restocked into warehouse.`,
    };
  }

  /**
   * Helper to confirm return receipt for an order by omsOrderId directly.
   */
  async confirmWarehouseReturnReceiptForOrder(
    user: AuthPrincipal,
    omsOrderId: string,
    targetLocationId?: string,
  ): Promise<{ success: boolean; returnId?: string; message?: string }> {
    let activeReturn = await this.prisma.omsReturn.findFirst({
      where: {
        omsOrderId,
        status: { in: [OmsReturnStatus.requested, OmsReturnStatus.approved] },
      },
      select: { id: true },
    });

    if (!activeReturn) {
      // Create draft first if not present
      const createRes = await this.processCarrierReturnEvent({
        omsOrderId,
        awb: 'MANUAL',
        stage: 'returned_to_sender',
        reason: 'Warehouse Physical Receipt Confirmation',
      });
      if (!createRes.success || !createRes.returnId) {
        return { success: false, message: createRes.message || 'Failed to initialize return draft' };
      }
      activeReturn = { id: createRes.returnId };
    }

    return this.confirmWarehouseReturnReceipt(user, activeReturn.id, undefined, targetLocationId);
  }

  /**
   * Handles carrier 'delivered' event with conflict and out-of-order resolution.
   * If an unconfirmed return draft exists, it is cancelled, order marked delivered, and COD triggered.
   * If a return was already completed and physically confirmed into inventory, reject rollback and flag conflict.
   */
  async handleCarrierDeliveredEvent(params: {
    omsOrderId: string;
    awb: string;
    timestamp?: Date;
    notes?: string;
  }): Promise<{ actionTaken: string; message?: string }> {
    const { omsOrderId, awb, notes } = params;
    const deliveredTime = params.timestamp || new Date();

    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: {
        outboundOrder: { select: { id: true } },
        omsReturns: {
          select: { id: true, returnNumber: true, status: true, carrierReturnStage: true },
        },
      },
    });

    if (!order) {
      return { actionTaken: 'order_not_found', message: 'OMS order not found' };
    }

    if (order.status === OmsOrderStatus.delivered) {
      return { actionTaken: 'order_already_delivered', message: 'Order is already marked delivered.' };
    }

    const adminUser = await this.prisma.user.findFirst({
      where: { role: 'super_admin' },
      select: { id: true, email: true },
    });
    const principal: AuthPrincipal = {
      id: adminUser?.id || '00000000-0000-4000-8000-0000000000aa',
      companyId: order.companyId,
      role: 'super_admin',
      tenantScope: 'all',
      authorizedCompanyIds: [],
    };

    // Check for any completed return
    const completedReturn = order.omsReturns.find((r) => r.status === OmsReturnStatus.completed);
    if (completedReturn) {
      this.logger.warn(
        `CONFLICT: Carrier reported DELIVERED for order ${order.orderNumber}, but return ${completedReturn.returnNumber} was already physically confirmed into inventory. Refusing to roll back inventory.`,
      );
      await this.prisma.omsOrderEvent.create({
        data: {
          omsOrderId: order.id,
          companyId: order.companyId,
          eventType: 'carrier.delivered_conflict_ignored',
          createdBy: principal.id,
          payload: {
            awb,
            notes,
            completedReturnId: completedReturn.id,
            completedReturnNumber: completedReturn.returnNumber,
            reason: 'Carrier reported delivered after warehouse physical return confirmation.',
          },
        },
      });
      return {
        actionTaken: 'carrier_delivered_conflict_ignored',
        message: 'Delivered event ignored: goods already confirmed returned in warehouse.',
      };
    }

    // Check for unconfirmed draft returns (requested or approved)
    const unconfirmedReturns = order.omsReturns.filter(
      (r) => r.status === OmsReturnStatus.requested || r.status === OmsReturnStatus.approved,
    );

    await this.prisma.$transaction(async (tx) => {
      // Auto-cancel any unconfirmed return draft
      for (const draft of unconfirmedReturns) {
        await tx.omsReturn.update({
          where: { id: draft.id },
          data: {
            status: OmsReturnStatus.cancelled,
            notes: `Auto-cancelled: carrier confirmed delivery for AWB ${awb}. ${notes || ''}`.trim(),
          },
        });
      }

      // Mark order delivered
      await tx.omsOrder.update({
        where: { id: order.id },
        data: {
          status: OmsOrderStatus.delivered,
          deliveredAt: deliveredTime,
        },
      });

      // Mark outbound order delivered
      if (order.outboundOrder?.id) {
        await tx.outboundOrder.update({
          where: { id: order.outboundOrder.id },
          data: {
            status: OutboundOrderStatus.delivered,
            deliveredAt: deliveredTime,
          },
        });
      }

      // Audit event
      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: order.id,
          companyId: order.companyId,
          eventType: 'carrier.order_delivered',
          createdBy: principal.id,
          payload: {
            awb,
            cancelledDraftReturnIds: unconfirmedReturns.map((r) => r.id),
          },
        },
      });
    });

    // Trigger COD generation if COD order
    try {
      await this.codRecords.generateForDeliveredOrder(principal, order.id);
    } catch (codErr) {
      this.logger.warn(`COD generation on delivered for order ${order.orderNumber}: ${(codErr as Error)?.message}`);
    }

    // Realtime events
    if (order.companyId) {
      this.realtime.emitOmsOrderEvent(order.companyId, {
        orderId: order.id,
        status: OmsOrderStatus.delivered,
        event: 'carrier.order_delivered',
      });
      for (const draft of unconfirmedReturns) {
        this.realtime.emitOmsReturnEvent(order.companyId, {
          returnId: draft.id,
          status: 'cancelled',
          event: 'carrier.return_cancelled_by_delivery',
          omsOrderId: order.id,
        });
      }
    }

    const actionTaken = unconfirmedReturns.length > 0 ? 'order_delivered_draft_return_cancelled' : 'order_delivered';
    return {
      actionTaken,
      message: `Order ${order.orderNumber} marked delivered.`,
    };
  }

  /**
   * Backward-compatible automated return method (maps to returned_to_sender stage).
   */
  async processAutomatedReturn(
    omsOrderId: string,
    awb: string,
    reason?: string,
  ): Promise<{ success: boolean; returnId?: string; message?: string }> {
    return this.processCarrierReturnEvent({
      omsOrderId,
      awb,
      stage: 'returned_to_sender',
      reason,
    });
  }
}
