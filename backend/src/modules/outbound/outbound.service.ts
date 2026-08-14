import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CarrierShipmentStatus,
  OutboundOrderStatus,
  Prisma,
  ShippingMethod,
  WarehouseTaskStatus,
  WarehouseTaskType,
} from '@prisma/client';

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
import { omsBlocksWarehouseExecution } from '../oms/oms-warehouse-guards';
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
import {
  assertOutboundAdminPlanComplete,
  normalizeExecutionMode,
  parseOutboundExecutionPlan,
} from '../orders/execution-plan.util';
import { WorkflowBootstrapService } from '../warehouse-workflow/workflow-bootstrap.service';
import { WarehouseTasksService } from '../warehouse-workflow/warehouse-tasks.service';
import { WorkflowOrchestrationService } from '../warehouse-workflow/workflow-orchestration.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { BillingInvoiceCalculationService } from '../billing/billing-invoice-calculation.service';
import { adminOutboundListItem } from '../realtime/realtime-client.payload';
import { OmsOrderEventsService } from '../oms/oms-order-events.service';
import { OmsOrdersService } from '../oms/oms-orders.service';
import { OmsOutboundSyncService } from '../oms/oms-outbound-sync.service';
import { OrderAllocationService } from '../oms/order-allocation.service';
import {
  type OmsOrderCreateExtras,
  omsOrderDataFromExtras,
} from '../oms/oms-order.types';
import { CreateOutboundOrderDto } from './dto/create-outbound.dto';
import { ConfirmOutboundBodyDto } from './dto/confirm-outbound-body.dto';
import { ListOutboundQueryDto } from './dto/list-outbound-query.dto';
import { QuickDirectedOutboundDto } from './dto/quick-directed-outbound.dto';
import { UpdateOutboundPlanDto } from './dto/update-outbound-plan.dto';
import { UpdateShippingDetailsDto } from './dto/update-shipping-details.dto';
import {
  assertCarrierShippingReady,
  assertShippingIntentReady,
  assertShippingConfigUnlocked,
  hasShippingConfigPatch,
  resolveShippingWeightKg,
  resolveShippingVolumeCbm,
  calculateOrderWeight,
  calculateOrderVolume,
  shippingPrismaData,
} from '../shipping/shipping-config.util';
import { ShippingService } from '../shipping/shipping.service';
import { toAvatarPublicUrl } from '../media/avatar-url';
import {
  buildQuickDirectedPickMessages,
  type QuickDirectedPickSlice,
  type QuickDirectedOutboundResult,
} from './quick-directed-outbound.helper';
import {
  assertOutboundAdminStageAction,
  nextOutboundAdminAction,
  outboundRequiresPacking,
} from './outbound-admin-stages';
import {
  buildAdminPickCompleteBody,
  waitForOpenWarehouseTask,
} from './outbound-admin-task.helpers';
import { findWarehouseStockFefo } from '../warehouse-workflow/task-allocation.helper';
import { QUICK_DIRECTED_OUTBOUND_REF_PREFIX } from './quick-directed-outbound.constants';

/**
 * Approve side-effect audit (Rule 1):
 *
 * Under TASK_ONLY_FLOWS=true (default), confirmAndDeduct / approveAdmin:
 * - MAY: validate plan, CAS confirmable→picking, confirmedAt/pickingStartedAt,
 *   soft-hold allocate, bootstrap workflow + first pick task, OMS sync to processing,
 *   realtime emit, audit OUTBOUND_ORDER_CONFIRMED.
 * - MUST NOT: decrement on-hand, complete pick/pack/dispatch, set ready_to_ship/shipped,
 *   OMS ready_to_ship/shipped, inventory.changed from ship.
 *
 * Legacy path (TASK_ONLY_FLOWS=false) deducts + ships immediately — Approve MUST NOT use it.
 */
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
          imagePath: true,
          weightKg: true,
          volumeCbm: true,
        },
      },
    },
  },
  stockReservations: {
    where: { status: { in: ['active', 'fulfilled'] as const } },
    orderBy: { createdAt: 'asc' as const },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      location: { select: { id: true, fullPath: true, barcode: true } },
      lot: { select: { id: true, lotNumber: true } },
    },
  },
  carrierShipments: {
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
  omsOrder: {
    select: { id: true, orderNumber: true },
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
    private readonly tasks: WarehouseTasksService,
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
    @Optional()
    @Inject(forwardRef(() => OmsOrdersService))
    private readonly omsOrders?: OmsOrdersService,
    @Optional()
    @Inject(forwardRef(() => OmsOutboundSyncService))
    private readonly omsSync?: OmsOutboundSyncService,
    @Optional()
    private readonly shipping?: ShippingService,
    @Optional()
    @Inject(forwardRef(() => WorkflowOrchestrationService))
    private readonly orchestration?: WorkflowOrchestrationService,
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
    opts?: {
      pendingClientApproval?: boolean;
      oms?: OmsOrderCreateExtras;
      /** CSV import: create draft without soft-hold allocation. */
      skipAllocation?: boolean;
    },
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
        weightKg: true,
        volumeCbm: true,
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

    const weightByProductId = new Map(
      products.map((p) => [p.id, p.weightKg?.toString() ?? null] as const),
    );
    const volumeByProductId = new Map(
      products.map((p) => [p.id, p.volumeCbm?.toString() ?? null] as const),
    );
    const shippingMethod = dto.shippingMethod ?? ShippingMethod.manual;
    const lineQty = dto.lines.map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity,
    }));
    const shippingWeightKg = resolveShippingWeightKg({
      method: shippingMethod,
      explicit: dto.shippingWeightKg,
      lines: lineQty,
      weightByProductId,
    });
    const shippingVolumeCbm = resolveShippingVolumeCbm({
      method: shippingMethod,
      explicit: dto.shippingVolumeCbm,
      lines: lineQty,
      volumeByProductId,
    });
    const shippingFields = {
      shippingMethod,
      shippingProviderCode: dto.shippingProviderCode,
      shippingReceiverLat: dto.shippingReceiverLat,
      shippingReceiverLng: dto.shippingReceiverLng,
      shippingPackageType: dto.shippingPackageType,
      shippingContents: dto.shippingContents,
      shippingDeliveryType: dto.shippingDeliveryType,
      shippingPickupType: dto.shippingPickupType,
      shippingPayer: dto.shippingPayer,
      shippingWeightKg,
      shippingVolumeCbm,
      shippingPhoneCountry: dto.shippingPhoneCountry,
    };
    assertShippingIntentReady(shippingFields);

    // Client portal / partial creates: allow admin mode without a full plan (Admin completes via updatePlan).
    const clientSubmission = !!opts?.pendingClientApproval;
    const executionMode = clientSubmission
      ? 'admin'
      : normalizeExecutionMode(dto.executionMode);
    let executionPlan: Prisma.InputJsonValue | undefined;
    if (dto.executionPlan && !clientSubmission) {
      const parsed = parseOutboundExecutionPlan(dto.executionPlan);
      if (!parsed) throw new BadRequestException('Invalid executionPlan.');
      if (dto.requiresPacking === false) parsed.requiresPacking = false;
      if (dto.requiresPacking === true) parsed.requiresPacking = true;
      if (executionMode === 'admin') assertOutboundAdminPlanComplete(parsed);
      executionPlan = parsed as unknown as Prisma.InputJsonValue;
    } else if (executionMode === 'admin' && !clientSubmission) {
      throw new BadRequestException('Admin execution requires executionPlan on create.');
    }

    const created = await tx.outboundOrder.create({
      data: {
        companyId,
        status: opts?.pendingClientApproval ? OutboundOrderStatus.pending_approval : undefined,
        destinationAddress: dto.destinationAddress,
        requiredShipDate: new Date(dto.requiredShipDate),
        carrier: dto.carrier,
        clientReference: dto.clientReference,
        notes: dto.notes,
        externalReference: dto.externalReference,
        requiresPacking: dto.requiresPacking !== false,
        executionMode,
        executionPlan,
        createdBy: user.id,
        ...omsOrderDataFromExtras(opts?.oms),
        ...shippingPrismaData(shippingFields),
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

    if (executionPlan && created.lines.length > 0) {
      const parsed = parseOutboundExecutionPlan(executionPlan)!;
      const used = new Set<string>();
      parsed.lines = parsed.lines.map((pl) => {
        let orderLineId = pl.orderLineId;
        if (!orderLineId || !created.lines.some((l) => l.id === orderLineId)) {
          const match = created.lines.find(
            (l) => l.productId === pl.productId && !used.has(l.id),
          );
          orderLineId = match?.id;
          if (match) used.add(match.id);
        } else {
          used.add(orderLineId);
        }
        return { ...pl, orderLineId };
      });
      parsed.planUpdatedAt = new Date().toISOString();
      await tx.outboundOrder.update({
        where: { id: created.id },
        data: { executionPlan: parsed as unknown as Prisma.InputJsonValue },
      });
      created.executionPlan = parsed as unknown as Prisma.JsonValue;
    }

    if (opts?.oms && this.omsOrders) {
      await this.omsOrders.mirrorFromOutbound(tx, {
        outbound: created,
        lines: created.lines.map((line) => ({
          productId: line.productId,
          requestedQuantity: line.requestedQuantity,
          specificLotId: line.specificLotId,
          lineNumber: line.lineNumber,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          discountAmount: line.discountAmount,
        })),
        actorUserId: user.id,
      });
    } else if (opts?.oms?.recordOmsEvent !== false && this.omsEvents) {
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
      !opts?.skipAllocation &&
      opts?.oms?.allocateAfterCreate !== false
    ) {
      const planWarehouse =
        executionPlan != null
          ? parseOutboundExecutionPlan(executionPlan)?.warehouseId
          : undefined;
      await this.orderAllocation.allocateOrder(tx, {
        outboundOrderId: created.id,
        companyId: created.companyId,
        warehouseId: opts?.oms?.warehouseId ?? planWarehouse,
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

  async list(user: AuthPrincipal, query: ListOutboundQueryDto & { statusIn?: OutboundOrderStatus[] }) {
    const where = await this.buildListWhere(user, query);

    const listInclude = {
      company: { select: { id: true, name: true, logoPath: true } },
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
      return {
        items: items.map((o) => ({
          ...o,
          company: {
            id: o.company.id,
            name: o.company.name,
            logoUrl: toAvatarPublicUrl(o.company.logoPath),
          },
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  private async buildListWhere(
    user: AuthPrincipal,
    query: ListOutboundQueryDto & { statusIn?: OutboundOrderStatus[] },
  ): Promise<Prisma.OutboundOrderWhereInput> {
    const baseAnd: Prisma.OutboundOrderWhereInput[] = [];
    const where: Prisma.OutboundOrderWhereInput = {};

    const companyId = readCompanyIdCatalogFilter(this.companyAccess, user, query.companyId);
    if (companyId) {
      where.companyId = companyId;
    }
    if (query.statusIn?.length) {
      where.status = { in: query.statusIn };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.orderSearch?.trim()) {
      const t = query.orderSearch.trim();
      const orParts: Prisma.OutboundOrderWhereInput[] = [
        { orderNumber: { contains: t, mode: 'insensitive' } },
        { company: { name: { contains: t, mode: 'insensitive' } } },
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
    return where;
  }

  /** Same filters as list(), capped for CSV export (no pagination window). */
  async listForExport(
    user: AuthPrincipal,
    query: ListOutboundQueryDto,
    opts: { maxRows: number },
  ) {
    const where = await this.buildListWhere(user, query);
    return withTenantRls(this.prisma, user, async (tx) => {
      const total = await tx.outboundOrder.count({ where });
      const rows = await tx.outboundOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          lines: {
            select: { requestedQuantity: true },
          },
        },
        take: opts.maxRows,
      });
      return {
        items: rows,
        total,
        truncated: total > rows.length,
      };
    });
  }

  resolveImportCompanyId(user: AuthPrincipal, companyId?: string): string {
    return this.companyAccess.resolveWriteCompanyId(user, companyId);
  }

  async findByExternalReference(
    user: AuthPrincipal,
    companyId: string,
    externalReference: string,
  ) {
    this.companyAccess.assertCompanyAccess(user, companyId);
    return withTenantRls(this.prisma, user, async (tx) =>
      tx.outboundOrder.findFirst({
        where: {
          companyId,
          externalReference: { equals: externalReference, mode: 'insensitive' },
        },
        select: { id: true, orderNumber: true },
      }),
    );
  }

  async findProductsBySkus(companyId: string, skus: string[]) {
    const upper = skus.map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (upper.length === 0) return [];
    return this.prisma.product.findMany({
      where: {
        companyId,
        OR: upper.map((sku) => ({ sku: { equals: sku, mode: 'insensitive' as const } })),
      },
      select: { id: true, sku: true, companyId: true, status: true, uom: true },
    });
  }

  /**
   * Reuse create-path business checks without writing (import validate phase).
   */
  async assertImportCreateReady(user: AuthPrincipal, dto: CreateOutboundOrderDto): Promise<void> {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.billingAccess.assertOperationalBilling(companyId);
    assertCalendarDateNotBeforeToday(dto.requiredShipDate, 'Required ship date');
    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        companyId: true,
        sku: true,
        status: true,
        uom: true,
        weightKg: true,
        volumeCbm: true,
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
    for (const p of products) assertProductOrderableForOrders(p.status);
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const l of dto.lines) {
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.requestedQuantity, 'Requested quantity');
    }
    await this.assertSufficientStockForLines(companyId, dto.lines, products);
    const shippingMethod = dto.shippingMethod ?? ShippingMethod.manual;
    const weightByProductId = new Map(
      products.map((p) => [p.id, p.weightKg?.toString() ?? null] as const),
    );
    const volumeByProductId = new Map(
      products.map((p) => [p.id, p.volumeCbm?.toString() ?? null] as const),
    );
    const lineQty = dto.lines.map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity,
    }));
    const shippingFields = {
      shippingMethod,
      shippingProviderCode: dto.shippingProviderCode,
      shippingReceiverLat: dto.shippingReceiverLat,
      shippingReceiverLng: dto.shippingReceiverLng,
      shippingPackageType: dto.shippingPackageType,
      shippingContents: dto.shippingContents,
      shippingDeliveryType: dto.shippingDeliveryType,
      shippingPickupType: dto.shippingPickupType,
      shippingPayer: dto.shippingPayer,
      shippingWeightKg: resolveShippingWeightKg({
        method: shippingMethod,
        explicit: dto.shippingWeightKg,
        lines: lineQty,
        weightByProductId,
      }),
      shippingVolumeCbm: resolveShippingVolumeCbm({
        method: shippingMethod,
        explicit: dto.shippingVolumeCbm,
        lines: lineQty,
        volumeByProductId,
      }),
      shippingPhoneCountry: dto.shippingPhoneCountry,
    };
    assertShippingIntentReady(shippingFields);
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

  async updatePlan(user: AuthPrincipal, id: string, dto: UpdateOutboundPlanDto) {
    const order = await this.findById(id, user);
    const shippingOnly =
      hasShippingConfigPatch(dto) &&
      dto.executionMode === undefined &&
      dto.executionPlan === undefined &&
      dto.requiredShipDate === undefined &&
      dto.notes === undefined &&
      dto.destinationAddress === undefined &&
      dto.requiresPacking === undefined;

    if (!shippingOnly && !isOutboundConfirmable(order.status)) {
      throw new InvalidStateException(
        `Plan can only be updated while draft (current: ${order.status}).`,
      );
    }
    if (hasShippingConfigPatch(dto)) {
      assertShippingConfigUnlocked(order.status);
      // OMS-linked outbound inherits shipping from the OMS order (single shipment identity).
      if (order.omsOrder) {
        throw new BadRequestException(
          'Shipping for OMS-linked outbound orders is managed on the OMS order. Edit the OMS order instead.',
        );
      }
    }

    const weightByProductId = new Map(
      order.lines.map((l) => [l.productId, l.product?.weightKg?.toString() ?? null]),
    );
    const volumeByProductId = new Map(
      order.lines.map((l) => [
        l.productId,
        (l.product as { volumeCbm?: { toString(): string } | null } | null)?.volumeCbm?.toString() ??
          null,
      ]),
    );
    const nextMethod = dto.shippingMethod ?? order.shippingMethod;
    const lineQty = order.lines.map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity.toString(),
    }));
    const shippingWeightKg = hasShippingConfigPatch(dto)
      ? resolveShippingWeightKg({
          method: nextMethod,
          explicit:
            dto.shippingWeightKg !== undefined
              ? dto.shippingWeightKg
              : order.shippingWeightKg?.toString(),
          lines: lineQty,
          weightByProductId,
        })
      : undefined;
    const shippingVolumeCbm = hasShippingConfigPatch(dto)
      ? resolveShippingVolumeCbm({
          method: nextMethod,
          explicit:
            dto.shippingVolumeCbm !== undefined
              ? dto.shippingVolumeCbm
              : (order as { shippingVolumeCbm?: { toString(): string } | null }).shippingVolumeCbm?.toString(),
          lines: lineQty,
          volumeByProductId,
        })
      : undefined;

    const shippingPatch = hasShippingConfigPatch(dto)
      ? {
          shippingMethod: dto.shippingMethod,
          shippingProviderCode: dto.shippingProviderCode,
          shippingReceiverLat: dto.shippingReceiverLat,
          shippingReceiverLng: dto.shippingReceiverLng,
          shippingPackageType: dto.shippingPackageType,
          shippingContents: dto.shippingContents,
          shippingDeliveryType: dto.shippingDeliveryType,
          shippingPickupType: dto.shippingPickupType,
          shippingPayer: dto.shippingPayer,
          shippingWeightKg:
            dto.shippingWeightKg !== undefined
              ? dto.shippingWeightKg
              : shippingWeightKg !== undefined
                ? shippingWeightKg
                : undefined,
          shippingVolumeCbm:
            dto.shippingVolumeCbm !== undefined
              ? dto.shippingVolumeCbm
              : shippingVolumeCbm !== undefined
                ? shippingVolumeCbm
                : undefined,
          shippingPhoneCountry: dto.shippingPhoneCountry,
        }
      : null;

    if (shippingPatch) {
      assertShippingIntentReady({
        shippingMethod: nextMethod,
        shippingProviderCode:
          dto.shippingProviderCode !== undefined
            ? dto.shippingProviderCode
            : order.shippingProviderCode,
      });
    }

    if (shippingOnly) {
      return withTenantRls(this.prisma, user, async (tx) => {
        const updated = await tx.outboundOrder.update({
          where: { id },
          data: shippingPrismaData(shippingPatch!),
          include: ORDER_INCLUDE,
        });
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
          orderId: updated.id,
          status: updated.status,
          reason: 'shipping_config_updated',
          listItem: adminOutboundListItem(updated),
        });
        return updated;
      });
    }

    const executionMode = normalizeExecutionMode(dto.executionMode ?? order.executionMode);
    let executionPlan: Prisma.InputJsonValue | undefined;
    if (dto.executionPlan !== undefined) {
      const parsed = parseOutboundExecutionPlan(dto.executionPlan);
      if (!parsed) throw new BadRequestException('Invalid executionPlan.');
      if (dto.requiresPacking !== undefined) parsed.requiresPacking = dto.requiresPacking;
      const used = new Set<string>();
      parsed.lines = parsed.lines.map((pl) => {
        let orderLineId = pl.orderLineId;
        if (!orderLineId || !order.lines.some((l) => l.id === orderLineId)) {
          const match = order.lines.find(
            (l) => l.productId === pl.productId && !used.has(l.id),
          );
          orderLineId = match?.id;
          if (match) used.add(match.id);
        } else {
          used.add(orderLineId);
        }
        return { ...pl, orderLineId };
      });
      parsed.planUpdatedAt = new Date().toISOString();
      if (executionMode === 'admin') assertOutboundAdminPlanComplete(parsed);
      executionPlan = parsed as unknown as Prisma.InputJsonValue;
    } else if (executionMode === 'admin') {
      const existing = parseOutboundExecutionPlan(order.executionPlan);
      if (!existing) throw new BadRequestException('Admin mode requires executionPlan.');
      assertOutboundAdminPlanComplete(existing);
    }

    if (dto.requiredShipDate) {
      assertCalendarDateNotBeforeToday(dto.requiredShipDate, 'Required ship date');
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const updated = await tx.outboundOrder.update({
        where: { id },
        data: {
          executionMode,
          ...(executionPlan !== undefined ? { executionPlan } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.destinationAddress !== undefined
            ? { destinationAddress: dto.destinationAddress }
            : {}),
          ...(dto.requiresPacking !== undefined ? { requiresPacking: dto.requiresPacking } : {}),
          ...(dto.requiredShipDate
            ? { requiredShipDate: new Date(dto.requiredShipDate) }
            : {}),
          ...(shippingPatch ? shippingPrismaData(shippingPatch) : {}),
        },
        include: ORDER_INCLUDE,
      });

      // Ensure soft-hold exists (and refresh warehouse scope when the plan warehouse changes).
      if (this.orderAllocation?.isEnabled() && updated.lines.length > 0) {
        const plan =
          parseOutboundExecutionPlan(updated.executionPlan) ??
          parseOutboundExecutionPlan(order.executionPlan);
        const previousPlan = parseOutboundExecutionPlan(order.executionPlan);
        const warehouseChanged =
          !!plan?.warehouseId &&
          plan.warehouseId !== (previousPlan?.warehouseId ?? undefined);
        const has = await this.orderAllocation.hasActiveReservations(tx, id);
        if (has && warehouseChanged) {
          await this.orderAllocation.releaseAllocation(tx, {
            outboundOrderId: id,
            companyId: updated.companyId,
            actorUserId: user.id,
          });
        }
        await this.orderAllocation.allocateOrder(tx, {
          outboundOrderId: id,
          companyId: updated.companyId,
          warehouseId: plan?.warehouseId,
          actorUserId: user.id,
          previousStatus: updated.status,
          lines: updated.lines.map((line) => ({
            outboundOrderLineId: line.id,
            productId: line.productId,
            requestedQty: line.requestedQuantity,
            specificLotId: line.specificLotId,
          })),
        });
      }

      return updated;
    });
  }

  /**
   * Admin Approve — bootstrap only (Rule 1).
   * Forces TASK_ONLY_FLOWS safe path; never legacy deduct/ship.
   */
  async approveAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('Approve requires executionMode=admin.');
    }
    if (!taskOnlyFlows(this.config)) {
      throw new BadRequestException(
        'Admin Approve requires TASK_ONLY_FLOWS=true so approval cannot deduct inventory or ship.',
      );
    }
    const plan = parseOutboundExecutionPlan(order.executionPlan);
    const requiresPacking = outboundRequiresPacking({
      requiresPacking: order.requiresPacking,
      planRequiresPacking: plan?.requiresPacking,
    });
    assertOutboundAdminStageAction(order.status, 'approve', requiresPacking);
    if (!plan) throw new BadRequestException('Approve requires a saved executionPlan.');
    assertOutboundAdminPlanComplete(plan);

    // Safe reuse: task-only branch of confirmAndDeduct (no on-hand deduction).
    return this.confirmAndDeduct(user, orderId, { warehouseId: plan.warehouseId });
  }

  async completePickingAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('complete-picking requires executionMode=admin.');
    }
    const plan = parseOutboundExecutionPlan(order.executionPlan);
    const requiresPacking = outboundRequiresPacking({
      requiresPacking: order.requiresPacking,
      planRequiresPacking: plan?.requiresPacking,
    });
    assertOutboundAdminStageAction(order.status, 'complete_picking', requiresPacking);

    const pick = await waitForOpenWarehouseTask(
      this.prisma,
      'outbound_order',
      orderId,
      WarehouseTaskType.pick,
    );
    try {
      await this.tasks.start(pick.id, user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Picking start failed: ${msg}`);
    }

    const pickDetail = await this.prisma.warehouseTask.findUnique({ where: { id: pick.id } });
    if (!pickDetail) throw new NotFoundException('Pick task missing after start.');

    try {
      await this.tasks.complete(pick.id, user, buildAdminPickCompleteBody(pickDetail.executionState));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Picking complete failed: ${msg}`);
    }

    const updated = await this.findById(orderId, user);
    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'admin_complete_picking',
      listItem: adminOutboundListItem(updated),
    });
    return updated;
  }

  async completePackingAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('complete-packing requires executionMode=admin.');
    }
    const plan = parseOutboundExecutionPlan(order.executionPlan);
    const requiresPacking = outboundRequiresPacking({
      requiresPacking: order.requiresPacking,
      planRequiresPacking: plan?.requiresPacking,
    });
    assertOutboundAdminStageAction(order.status, 'complete_packing', requiresPacking);

    const pack = await waitForOpenWarehouseTask(
      this.prisma,
      'outbound_order',
      orderId,
      WarehouseTaskType.pack,
    );
    try {
      await this.tasks.adminConfirm(pack.id, user, {
        task_type: 'pack',
        lines: order.lines.map((l) => ({
          outbound_order_line_id: l.id,
          packed_qty: String(l.pickedQuantity ?? l.requestedQuantity),
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Packing complete failed: ${msg}`);
    }

    const updated = await this.findById(orderId, user);
    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'admin_complete_packing',
      listItem: adminOutboundListItem(updated),
    });
    return updated;
  }

  /**
   * Save draft shipping details while Waiting for Shipping Details.
   * Does NOT call the carrier API.
   */
  async saveShippingDetails(user: AuthPrincipal, orderId: string, dto: UpdateShippingDetailsDto) {
    const order = await this.findById(orderId, user);
    if (order.status !== OutboundOrderStatus.waiting_for_shipping_details) {
      throw new BadRequestException(
        `Shipping details can only be saved while waiting_for_shipping_details (current: ${order.status}).`,
      );
    }

    const createdShipment = (order.carrierShipments ?? []).find(
      (s) => s.status === CarrierShipmentStatus.created,
    );
    if (createdShipment) {
      throw new BadRequestException(
        'Shipping details are locked after the carrier shipment was sent. Complete the stage or contact support.',
      );
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const lineQty = order.lines.map((l) => ({
        productId: l.productId,
        requestedQuantity: l.requestedQuantity.toString(),
      }));
      const weightByProductId = new Map(
        order.lines.map((l) => [l.productId, l.product?.weightKg?.toString() ?? null]),
      );
      const volumeByProductId = new Map(
        order.lines.map((l) => [
          l.productId,
          (l.product as { volumeCbm?: { toString(): string } | null } | null)?.volumeCbm?.toString() ??
            null,
        ]),
      );

      // Prefer explicit draft values; otherwise prefill from product × qty once.
      const resolvedWeight =
        dto.shippingWeightKg !== undefined && dto.shippingWeightKg !== null
          ? dto.shippingWeightKg
          : order.shippingWeightKg != null
            ? Number(order.shippingWeightKg)
            : calculateOrderWeight(lineQty, weightByProductId);
      const resolvedVolume =
        dto.shippingVolumeCbm !== undefined && dto.shippingVolumeCbm !== null
          ? dto.shippingVolumeCbm
          : (order as { shippingVolumeCbm?: { toString(): string } | null }).shippingVolumeCbm !=
              null
            ? Number(
                (order as { shippingVolumeCbm?: { toString(): string } | null }).shippingVolumeCbm,
              )
            : calculateOrderVolume(lineQty, volumeByProductId);

      const row = await tx.outboundOrder.update({
        where: { id: orderId },
        data: {
          ...shippingPrismaData({
            shippingReceiverLat: dto.shippingReceiverLat,
            shippingReceiverLng: dto.shippingReceiverLng,
            shippingPackageType: dto.shippingPackageType,
            shippingContents: dto.shippingContents,
            shippingDeliveryType: dto.shippingDeliveryType,
            shippingPickupType: dto.shippingPickupType,
            shippingPayer: dto.shippingPayer,
            shippingWeightKg:
              dto.shippingWeightKg !== undefined ? dto.shippingWeightKg : resolvedWeight,
            shippingVolumeCbm:
              dto.shippingVolumeCbm !== undefined ? dto.shippingVolumeCbm : resolvedVolume,
            shippingPhoneCountry: dto.shippingPhoneCountry,
          }),
          ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
          ...(dto.trackingNumber !== undefined ? { trackingNumber: dto.trackingNumber } : {}),
        },
        include: ORDER_INCLUDE,
      });
      if (this.omsEvents && row.omsOrder) {
        await this.omsEvents.record(tx, {
          omsOrderId: row.omsOrder.id,
          outboundOrderId: row.id,
          companyId: row.companyId,
          eventType: 'shipping.details.saved',
          createdBy: user.id,
        });
      }
      return row;
    });

    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'shipping_details_saved',
      listItem: adminOutboundListItem(updated),
    });
    return updated;
  }

  /**
   * Explicit Send Shipment — calls carrier adapter. Status stays waiting_for_shipping_details.
   */
  async sendShippingDetails(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (order.status !== OutboundOrderStatus.waiting_for_shipping_details) {
      throw new BadRequestException(
        `Send Shipment is only available while waiting_for_shipping_details (current: ${order.status}).`,
      );
    }
    if (order.shippingMethod !== ShippingMethod.carrier) {
      throw new BadRequestException(
        'Send Shipment is only for carrier shipping. Use Mark Shipping Details Complete for manual.',
      );
    }
    if (!this.shipping) {
      throw new BadRequestException('Shipping service is unavailable.');
    }

    assertCarrierShippingReady({
      shippingMethod: order.shippingMethod,
      shippingProviderCode: order.shippingProviderCode,
      shippingReceiverLat: order.shippingReceiverLat?.toString() ?? null,
      shippingReceiverLng: order.shippingReceiverLng?.toString() ?? null,
      shippingPackageType: order.shippingPackageType,
      shippingContents: order.shippingContents,
      shippingDeliveryType: order.shippingDeliveryType,
      shippingPickupType: order.shippingPickupType,
      shippingPayer: order.shippingPayer,
      shippingWeightKg: order.shippingWeightKg?.toString() ?? null,
    });

    await this.shipping.assertLiveCarrierSelection({
      fields: {
        shippingMethod: order.shippingMethod,
        shippingProviderCode: order.shippingProviderCode,
        shippingReceiverLat: order.shippingReceiverLat?.toString() ?? null,
        shippingReceiverLng: order.shippingReceiverLng?.toString() ?? null,
        shippingPackageType: order.shippingPackageType,
        shippingDeliveryType: order.shippingDeliveryType,
        shippingPickupType: order.shippingPickupType,
        shippingWeightKg: order.shippingWeightKg?.toString() ?? null,
        shippingVolumeCbm: order.shippingVolumeCbm?.toString() ?? null,
      },
      governorate: order.city,
      city: order.district,
      neighborhood: order.addressLine1,
      requireQuote: true,
    });

    await this.shipping.ensureShipmentForOutbound(orderId);

    const updated = await this.findById(orderId, user);
    const latest = updated.carrierShipments?.[0];
    if (latest?.status === CarrierShipmentStatus.failed) {
      throw new BadRequestException(
        latest.lastErrorSafe?.trim() || 'Carrier shipment submission failed.',
      );
    }
    if (latest?.status !== CarrierShipmentStatus.created) {
      throw new BadRequestException('Carrier shipment was not created. Check provider connection and retry.');
    }

    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'shipping_shipment_sent',
      listItem: adminOutboundListItem(updated),
    });
    return updated;
  }

  /**
   * Mark Shipping Details Complete → ready_to_ship (Waiting for Dispatch) + enqueue dispatch.
   */
  async completeShippingDetailsAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    const plan = parseOutboundExecutionPlan(order.executionPlan);
    const requiresPacking = outboundRequiresPacking({
      requiresPacking: order.requiresPacking,
      planRequiresPacking: plan?.requiresPacking,
    });
    assertOutboundAdminStageAction(order.status, 'complete_shipping_details', requiresPacking);

    if (order.shippingMethod === ShippingMethod.carrier) {
      const created = (order.carrierShipments ?? []).find(
        (s) => s.status === CarrierShipmentStatus.created,
      );
      if (!created) {
        throw new BadRequestException(
          'Send Shipment successfully before marking Shipping Details as Complete.',
        );
      }
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.outboundOrder.update({
        where: { id: orderId },
        data: { status: OutboundOrderStatus.ready_to_ship },
        include: ORDER_INCLUDE,
      });

      await this.omsSync?.syncFromOutbound(tx, orderId, user.id);

      // Complete open shipping_details task if present.
      const openTask = await tx.warehouseTask.findFirst({
        where: {
          taskType: WarehouseTaskType.shipping_details,
          status: {
            in: [
              WarehouseTaskStatus.pending,
              WarehouseTaskStatus.assigned,
              WarehouseTaskStatus.in_progress,
            ],
          },
          workflowInstance: {
            referenceType: 'outbound_order',
            referenceId: orderId,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (openTask) {
        await tx.warehouseTask.update({
          where: { id: openTask.id },
          data: {
            status: WarehouseTaskStatus.completed,
            completedAt: new Date(),
            completedById: user.id,
          },
        });
        if (openTask.workflowInstanceId && this.orchestration) {
          await this.orchestration.enqueueDispatchTaskIfNeeded(
            tx,
            openTask.workflowInstanceId,
            orderId,
          );
        }
      } else if (this.orchestration) {
        const wf = await tx.workflowInstance.findFirst({
          where: { referenceType: 'outbound_order', referenceId: orderId },
          orderBy: { createdAt: 'desc' },
        });
        if (wf) {
          await this.orchestration.enqueueDispatchTaskIfNeeded(tx, wf.id, orderId);
        }
      }

      if (this.omsEvents && row.omsOrder) {
        await this.omsEvents.record(tx, {
          omsOrderId: row.omsOrder.id,
          outboundOrderId: row.id,
          companyId: row.companyId,
          eventType: 'shipping.details.completed',
          createdBy: user.id,
        });
      }

      return row;
    });

    const fresh = await this.findById(orderId, user);
    this.realtime.emitOutboundOrderUpdated(fresh.companyId, {
      orderId: fresh.id,
      status: fresh.status,
      reason: 'admin_complete_shipping_details',
      listItem: adminOutboundListItem(fresh),
    });
    return fresh;
  }

  async completeDispatchAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('complete-dispatch requires executionMode=admin.');
    }
    const plan = parseOutboundExecutionPlan(order.executionPlan);
    const requiresPacking = outboundRequiresPacking({
      requiresPacking: order.requiresPacking,
      planRequiresPacking: plan?.requiresPacking,
    });
    assertOutboundAdminStageAction(order.status, 'complete_dispatch', requiresPacking);

    const dispatch = await waitForOpenWarehouseTask(
      this.prisma,
      'outbound_order',
      orderId,
      WarehouseTaskType.dispatch,
    );
    try {
      await this.tasks.adminConfirm(dispatch.id, user, {
        task_type: 'dispatch',
        lines: order.lines.map((l) => ({
          outbound_order_line_id: l.id,
          ship_qty: String(l.pickedQuantity ?? l.requestedQuantity),
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Dispatch complete failed: ${msg}`);
    }

    const updated = await this.findById(orderId, user);
    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'admin_complete_dispatch',
      listItem: adminOutboundListItem(updated),
    });
    return updated;
  }

  /**
   * Deprecated full facade. Advances exactly one next Admin stage (Rule 4 interim).
   * Prefer approve / complete-picking / complete-packing / complete-dispatch.
   */
  async executeAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('execute-admin requires executionMode=admin.');
    }
    const plan = parseOutboundExecutionPlan(order.executionPlan);
    const requiresPacking = outboundRequiresPacking({
      requiresPacking: order.requiresPacking,
      planRequiresPacking: plan?.requiresPacking,
    });
    const next = nextOutboundAdminAction(order.status, requiresPacking);
    if (!next) {
      throw new BadRequestException(
        `No Admin stage action available for status ${order.status}. Use stage endpoints.`,
      );
    }
    switch (next) {
      case 'approve':
        return this.approveAdmin(user, orderId);
      case 'complete_picking':
        return this.completePickingAdmin(user, orderId);
      case 'complete_packing':
        return this.completePackingAdmin(user, orderId);
      case 'complete_shipping_details':
        return this.completeShippingDetailsAdmin(user, orderId);
      case 'complete_dispatch':
        return this.completeDispatchAdmin(user, orderId);
      default:
        throw new BadRequestException(`Unknown Admin stage action: ${next}`);
    }
  }

  async cancel(id: string, user: AuthPrincipal) {
    const order = await this.findById(id, user);
    // Cancel before ship: release soft-holds (stock_reservations) so available qty returns.
    // On-hand is only decremented when dispatch completes (status becomes `shipped`).
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
      // Tear down remaining warehouse work for this order.
      await tx.workflowInstance.deleteMany({
        where: { referenceType: 'outbound_order', referenceId: id },
      });
      const row = await tx.outboundOrder.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.id },
        include: ORDER_INCLUDE,
      });
      await this.omsSync?.syncFromOutbound(tx, id, user.id);
      return row;
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

      await this.omsSync?.syncFromOutbound(tx, orderId, user.id);

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
        select: {
          status: true,
          companyId: true,
          orderNumber: true,
          id: true,
          executionPlan: true,
          executionMode: true,
        },
      }),
    );
    if (!before) throw new NotFoundException('Outbound order not found.');
    this.companyAccess.validateResourceOwnership(user, before);

    // Unified Order Execution: Confirm/Release requires the same complete plan.
    const releasePlan = parseOutboundExecutionPlan(before.executionPlan);
    if (!releasePlan) {
      throw new BadRequestException(
        'A complete execution plan is required before confirmation or release.',
      );
    }
    assertOutboundAdminPlanComplete(releasePlan);

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
        await this.omsSync?.syncFromOutbound(tx, orderId, user.id);
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

      await this.omsSync?.syncFromOutbound(tx, orderId, user.id);

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

    const linkedOms = await tx.omsOrder.findFirst({
      where: { outboundOrderId: orderId },
      select: { id: true, status: true, orderNumber: true },
    });
    if (linkedOms && omsBlocksWarehouseExecution(linkedOms.status)) {
      throw new InvalidStateException(
        `Cannot confirm outbound while linked OMS order ${linkedOms.orderNumber} is ${linkedOms.status}.`,
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
