import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboundOrderStatus, Prisma } from '@prisma/client';

import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { outboundIdsVisibleForWarehouse } from '../../common/utils/warehouse-order-scope';
import {
  InsufficientStockException,
  InvalidStateException,
  StockShortage,
} from '../../common/errors/domain-exceptions';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import { assertCalendarDateNotBeforeToday } from '../../common/utils/order-planning-date';
import { assertDiscreteUomPositiveIntegerQuantity } from '../../common/utils/discrete-uom-quantity';
import { PrismaService } from '../../common/prisma/prisma.service';
import { setTenantRlsContext, withTenantRls } from '../../common/prisma/tenant-rls';
import { LedgerIdempotencyService } from '../inventory/ledger-idempotency.service';
import { StockHelpers } from '../inventory/stock.helpers';
import {
  claimOutboundConfirmableOrder,
  finalizeOutboundShipped,
  isOutboundConfirmable,
  isOutboundPostConfirm,
  lockOutboundOrderRow,
} from './outbound-confirm-lock.util';
import {
  outboundConfirmDefersDeduction,
  taskOnlyFlows,
} from '../warehouse-workflow/feature-flags';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { BillingInvoiceCalculationService } from '../billing/billing-invoice-calculation.service';
import { adminOutboundListItem } from '../realtime/realtime-client.payload';
import { OmsOrderEventsService } from '../oms/oms-order-events.service';
import { OrderAllocationService } from '../oms/order-allocation.service';
import {
  type OmsOrderCreateExtras,
  omsOrderDataFromExtras,
} from '../oms/oms-order.types';
import { WorkflowBootstrapService } from '../warehouse-workflow/workflow-bootstrap.service';
import { CreateOutboundOrderDto } from './dto/create-outbound.dto';
import { ConfirmOutboundBodyDto } from './dto/confirm-outbound-body.dto';
import { ListOutboundQueryDto } from './dto/list-outbound-query.dto';
import { QuickDirectedOutboundDto } from './dto/quick-directed-outbound.dto';
import {
  buildQuickDirectedPickMessages,
  type QuickDirectedPickSlice,
  type QuickDirectedOutboundResult,
} from './quick-directed-outbound.helper';
import { findWarehouseStockFefo } from '../warehouse-workflow/task-allocation.helper';
import { QUICK_DIRECTED_OUTBOUND_REF_PREFIX } from './quick-directed-outbound.constants';

interface StockRow {
  id: string;
  productId: string;
  locationId: string;
  warehouseId: string;
  lotId: string | null;
  quantityAvailable: Prisma.Decimal;
  expiryDate: Date | null;
  createdAt: Date;
}

const ORDER_INCLUDE = {
  company: { select: { id: true, name: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          barcode: true,
          status: true,
          trackingType: true,
          uom: true,
        },
      },
    },
  },
} satisfies Prisma.OutboundOrderInclude;

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONFIRM_LINE_INCLUDE = {
  orderBy: { lineNumber: 'asc' as const },
  include: { product: { select: { status: true } } },
};

@Injectable()
export class OutboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockHelpers,
    private readonly ledger: LedgerIdempotencyService,
    private readonly config: ConfigService,
    private readonly workflowBootstrap: WorkflowBootstrapService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly companyAccess: CompanyAccessService,
    private readonly audit: AuditLogService,
    private readonly billingAccess: BillingAccessService,
    private readonly billingInvoiceCalc: BillingInvoiceCalculationService,
    @Optional()
    @Inject(forwardRef(() => OrderAllocationService))
    private readonly orderAllocation?: OrderAllocationService,
    @Optional()
    @Inject(forwardRef(() => OmsOrderEventsService))
    private readonly omsEvents?: OmsOrderEventsService,
  ) {}

  /**
   * Hard-validates per-product stock availability across the company before
   * the order is persisted. If any product's *summed* line quantity exceeds
   * the aggregate `current_stock.quantity_available`, the request is rejected
   * with `INSUFFICIENT_STOCK` and a structured `details[]` payload.
   *
   * Note: there is still a small race between this check and confirm-time
   * deduction; `confirmAndDeduct` retains its atomic decrement guards as a
   * safety net.
   */
  async create(
    user: AuthPrincipal,
    dto: CreateOutboundOrderDto,
    opts?: { pendingClientApproval?: boolean; oms?: OmsOrderCreateExtras },
  ) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.billingAccess.assertOperationalBilling(companyId);

    return withTenantRls(this.prisma, user, async (tx) => {
    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        companyId: true,
        sku: true,
        name: true,
        status: true,
        uom: true,
      },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }
    const wrongCompany = products.find((p) => p.companyId !== companyId);
    if (wrongCompany) {
      throw new BadRequestException(
        'All line products must belong to the same company as the order.',
      );
    }
    for (const p of products) {
      assertProductOrderableForOrders(p.status);
    }

    assertCalendarDateNotBeforeToday(dto.requiredShipDate, 'Required ship date');

    const productById = new Map(products.map((p) => [p.id, p]));
    for (const l of dto.lines) {
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.requestedQuantity, 'Requested quantity');
    }

    await this.assertSufficientStockForLines(companyId, dto.lines, products);

    const created = await tx.outboundOrder.create({
      data: {
        companyId,
        status: opts?.pendingClientApproval ? OutboundOrderStatus.pending_approval : undefined,
        destinationAddress: dto.destinationAddress,
        requiredShipDate: new Date(dto.requiredShipDate),
        carrier: dto.carrier,
        clientReference: dto.clientReference,
        notes: dto.notes,
        requiresPacking: dto.requiresPacking !== false,
        createdBy: user.id,
        ...omsOrderDataFromExtras(opts?.oms),
        lines: {
          create: dto.lines.map((l, idx) => {
            const extras = opts?.oms?.lineExtras?.[idx];
            return {
              productId: l.productId,
              requestedQuantity: new Prisma.Decimal(l.requestedQuantity),
              specificLotId: l.specificLotId,
              lineNumber: idx + 1,
              unitPrice:
                extras?.unitPrice != null
                  ? new Prisma.Decimal(extras.unitPrice)
                  : undefined,
              lineTotal:
                extras?.lineTotal != null
                  ? new Prisma.Decimal(extras.lineTotal)
                  : undefined,
              discountAmount:
                extras?.discountAmount != null
                  ? new Prisma.Decimal(extras.discountAmount)
                  : undefined,
            };
          }),
        },
      },
      include: ORDER_INCLUDE,
    });

    if (opts?.oms?.recordOmsEvent !== false && this.omsEvents) {
      await this.omsEvents.record(tx, {
        outboundOrderId: created.id,
        companyId: created.companyId,
        eventType: 'order.created',
        createdBy: user.id,
        payload: { source: opts?.oms ? 'oms' : 'wms' },
      });
    }

    if (
      this.orderAllocation?.isEnabled() &&
      opts?.oms?.allocateAfterCreate !== false &&
      !opts?.pendingClientApproval
    ) {
      await this.orderAllocation.allocateOrder(tx, {
        outboundOrderId: created.id,
        companyId: created.companyId,
        warehouseId: opts?.oms?.warehouseId,
        actorUserId: user.id,
        previousStatus: created.status,
        lines: created.lines.map((line) => ({
          outboundOrderLineId: line.id,
          productId: line.productId,
          requestedQty: line.requestedQuantity,
          specificLotId: line.specificLotId,
        })),
      });
    }

    const fresh = await tx.outboundOrder.findUnique({
      where: { id: created.id },
      include: ORDER_INCLUDE,
    });
    const result = fresh ?? created;
    this.realtime.emitOutboundOrderCreated(result.companyId, {
      orderId: result.id,
      status: result.status,
      listItem: adminOutboundListItem(result),
    });
    if (opts?.pendingClientApproval) {
      await this.notifications.notifyAdminsPendingApproval({
        companyId: result.companyId,
        companyName: result.company.name,
        orderType: 'outbound',
        orderId: result.id,
        orderNumber: result.orderNumber,
      });
    }
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'OUTBOUND_ORDER_CREATED',
        resourceType: 'outbound_order',
        resourceId: result.id,
        companyId: result.companyId,
        newState: {
          status: result.status,
          lineCount: result.lines.length,
          requiresPacking: result.requiresPacking,
        },
      }),
    );
    return result;
    });
  }

  /** Rejects when summed line qty per product exceeds aggregate available stock. */
  private async assertSufficientStockForLines(
    companyId: string,
    lines: { productId: string; requestedQuantity: number }[],
    products: { id: string; sku: string }[],
  ): Promise<void> {
    const productIds = Array.from(new Set(lines.map((l) => l.productId)));
    const requestedByProduct = new Map<string, Prisma.Decimal>();
    for (const l of lines) {
      const cur = requestedByProduct.get(l.productId) ?? new Prisma.Decimal(0);
      requestedByProduct.set(
        l.productId,
        cur.plus(new Prisma.Decimal(l.requestedQuantity)),
      );
    }

    const availability = await this.prisma.currentStock.groupBy({
      by: ['productId'],
      where: {
        companyId,
        productId: { in: productIds },
        status: 'available',
      },
      _sum: { quantityAvailable: true },
    });
    const availMap = new Map<string, Prisma.Decimal>(
      availability.map((a) => [
        a.productId,
        a._sum.quantityAvailable ?? new Prisma.Decimal(0),
      ]),
    );

    const shortages: StockShortage[] = [];
    for (const [productId, requested] of requestedByProduct.entries()) {
      const available = availMap.get(productId) ?? new Prisma.Decimal(0);
      if (requested.greaterThan(available)) {
        shortages.push({
          productId,
          requested: requested.toString(),
          available: available.toString(),
        });
      }
    }
    if (shortages.length > 0) {
      const productById = new Map(products.map((p) => [p.id, p]));
      const summary = shortages
        .map((s) => {
          const p = productById.get(s.productId);
          const sku = p?.sku ?? s.productId;
          return `${sku}: ${s.available}`;
        })
        .join('; ');
      throw new InsufficientStockException(
        `Insufficient stock. Available: ${summary}`,
        shortages,
      );
    }
  }

  async list(user: AuthPrincipal, query: ListOutboundQueryDto) {
    const baseAnd: Prisma.OutboundOrderWhereInput[] = [];
    const where: Prisma.OutboundOrderWhereInput = {};

    const companyId = readCompanyIdCatalogFilter(this.companyAccess, user, query.companyId);
    if (companyId) {
      where.companyId = companyId;
    }
    if (query.status) where.status = query.status;

    if (query.orderSearch?.trim()) {
      const t = query.orderSearch.trim();
      const orParts: Prisma.OutboundOrderWhereInput[] = [
        { orderNumber: { contains: t, mode: 'insensitive' } },
      ];
      if (FULL_UUID.test(t)) orParts.push({ id: t });
      baseAnd.push({ OR: orParts });
    }

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    if (query.warehouseId) {
      const scope = await outboundIdsVisibleForWarehouse(this.prisma, query.warehouseId, {
        ...(companyId ? { companyId } : {}),
      });
      baseAnd.push(scope);
    }

    if (query.quickDirectedOnly === true) {
      baseAnd.push({
        clientReference: { startsWith: QUICK_DIRECTED_OUTBOUND_REF_PREFIX },
      });
    } else if (query.quickDirectedOnly === false) {
      baseAnd.push({
        OR: [
          { clientReference: null },
          { NOT: { clientReference: { startsWith: QUICK_DIRECTED_OUTBOUND_REF_PREFIX } } },
        ],
      });
    }

    if (baseAnd.length > 0) where.AND = baseAnd;

    const listInclude = {
      company: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
      ...(query.quickDirectedOnly
        ? {
            lines: {
              take: 1,
              orderBy: { lineNumber: 'asc' as const },
              include: {
                product: { select: { id: true, sku: true, name: true, barcode: true } },
              },
            },
          }
        : {}),
    } satisfies Prisma.OutboundOrderInclude;

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.outboundOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: listInclude,
          take: query.limit,
          skip: query.offset,
        }),
        tx.outboundOrder.count({ where }),
      ]);
      return { items, total, limit: query.limit, offset: query.offset };
    });
  }

  async findById(id: string, user: AuthPrincipal) {
    return withTenantRls(this.prisma, user, async (tx) => {
      const order = await tx.outboundOrder.findUnique({
        where: { id },
        include: ORDER_INCLUDE,
      });
      if (!order) throw new NotFoundException('Outbound order not found.');
      this.companyAccess.validateResourceOwnership(user, order);
      return order;
    });
  }

  async cancel(id: string, user: AuthPrincipal) {
    const order = await this.findById(id, user);
    // An order can be cancelled any time before it ships. Stock is only deducted
    // when dispatch completes (status becomes `shipped`), so cancelling an
    // in-progress order never needs to touch — or restore — inventory.
    if (
      order.status === OutboundOrderStatus.shipped ||
      order.status === OutboundOrderStatus.cancelled
    ) {
      throw new InvalidStateException(
        `Outbound orders cannot be cancelled once ${order.status} (current: ${order.status}).`,
      );
    }
    const previousStatus = order.status;
    const cancelled = await withTenantRls(this.prisma, user, async (tx) => {
      if (this.orderAllocation?.isEnabled()) {
        await this.orderAllocation.releaseAllocation(tx, {
          outboundOrderId: id,
          companyId: order.companyId,
          actorUserId: user.id,
        });
      }
      // Tear down all remaining work for this order: deleting the workflow
      // instance cascades its nodes, tasks, assignments and events. No inventory
      // is moved — product quantities are left exactly as they are.
      await tx.workflowInstance.deleteMany({
        where: { referenceType: 'outbound_order', referenceId: id },
      });
      return tx.outboundOrder.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.id },
        include: ORDER_INCLUDE,
      });
    });
    this.realtime.emitOutboundOrderUpdated(cancelled.companyId, {
      orderId: cancelled.id,
      status: cancelled.status,
      listItem: adminOutboundListItem(cancelled),
      reason: 'cancel',
    });
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'OUTBOUND_ORDER_CANCELLED',
        resourceType: 'outbound_order',
        resourceId: cancelled.id,
        companyId: cancelled.companyId,
        previousState: { status: previousStatus },
        newState: { status: cancelled.status, cancelledBy: user.id },
      }),
    );
    return cancelled;
  }

  /**
   * Permanently delete an outbound order that has not been confirmed/completed.
   * Only allowed for draft, pending-approval, or cancelled orders. Order lines
   * are removed via cascade; any stray workflow rows are cleaned defensively.
   */
  async remove(id: string, user: AuthPrincipal) {
    const order = await this.findById(id, user);
    // Only cancelled orders may be permanently deleted. Every other status must
    // be cancelled first.
    if (order.status !== OutboundOrderStatus.cancelled) {
      throw new InvalidStateException(
        `Only cancelled outbound orders can be deleted. Cancel the order first (current: ${order.status}).`,
      );
    }

    await withTenantRls(this.prisma, user, async (tx) => {
      // Safety net: these states never have stock movements. Refuse rather than
      // silently destroy ledger history if any unexpectedly exist.
      const ledgerCount = await tx.inventoryLedger.count({
        where: { referenceType: 'outbound_order', referenceId: id },
      });
      if (ledgerCount > 0) {
        throw new InvalidStateException(
          'This order has stock movements recorded and cannot be deleted.',
        );
      }
      // No workflows exist for these states, but clean any orphan rows defensively
      // (workflow instances are not FK-linked to the order).
      await tx.workflowInstance.deleteMany({
        where: { referenceType: 'outbound_order', referenceId: id },
      });
      await tx.outboundOrder.delete({ where: { id } });
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'OUTBOUND_ORDER_DELETED',
        resourceType: 'outbound_order',
        resourceId: id,
        companyId: order.companyId,
        previousState: { status: order.status, orderNumber: order.orderNumber },
        newState: { deleted: true },
      }),
    );
    this.realtime.emitOutboundOrderUpdated(order.companyId, {
      orderId: id,
      status: order.status,
      reason: 'delete',
      listItem: adminOutboundListItem(order),
    });
    return { id, deleted: true };
  }

  /**
   * Phase 1 simplified outbound flow: draft → (confirm) → shipped.
   * Stock validation already happened at create time; the FEFO walk and
   * per-row decrement guards still run as defence-in-depth in case stock
   * was drained between create and confirm.
   */
  /** Confirms a draft outbound order without stock deduction (workflow dispatch completes shipping). */
  async confirmWithoutDeduction(user: AuthPrincipal, orderId: string) {
    const before = await withTenantRls(this.prisma, user, async (tx) =>
      tx.outboundOrder.findUnique({
        where: { id: orderId },
        select: { status: true, companyId: true, orderNumber: true, id: true },
      }),
    );
    if (before) {
      this.companyAccess.validateResourceOwnership(user, before);
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      await setTenantRlsContext(tx, user);
      const gate = await this.gateConfirmTransaction(tx, user, orderId);
      if (gate.kind === 'idempotent') {
        return { idempotent: true as const, order: gate.order };
      }

      await this.tryAllocateOnConfirm(tx, user, gate.order);

      const claimed = await claimOutboundConfirmableOrder(tx, orderId, {
        status: OutboundOrderStatus.picking,
        confirmedAt: new Date(),
        pickingStartedAt: new Date(),
      });
      if (!claimed) {
        const replay = await tx.outboundOrder.findUnique({
          where: { id: orderId },
          include: ORDER_INCLUDE,
        });
        if (!replay) throw new NotFoundException('Outbound order not found.');
        return { idempotent: true as const, order: replay };
      }

      const updated = await tx.outboundOrder.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
      if (!updated) throw new NotFoundException('Outbound order not found.');
      return { idempotent: false as const, order: updated };
    });

    if (txResult.idempotent) {
      return txResult.order;
    }

    const updated = txResult.order;
    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'confirm_without_deduction',
      listItem: adminOutboundListItem(updated),
    });
    if (before?.status === OutboundOrderStatus.pending_approval) {
      await this.notifications.notifyClientOrderConfirmed({
        companyId: before.companyId,
        orderType: 'outbound',
        orderId: before.id,
        orderNumber: before.orderNumber,
      });
      await this.notifications.dismissPendingAdminNotifications('outbound_order', before.id);
    }
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'OUTBOUND_ORDER_CONFIRMED',
        resourceType: 'outbound_order',
        resourceId: updated.id,
        companyId: updated.companyId,
        previousState: { status: before?.status ?? null },
        newState: { status: updated.status },
      }),
    );
    return updated;
  }

  async confirmAndDeduct(user: AuthPrincipal, orderId: string, body?: ConfirmOutboundBodyDto) {
    const before = await withTenantRls(this.prisma, user, async (tx) =>
      tx.outboundOrder.findUnique({
        where: { id: orderId },
        select: { status: true, companyId: true, orderNumber: true, id: true },
      }),
    );
    if (!before) throw new NotFoundException('Outbound order not found.');
    this.companyAccess.validateResourceOwnership(user, before);

    if (taskOnlyFlows(this.config)) {
      if (!body?.warehouseId) {
        throw new BadRequestException(
          'When TASK_ONLY_FLOWS=true, confirm body must include warehouseId for workflow bootstrap.',
        );
      }
      const wh = body.warehouseId;
      const txResult = await this.prisma.$transaction(async (tx) => {
        await setTenantRlsContext(tx, user);
        const gate = await this.gateConfirmTransaction(tx, user, orderId);
        if (gate.kind === 'idempotent') {
          return { fresh: false as const, order: gate.order };
        }

        await this.tryAllocateOnConfirm(tx, user, gate.order, wh);

        const claimed = await claimOutboundConfirmableOrder(tx, orderId, {
          status: OutboundOrderStatus.picking,
          confirmedAt: new Date(),
          pickingStartedAt: new Date(),
        });
        if (!claimed) {
          const replay = await tx.outboundOrder.findUnique({
            where: { id: orderId },
            include: ORDER_INCLUDE,
          });
          if (!replay) throw new NotFoundException('Outbound order not found.');
          return { fresh: false as const, order: replay };
        }

        await this.workflowBootstrap.startOutboundWorkflowTx(tx, user, orderId, wh);
        const order = await tx.outboundOrder.findUnique({
          where: { id: orderId },
          include: ORDER_INCLUDE,
        });
        if (!order) throw new NotFoundException('Outbound order not found.');
        return { fresh: true as const, order };
      });

      if (!txResult.fresh) {
        return txResult.order;
      }

      const wfConfirmed = txResult.order;
      this.realtime.emitOutboundOrderUpdated(wfConfirmed.companyId, {
        orderId: wfConfirmed.id,
        status: wfConfirmed.status,
        reason: 'confirm_task_flow',
        listItem: adminOutboundListItem(wfConfirmed),
      });
      if (before.status === OutboundOrderStatus.pending_approval) {
        await this.notifications.notifyClientOrderConfirmed({
          companyId: before.companyId,
          orderType: 'outbound',
          orderId: before.id,
          orderNumber: before.orderNumber,
        });
        await this.notifications.dismissPendingAdminNotifications('outbound_order', before.id);
      }
      await this.audit.log(
        this.audit.fromPrincipal(user, {
          action: 'OUTBOUND_ORDER_CONFIRMED',
          resourceType: 'outbound_order',
          resourceId: wfConfirmed.id,
          companyId: wfConfirmed.companyId,
          previousState: { status: before.status },
          newState: { status: wfConfirmed.status, flow: 'task_only' },
        }),
      );
      return wfConfirmed;
    }

    if (outboundConfirmDefersDeduction(this.config)) {
      return this.confirmWithoutDeduction(user, orderId);
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      await setTenantRlsContext(tx, user);
      const gate = await this.gateConfirmTransaction(tx, user, orderId);
      if (gate.kind === 'idempotent') {
        return { fresh: false as const, order: gate.order };
      }

      await this.tryAllocateOnConfirm(tx, user, gate.order, body?.warehouseId);

      const claimed = await claimOutboundConfirmableOrder(tx, orderId, {
        status: OutboundOrderStatus.picking,
        confirmedAt: new Date(),
        pickingStartedAt: new Date(),
      });
      if (!claimed) {
        const replay = await tx.outboundOrder.findUnique({
          where: { id: orderId },
          include: ORDER_INCLUDE,
        });
        if (!replay) throw new NotFoundException('Outbound order not found.');
        return { fresh: false as const, order: replay };
      }

      await this.deductOutboundOrderLines(tx, user, gate.order, orderId);
      const finalized = await finalizeOutboundShipped(tx, orderId);
      if (!finalized) {
        throw new InvalidStateException('Outbound confirm could not finalize to shipped.');
      }

      const shipped = await tx.outboundOrder.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
      if (!shipped) throw new NotFoundException('Outbound order not found.');
      return { fresh: true as const, order: shipped };
    });

    if (!txResult.fresh) {
      return txResult.order;
    }

    const shipped = txResult.order;
    this.realtime.emitOutboundOrderUpdated(shipped.companyId, {
      orderId: shipped.id,
      status: shipped.status,
      reason: 'confirm_and_deduct',
      listItem: adminOutboundListItem(shipped),
    });
    this.realtime.emitInventoryChanged(shipped.companyId, {
      source: 'outbound_ship',
      orderId: shipped.id,
      productId: shipped.lines[0]?.productId,
    });
    if (before?.status === OutboundOrderStatus.pending_approval) {
      await this.notifications.notifyClientOrderConfirmed({
        companyId: before.companyId,
        orderType: 'outbound',
        orderId: before.id,
        orderNumber: before.orderNumber,
      });
      await this.notifications.dismissPendingAdminNotifications('outbound_order', before.id);
    }
    await this.notifications.notifyClientOrderCompleted({
      companyId: shipped.companyId,
      orderType: 'outbound',
      orderId: shipped.id,
      orderNumber: shipped.orderNumber,
    });
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'OUTBOUND_ORDER_SHIPPED',
        resourceType: 'outbound_order',
        resourceId: shipped.id,
        companyId: shipped.companyId,
        previousState: { status: before.status },
        newState: { status: shipped.status, shippedAt: shipped.shippedAt?.toISOString() ?? null },
      }),
    );
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'INVENTORY_MUTATION_APPLIED',
        resourceType: 'outbound_order',
        resourceId: shipped.id,
        companyId: shipped.companyId,
        newState: { source: 'confirm_and_deduct', movementType: 'outbound_pick' },
      }),
    );
    void this.billingInvoiceCalc.recalculateForCompany(
      shipped.companyId,
      'outbound_completed',
    );
    return shipped;
  }

  private async gateConfirmTransaction(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    orderId: string,
  ): Promise<
    | {
        kind: 'idempotent';
        order: Prisma.OutboundOrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
      }
    | {
        kind: 'proceed';
        order: Prisma.OutboundOrderGetPayload<{
          include: { lines: typeof CONFIRM_LINE_INCLUDE };
        }>;
      }
  > {
    await lockOutboundOrderRow(tx, orderId);

    const order = await tx.outboundOrder.findUnique({
      where: { id: orderId },
      include: { lines: CONFIRM_LINE_INCLUDE },
    });
    if (!order) throw new NotFoundException('Outbound order not found.');
    this.companyAccess.validateResourceOwnership(user, order);

    if (isOutboundPostConfirm(order.status)) {
      const full = await tx.outboundOrder.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
      if (!full) throw new NotFoundException('Outbound order not found.');
      return { kind: 'idempotent', order: full };
    }

    if (!isOutboundConfirmable(order.status)) {
      throw new InvalidStateException(
        `Only draft or pending-approval orders can be confirmed (current: ${order.status}).`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException('Cannot confirm an order with no lines.');
    }
    for (const line of order.lines) {
      assertProductOrderableForOrders(line.product.status);
    }

    return { kind: 'proceed', order };
  }

  /** OMS allocation on confirm when ALLOCATE_ON_ORDER_CREATE is enabled (skips if already reserved). */
  private async tryAllocateOnConfirm(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    order: Prisma.OutboundOrderGetPayload<{ include: { lines: typeof CONFIRM_LINE_INCLUDE } }>,
    warehouseId?: string,
  ): Promise<void> {
    if (!this.orderAllocation?.isEnabled()) return;
    const has = await this.orderAllocation.hasActiveReservations(tx, order.id);
    if (has) return;

    await this.orderAllocation.allocateOrder(tx, {
      outboundOrderId: order.id,
      companyId: order.companyId,
      warehouseId,
      actorUserId: user.id,
      previousStatus: order.status,
      lines: order.lines.map((line) => ({
        outboundOrderLineId: line.id,
        productId: line.productId,
        requestedQty: line.requestedQuantity,
        specificLotId: line.specificLotId,
      })),
    });
  }

  private async deductOutboundOrderLines(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    order: Prisma.OutboundOrderGetPayload<{ include: { lines: typeof CONFIRM_LINE_INCLUDE } }>,
    orderId: string,
  ): Promise<void> {
    for (const line of order.lines) {
      const requested = line.requestedQuantity;
      let remaining = new Prisma.Decimal(requested.toString());

      const candidates = await this.findStockCandidates(
        tx,
        order.companyId,
        line.productId,
        line.specificLotId,
      );

      for (const row of candidates) {
        if (remaining.lessThanOrEqualTo(0)) break;

        const take = Prisma.Decimal.min(remaining, row.quantityAvailable);
        if (take.lessThanOrEqualTo(0)) continue;

        const meta = await this.stock.decrementWithMeta(tx, {
          companyId: order.companyId,
          productId: line.productId,
          locationId: row.locationId,
          lotId: row.lotId,
          quantity: take.toString(),
        });

        const idempotencyKey = `bm:outbound:${orderId}:${line.productId}:line:${line.id}:loc:${row.locationId}:lot:${row.lotId ?? 'null'}:${take.toString()}`;
        await this.ledger.appendIfAbsent(tx, idempotencyKey, {
          companyId: order.companyId,
          productId: line.productId,
          lotId: row.lotId,
          fromLocationId: row.locationId,
          movementType: 'outbound_pick',
          quantity: take,
          quantityBefore: meta.before,
          quantityAfter: meta.after,
          referenceType: 'outbound_order',
          referenceId: orderId,
          operatorId: user.id,
        });

        remaining = remaining.minus(take);
      }

      if (remaining.greaterThan(0)) {
        const agg = await tx.currentStock.aggregate({
          where: {
            companyId: order.companyId,
            productId: line.productId,
            status: 'available',
          },
          _sum: { quantityAvailable: true },
        });
        const available = agg._sum.quantityAvailable?.toString() ?? '0';
        throw new InsufficientStockException(
          `Insufficient stock. Available: ${available}`,
          [
            {
              productId: line.productId,
              requested: requested.toString(),
              available,
            },
          ],
        );
      }

      await tx.outboundOrderLine.update({
        where: { id: line.id },
        data: {
          pickedQuantity: requested,
          status: 'done',
        },
      });
    }
  }

  private async findStockCandidates(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string,
    specificLotId?: string | null,
  ): Promise<StockRow[]> {
    const lotFilter = specificLotId
      ? Prisma.sql`AND cs.lot_id = ${specificLotId}::uuid`
      : Prisma.empty;

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        product_id: string;
        location_id: string;
        warehouse_id: string;
        lot_id: string | null;
        quantity_available: string;
        expiry_date: Date | null;
        created_at: Date;
      }>
    >(Prisma.sql`
      SELECT cs.id,
             cs.product_id,
             cs.location_id,
             cs.warehouse_id,
             cs.lot_id,
             cs.quantity_available::text AS quantity_available,
             l.expiry_date,
             cs.last_movement_at AS created_at
        FROM current_stock cs
   LEFT JOIN lots l ON l.id = cs.lot_id
       WHERE cs.company_id = ${companyId}::uuid
         AND cs.product_id = ${productId}::uuid
         AND cs.status = 'available'
         AND cs.quantity_available > 0
         ${lotFilter}
    ORDER BY (l.expiry_date IS NULL),
             l.expiry_date ASC,
             cs.last_movement_at ASC NULLS LAST,
             cs.id ASC
    `);

    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      locationId: r.location_id,
      warehouseId: r.warehouse_id,
      lotId: r.lot_id,
      quantityAvailable: new Prisma.Decimal(r.quantity_available),
      expiryDate: r.expiry_date,
      createdAt: r.created_at,
    }));
  }

  /**
   * One-step directed outbound: allocate by warehouse FEFO/FIFO, deduct stock,
   * close the order as shipped, and return pick directions for the operator.
   */
  async quickDirectedOutbound(
    user: AuthPrincipal,
    dto: QuickDirectedOutboundDto,
  ): Promise<QuickDirectedOutboundResult> {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.billingAccess.assertOperationalBilling(companyId);

    const productCode = dto.productCode.trim();
    if (!productCode) {
      throw new BadRequestException('Product barcode or SKU is required.');
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      await setTenantRlsContext(tx, user);

      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, status: 'active' },
        select: { id: true, name: true },
      });
      if (!warehouse) {
        throw new NotFoundException('Warehouse not found.');
      }

      const product = await tx.product.findFirst({
        where: {
          companyId,
          OR: [
            { barcode: { equals: productCode, mode: 'insensitive' } },
            { sku: { equals: productCode, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          sku: true,
          name: true,
          barcode: true,
          status: true,
          uom: true,
        },
      });
      if (!product) {
        throw new NotFoundException('Product not found for the given barcode or SKU.');
      }
      assertProductOrderableForOrders(product.status);
      assertDiscreteUomPositiveIntegerQuantity(product.uom, dto.quantity, 'Quantity');

      const requested = new Prisma.Decimal(dto.quantity);
      const warehouseAgg = await tx.currentStock.aggregate({
        where: {
          companyId,
          warehouseId: dto.warehouseId,
          productId: product.id,
          status: 'available',
        },
        _sum: { quantityAvailable: true },
      });
      const warehouseAvailable = warehouseAgg._sum.quantityAvailable ?? new Prisma.Decimal(0);
      if (requested.greaterThan(warehouseAvailable)) {
        throw new InsufficientStockException(
          `Insufficient stock in warehouse. Available: ${warehouseAvailable.toString()}`,
          [
            {
              productId: product.id,
              requested: requested.toString(),
              available: warehouseAvailable.toString(),
            },
          ],
        );
      }

      const today = new Date();
      const shipDate = today.toISOString().slice(0, 10);
      const order = await tx.outboundOrder.create({
        data: {
          companyId,
          destinationAddress: `Quick directed outbound — ${warehouse.name}`,
          requiredShipDate: new Date(shipDate),
          requiresPacking: false,
          notes: `Quick directed outbound | reason: ${dto.reasonCode}`,
          clientReference: `${QUICK_DIRECTED_OUTBOUND_REF_PREFIX}${dto.reasonCode}`,
          createdBy: user.id,
          lines: {
            create: [
              {
                productId: product.id,
                requestedQuantity: requested,
                lineNumber: 1,
              },
            ],
          },
        },
        include: { lines: true },
      });

      await lockOutboundOrderRow(tx, order.id);
      const claimed = await claimOutboundConfirmableOrder(tx, order.id, {
        status: OutboundOrderStatus.picking,
        confirmedAt: new Date(),
        pickingStartedAt: new Date(),
      });
      if (!claimed) {
        throw new InvalidStateException('Quick directed outbound could not claim the order.');
      }

      const line = order.lines[0]!;
      const candidates = await findWarehouseStockFefo(
        tx,
        companyId,
        dto.warehouseId,
        product.id,
      );

      let remaining = new Prisma.Decimal(requested.toString());
      const pickSlices: Array<{
        locationId: string;
        lotId: string | null;
        quantity: Prisma.Decimal;
      }> = [];

      for (const row of candidates) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const take = Prisma.Decimal.min(remaining, row.quantityAvailable);
        if (take.lessThanOrEqualTo(0)) continue;

        const meta = await this.stock.decrementWithMeta(tx, {
          companyId,
          productId: product.id,
          locationId: row.locationId,
          lotId: row.lotId,
          quantity: take.toString(),
        });

        const idempotencyKey = `bm:quick-outbound:${order.id}:${product.id}:line:${line.id}:loc:${row.locationId}:lot:${row.lotId ?? 'null'}:${take.toString()}`;
        await this.ledger.appendIfAbsent(tx, idempotencyKey, {
          companyId,
          productId: product.id,
          lotId: row.lotId,
          fromLocationId: row.locationId,
          movementType: 'outbound_pick',
          quantity: take,
          quantityBefore: meta.before,
          quantityAfter: meta.after,
          referenceType: 'outbound_order',
          referenceId: order.id,
          operatorId: user.id,
        });

        pickSlices.push({
          locationId: row.locationId,
          lotId: row.lotId,
          quantity: take,
        });
        remaining = remaining.minus(take);
      }

      if (remaining.greaterThan(0)) {
        throw new InsufficientStockException(
          `Insufficient stock. Available: ${warehouseAvailable.toString()}`,
          [
            {
              productId: product.id,
              requested: requested.toString(),
              available: warehouseAvailable.toString(),
            },
          ],
        );
      }

      await tx.outboundOrderLine.update({
        where: { id: line.id },
        data: {
          pickedQuantity: requested,
          status: 'done',
        },
      });

      const finalized = await finalizeOutboundShipped(tx, order.id);
      if (!finalized) {
        throw new InvalidStateException('Quick directed outbound could not finalize to shipped.');
      }

      const locationIds = [...new Set(pickSlices.map((slice) => slice.locationId))];
      const locations = await tx.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, fullPath: true, name: true, barcode: true },
      });
      const locationById = new Map(locations.map((loc) => [loc.id, loc]));

      const lotIds = pickSlices.map((slice) => slice.lotId).filter((id): id is string => !!id);
      const lots =
        lotIds.length === 0
          ? []
          : await tx.lot.findMany({
              where: { id: { in: lotIds } },
              select: { id: true, lotNumber: true },
            });
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));

      const directedPick: QuickDirectedPickSlice[] = pickSlices.map((slice) => {
        const loc = locationById.get(slice.locationId);
        const locationLabel = loc?.fullPath || loc?.name || loc?.barcode || slice.locationId;
        const lot = slice.lotId ? lotById.get(slice.lotId) : null;
        return {
          locationId: slice.locationId,
          locationLabel,
          quantity: slice.quantity.toString(),
          lotNumber: lot?.lotNumber ?? null,
        };
      });

      const shipped = await tx.outboundOrder.findUnique({
        where: { id: order.id },
        select: { id: true, orderNumber: true, status: true },
      });
      if (!shipped) {
        throw new NotFoundException('Outbound order not found.');
      }

      const messages = buildQuickDirectedPickMessages(directedPick);

      return {
        orderId: shipped.id,
        orderNumber: shipped.orderNumber,
        status: shipped.status,
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          barcode: product.barcode,
          uom: product.uom,
        },
        totalQuantity: requested.toString(),
        reasonCode: dto.reasonCode,
        directedPick,
        ...messages,
      };
    });

    this.realtime.emitOutboundOrderCreated(companyId, {
      orderId: txResult.orderId,
      status: txResult.status,
      listItem: {
        id: txResult.orderId,
        orderNumber: txResult.orderNumber,
        status: txResult.status,
        companyId,
        destinationAddress: `Quick directed outbound`,
        requiredShipDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lineCount: 1,
      },
    });
    this.realtime.emitOutboundOrderUpdated(companyId, {
      orderId: txResult.orderId,
      status: txResult.status,
      reason: 'quick_directed_outbound',
      listItem: {
        id: txResult.orderId,
        orderNumber: txResult.orderNumber,
        status: txResult.status,
        companyId,
        destinationAddress: `Quick directed outbound`,
        requiredShipDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lineCount: 1,
      },
    });
    this.realtime.emitInventoryChanged(companyId, {
      source: 'quick_directed_outbound',
      orderId: txResult.orderId,
      productId: txResult.product.id,
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'QUICK_DIRECTED_OUTBOUND',
        resourceType: 'outbound_order',
        resourceId: txResult.orderId,
        companyId,
        newState: {
          orderNumber: txResult.orderNumber,
          productId: txResult.product.id,
          quantity: txResult.totalQuantity,
          reasonCode: txResult.reasonCode,
          directedPick: txResult.directedPick,
        },
      }),
    );
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'OUTBOUND_ORDER_SHIPPED',
        resourceType: 'outbound_order',
        resourceId: txResult.orderId,
        companyId,
        newState: {
          status: txResult.status,
          flow: 'quick_directed',
        },
      }),
    );
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'INVENTORY_MUTATION_APPLIED',
        resourceType: 'outbound_order',
        resourceId: txResult.orderId,
        companyId,
        newState: {
          source: 'quick_directed_outbound',
          movementType: 'outbound_pick',
        },
      }),
    );

    void this.billingInvoiceCalc.recalculateForCompany(companyId, 'outbound_completed');

    return txResult;
  }
}
