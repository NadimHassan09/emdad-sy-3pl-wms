import {
  BadRequestException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InboundOrderStatus, Prisma, WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';

import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { inboundIdsVisibleForWarehouse } from '../../common/utils/warehouse-order-scope';
import { isStorageLocationType } from '../../common/constants/storage-location-types';
import {
  InvalidLocationTypeException,
  InvalidStateException,
  LotLockedException,
  LotRequiredException,
} from '../../common/errors/domain-exceptions';
import { assertCalendarDateNotBeforeToday } from '../../common/utils/order-planning-date';
import { assertLocationUsableForInventoryMove } from '../../common/utils/location-operational';
import { generateLotCandidate } from '../../common/generators/identifiers';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import {
  assertDiscreteUomPositiveIntegerDecimal,
  assertDiscreteUomPositiveIntegerQuantity,
} from '../../common/utils/discrete-uom-quantity';
import { AuditLogService } from '../../common/audit/audit-log.service';
import {
  assertReceivingQuantitiesWithinExpected,
} from '../warehouse-workflow/receiving-qty.validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { setTenantRlsContext, withTenantRls } from '../../common/prisma/tenant-rls';
import { StockHelpers } from '../inventory/stock.helpers';
import { inboundReceiveDefersPutaway, taskOnlyFlows } from '../warehouse-workflow/feature-flags';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { adminInboundListItem } from '../realtime/realtime-client.payload';
import { WorkflowBootstrapService } from '../warehouse-workflow/workflow-bootstrap.service';
import { WarehouseTasksService } from '../warehouse-workflow/warehouse-tasks.service';
import {
  assertInboundAdminPlanComplete,
  normalizeExecutionMode,
  parseInboundExecutionPlan,
} from '../orders/execution-plan.util';
import {
  assertInboundAdminStageAction,
  nextInboundAdminAction,
} from './inbound-admin-stages';
import { waitForOpenWarehouseTask } from '../outbound/outbound-admin-task.helpers';
import { ConfirmInboundBodyDto } from './dto/confirm-inbound-body.dto';
import { CreateInboundOrderDto } from './dto/create-inbound.dto';
import { ListInboundQueryDto } from './dto/list-inbound-query.dto';
import { ReceiveLineDto } from './dto/receive-line.dto';
import { UpdateInboundPlanDto } from './dto/update-inbound-plan.dto';
import { toAvatarPublicUrl } from '../media/avatar-url';

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
          expiryTracking: true,
          imagePath: true,
        },
      },
    },
  },
} satisfies Prisma.InboundOrderInclude;

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INBOUND_CONFIRMABLE: InboundOrderStatus[] = [
  InboundOrderStatus.draft,
  InboundOrderStatus.pending_approval,
];

function isInboundConfirmable(status: InboundOrderStatus): boolean {
  return INBOUND_CONFIRMABLE.includes(status);
}

/** Plan edits after confirm are allowed until any quantity has been received. */
function isInboundPlanEditable(
  status: InboundOrderStatus,
  lines: Array<{ receivedQuantity: Prisma.Decimal }>,
): boolean {
  if (isInboundConfirmable(status)) return true;
  if (
    status !== InboundOrderStatus.confirmed &&
    status !== InboundOrderStatus.in_progress
  ) {
    return false;
  }
  return lines.every((l) => l.receivedQuantity.lte(0));
}

// Only cancelled orders may be permanently deleted by an admin. Every other
// status must be cancelled first.
const INBOUND_DELETABLE: InboundOrderStatus[] = [InboundOrderStatus.cancelled];

@Injectable()
export class InboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockHelpers,
    private readonly config: ConfigService,
    private readonly workflowBootstrap: WorkflowBootstrapService,
    private readonly tasks: WarehouseTasksService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly companyAccess: CompanyAccessService,
    private readonly audit: AuditLogService,
    private readonly billingAccess: BillingAccessService,
  ) {}

  async create(
    user: AuthPrincipal,
    dto: CreateInboundOrderDto,
    opts?: { pendingClientApproval?: boolean },
  ) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.billingAccess.assertOperationalBilling(companyId);

    return withTenantRls(this.prisma, user, async (tx) => {
    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, companyId: true, status: true, trackingType: true, uom: true },
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

    assertCalendarDateNotBeforeToday(dto.expectedArrivalDate, 'Expected arrival date');

    // Client portal submissions are completed by admin (dock / putaway / confirm).
    // Allow executionMode=admin without a full plan; admin fills it via updatePlan.
    const clientSubmission = !!opts?.pendingClientApproval;
    const executionMode = clientSubmission
      ? 'admin'
      : normalizeExecutionMode(dto.executionMode);
    let executionPlan: Prisma.InputJsonValue | undefined;
    if (dto.executionPlan && !clientSubmission) {
      const parsed = parseInboundExecutionPlan(dto.executionPlan);
      if (!parsed) throw new BadRequestException('Invalid executionPlan.');
      if (executionMode === 'admin') assertInboundAdminPlanComplete(parsed);
      executionPlan = parsed as unknown as Prisma.InputJsonValue;
    } else if (executionMode === 'admin' && !clientSubmission) {
      throw new BadRequestException('Admin execution requires executionPlan on create.');
    }

    const productById = new Map(products.map((p) => [p.id, p]));
    const lineCreates: Prisma.InboundOrderLineCreateWithoutOrderInput[] = [];
    for (let idx = 0; idx < dto.lines.length; idx++) {
      const l = dto.lines[idx];
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.expectedQuantity, 'Expected quantity');
      let expectedLotNumber = l.expectedLotNumber?.trim() ?? null;
      if (p.trackingType === 'lot') {
        if (!expectedLotNumber) {
          expectedLotNumber = await this.allocateInboundExpectedLotNumber(l.productId);
        }
      } else {
        expectedLotNumber = null;
      }
      lineCreates.push({
        product: { connect: { id: l.productId } },
        expectedQuantity: new Prisma.Decimal(l.expectedQuantity),
        expectedLotNumber,
        expectedExpiryDate: l.expectedExpiryDate ? new Date(l.expectedExpiryDate) : null,
        lineNumber: idx + 1,
      });
    }

    const order = await tx.inboundOrder.create({
      data: {
        companyId,
        status: opts?.pendingClientApproval ? InboundOrderStatus.pending_approval : undefined,
        expectedArrivalDate: new Date(dto.expectedArrivalDate),
        clientReference: dto.clientReference,
        notes: dto.notes,
        sourceType: dto.sourceType,
        storeChannel: dto.storeChannel,
        externalReference: dto.externalReference,
        executionMode,
        executionPlan,
        createdBy: user.id,
        lines: {
          create: lineCreates,
        },
      },
      include: ORDER_INCLUDE,
    });

    if (executionPlan && order.lines.length > 0) {
      const parsed = parseInboundExecutionPlan(executionPlan)!;
      const byProduct = new Map(order.lines.map((l) => [l.productId, l.id]));
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
        void byProduct;
        return { ...pl, orderLineId };
      });
      parsed.planUpdatedAt = new Date().toISOString();
      await tx.inboundOrder.update({
        where: { id: order.id },
        data: { executionPlan: parsed as unknown as Prisma.InputJsonValue },
      });
      order.executionPlan = parsed as unknown as Prisma.JsonValue;
    }
    this.realtime.emitInboundOrderCreated(order.companyId, {
      orderId: order.id,
      status: order.status,
      listItem: adminInboundListItem(order),
    });
    if (opts?.pendingClientApproval) {
      await this.notifications.notifyAdminsPendingApproval({
        companyId: order.companyId,
        companyName: order.company.name,
        orderType: 'inbound',
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'INBOUND_CREATED',
        resourceType: 'inbound_order',
        resourceId: order.id,
        companyId: order.companyId,
        newState: {
          orderNumber: order.orderNumber,
          status: order.status,
          lineCount: order.lines.length,
          expectedArrivalDate: order.expectedArrivalDate.toISOString(),
        },
      }),
    );
    return order;
    });
  }

  private async buildListWhere(
    user: AuthPrincipal,
    query: ListInboundQueryDto & { statusIn?: InboundOrderStatus[] },
  ): Promise<Prisma.InboundOrderWhereInput> {
    const baseAnd: Prisma.InboundOrderWhereInput[] = [];
    const where: Prisma.InboundOrderWhereInput = {};

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
      const orParts: Prisma.InboundOrderWhereInput[] = [
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
      const scope = await inboundIdsVisibleForWarehouse(this.prisma, query.warehouseId, {
        ...(companyId ? { companyId } : {}),
      });
      baseAnd.push(scope);
    }

    if (baseAnd.length > 0) where.AND = baseAnd;
    return where;
  }

  /** Same filters as list(), capped for CSV export (no pagination window). */
  async listForExport(
    user: AuthPrincipal,
    query: ListInboundQueryDto,
    opts: { maxRows: number; ids?: string[] },
  ) {
    if (opts.ids?.length) {
      const unique = Array.from(new Set(opts.ids.map((id) => id.trim()).filter(Boolean)));
      const { limit: _l, offset: _o, ...queryNoPage } = query as typeof query & {
        limit?: number;
        offset?: number;
      };
      const baseWhere = await this.buildListWhere(user, queryNoPage as typeof query);
      const where = { ...baseWhere, id: { in: unique.slice(0, opts.maxRows) } };
      return withTenantRls(this.prisma, user, async (tx) => {
        const rows = await tx.inboundOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            company: { select: { id: true, name: true } },
            lines: { select: { expectedQuantity: true } },
          },
        });
        return {
          items: rows,
          total: rows.length,
          truncated: unique.length > rows.length,
        };
      });
    }
    const where = await this.buildListWhere(user, query);
    return withTenantRls(this.prisma, user, async (tx) => {
      const total = await tx.inboundOrder.count({ where });
      const rows = await tx.inboundOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          lines: {
            select: { expectedQuantity: true },
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
      tx.inboundOrder.findFirst({
        where: {
          companyId,
          externalReference: { equals: externalReference, mode: 'insensitive' },
        },
        select: { id: true, orderNumber: true },
      }),
    );
  }

  async findByOrderNumber(user: AuthPrincipal, companyId: string, orderNumber: string) {
    this.companyAccess.assertCompanyAccess(user, companyId);
    return withTenantRls(this.prisma, user, async (tx) =>
      tx.inboundOrder.findFirst({
        where: {
          companyId,
          orderNumber: { equals: orderNumber.trim(), mode: 'insensitive' },
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
  async assertImportCreateReady(user: AuthPrincipal, dto: CreateInboundOrderDto): Promise<void> {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.billingAccess.assertOperationalBilling(companyId);
    assertCalendarDateNotBeforeToday(dto.expectedArrivalDate, 'Expected arrival date');
    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, companyId: true, status: true, uom: true },
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
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.expectedQuantity, 'Expected quantity');
    }
  }

  async list(user: AuthPrincipal, query: ListInboundQueryDto & { statusIn?: InboundOrderStatus[] }) {
    const where = await this.buildListWhere(user, query);

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.inboundOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            company: { select: { id: true, name: true, logoPath: true } },
            _count: { select: { lines: true } },
            lines: {
              select: { id: true, productId: true, expectedQuantity: true, receivedQuantity: true, lineNumber: true },
            },
          },
          take: query.limit,
          skip: query.offset,
        }),
        tx.inboundOrder.count({ where }),
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

  async findById(id: string, user: AuthPrincipal) {
    return withTenantRls(this.prisma, user, async (tx) => {
      const order = await tx.inboundOrder.findUnique({
        where: { id },
        include: ORDER_INCLUDE,
      });
      if (!order) throw new NotFoundException('Inbound order not found.');
      this.companyAccess.validateResourceOwnership(user, order);
      return order;
    });
  }

  async updatePlan(user: AuthPrincipal, id: string, dto: UpdateInboundPlanDto) {
    const order = await this.findById(id, user);
    if (!isInboundPlanEditable(order.status, order.lines)) {
      throw new InvalidStateException(
        `Plan can only be updated before receiving starts (current: ${order.status}).`,
      );
    }
    const executionMode = normalizeExecutionMode(dto.executionMode ?? order.executionMode);
    let executionPlan: Prisma.InputJsonValue | undefined | null = undefined;
    if (dto.executionPlan !== undefined) {
      const parsed = parseInboundExecutionPlan(dto.executionPlan);
      if (!parsed) throw new BadRequestException('Invalid executionPlan.');
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
      if (executionMode === 'admin') assertInboundAdminPlanComplete(parsed);
      executionPlan = parsed as unknown as Prisma.InputJsonValue;
    } else if (executionMode === 'admin') {
      const existing = parseInboundExecutionPlan(order.executionPlan);
      if (!existing) throw new BadRequestException('Admin mode requires executionPlan.');
      assertInboundAdminPlanComplete(existing);
    }

    if (dto.expectedArrivalDate) {
      assertCalendarDateNotBeforeToday(dto.expectedArrivalDate, 'Expected arrival date');
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const updated = await tx.inboundOrder.update({
        where: { id },
        data: {
          executionMode,
          ...(executionPlan !== undefined ? { executionPlan } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.expectedArrivalDate
            ? { expectedArrivalDate: new Date(dto.expectedArrivalDate) }
            : {}),
        },
        include: ORDER_INCLUDE,
      });
      return updated;
    });
  }

  /**
   * Admin Approve — bootstrap only (Rule 1 / Rule 3).
   * Starts receiving task; does NOT post receive or putaway.
   * Requires TASK_ONLY_FLOWS so Approve cannot use legacy confirm-only shortcuts incorrectly.
   */
  async approveAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('Approve requires executionMode=admin.');
    }
    if (!taskOnlyFlows(this.config)) {
      throw new BadRequestException(
        'Admin Approve requires TASK_ONLY_FLOWS=true so approval only starts receiving.',
      );
    }
    assertInboundAdminStageAction(order.status, 'approve');
    const plan = parseInboundExecutionPlan(order.executionPlan);
    if (!plan) throw new BadRequestException('Approve requires a saved executionPlan.');
    assertInboundAdminPlanComplete(plan);

    const stagingByLineId: Record<string, string> = {};
    for (const line of order.lines) {
      stagingByLineId[line.id] = plan.receivingDockId;
    }
    return this.confirm(user, orderId, {
      warehouseId: plan.warehouseId,
      stagingByLineId,
    });
  }

  async completeReceivingAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('complete-receiving requires executionMode=admin.');
    }
    assertInboundAdminStageAction(order.status, 'complete_receiving');

    const receiving = await waitForOpenWarehouseTask(
      this.prisma,
      'inbound_order',
      orderId,
      WarehouseTaskType.receiving,
    );
    try {
      await this.tasks.adminConfirm(receiving.id, user, {
        task_type: 'receiving',
        lines: order.lines.map((l) => {
          const lotPayload =
            l.product?.trackingType === 'lot' && l.expectedLotNumber?.trim()
              ? { capture_lot_number: l.expectedLotNumber.trim() }
              : {};
          return {
            inbound_order_line_id: l.id,
            received_qty: String(l.expectedQuantity),
            ...lotPayload,
          };
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Receiving complete failed: ${msg}`);
    }

    const updated = await this.findById(orderId, user);
    this.realtime.emitInboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'admin_complete_receiving',
      listItem: adminInboundListItem(updated),
    });
    return updated;
  }

  async completePutawayAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('complete-putaway requires executionMode=admin.');
    }
    assertInboundAdminStageAction(order.status, 'complete_putaway');
    const plan = parseInboundExecutionPlan(order.executionPlan);
    if (!plan) throw new BadRequestException('Putaway requires a saved executionPlan.');

    const putaway = await waitForOpenWarehouseTask(
      this.prisma,
      'inbound_order',
      orderId,
      WarehouseTaskType.putaway,
    );
    const putawayLines: Array<{
      inbound_order_line_id: string;
      putaway_quantity: string;
      destination_location_id: string;
    }> = [];
    for (const ol of order.lines) {
      const planLine =
        plan.lines.find((p) => p.orderLineId === ol.id) ??
        plan.lines.find((p) => p.productId === ol.productId);
      for (const s of planLine?.putaway ?? []) {
        putawayLines.push({
          inbound_order_line_id: ol.id,
          putaway_quantity: String(s.qty),
          destination_location_id: s.locationId,
        });
      }
    }
    if (putawayLines.length === 0) {
      throw new BadRequestException('Putaway complete failed: no destination splits in plan.');
    }
    try {
      await this.tasks.adminConfirm(putaway.id, user, {
        task_type: 'putaway',
        lines: putawayLines,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Putaway complete failed: ${msg}`);
    }

    const updated = await this.findById(orderId, user);
    this.realtime.emitInboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'admin_complete_putaway',
      listItem: adminInboundListItem(updated),
    });
    return updated;
  }

  /**
   * Deprecated full facade. Advances exactly one next Admin stage (Rule 4 interim).
   */
  async executeAdmin(user: AuthPrincipal, orderId: string) {
    const order = await this.findById(orderId, user);
    if (normalizeExecutionMode(order.executionMode) !== 'admin') {
      throw new BadRequestException('execute-admin requires executionMode=admin.');
    }

    let openTask: 'receiving' | 'putaway' | null = null;
    if (!isInboundConfirmable(order.status)) {
      const receivingOpen = await this.prisma.warehouseTask.findFirst({
        where: {
          taskType: WarehouseTaskType.receiving,
          status: {
            in: [
              WarehouseTaskStatus.pending,
              WarehouseTaskStatus.assigned,
              WarehouseTaskStatus.in_progress,
            ],
          },
          workflowInstance: { referenceType: 'inbound_order', referenceId: orderId },
        },
        select: { id: true },
      });
      if (receivingOpen) openTask = 'receiving';
      else {
        const putawayOpen = await this.prisma.warehouseTask.findFirst({
          where: {
            taskType: WarehouseTaskType.putaway,
            status: {
              in: [
                WarehouseTaskStatus.pending,
                WarehouseTaskStatus.assigned,
                WarehouseTaskStatus.in_progress,
              ],
            },
            workflowInstance: { referenceType: 'inbound_order', referenceId: orderId },
          },
          select: { id: true },
        });
        if (putawayOpen) openTask = 'putaway';
      }
    }

    const next = nextInboundAdminAction(order.status, openTask);
    if (!next) {
      throw new BadRequestException(
        `No Admin stage action available for status ${order.status}. Use stage endpoints.`,
      );
    }
    switch (next) {
      case 'approve':
        return this.approveAdmin(user, orderId);
      case 'complete_receiving':
        return this.completeReceivingAdmin(user, orderId);
      case 'complete_putaway':
        return this.completePutawayAdmin(user, orderId);
      default:
        throw new BadRequestException(`Unknown Admin stage action: ${next}`);
    }
  }

  async confirm(user: AuthPrincipal, id: string, body?: ConfirmInboundBodyDto) {
    const order = await this.findById(id, user);
    const wasPendingApproval = order.status === InboundOrderStatus.pending_approval;
    for (const line of order.lines) {
      assertProductOrderableForOrders(line.product.status);
    }
    if (!isInboundConfirmable(order.status)) {
      throw new InvalidStateException(
        `Only draft or pending-approval orders can be confirmed (current status: ${order.status}).`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException('Add at least one line before confirming this order.');
    }
    // Unified Order Execution: Confirm/Release requires the same complete plan (no operational prompts).
    const releasePlan = parseInboundExecutionPlan(order.executionPlan);
    if (!releasePlan) {
      throw new BadRequestException(
        'A complete execution plan is required before confirmation or release.',
      );
    }
    assertInboundAdminPlanComplete(releasePlan);
    if (taskOnlyFlows(this.config)) {
      if (!body?.warehouseId || !body.stagingByLineId) {
        throw new BadRequestException(
          'When TASK_ONLY_FLOWS=true, confirm body must include warehouseId and stagingByLineId (per line).',
        );
      }
      const previousStatus = order.status;
      await this.prisma.$transaction(async (tx) => {
        await setTenantRlsContext(tx, user);
        const wh = body.warehouseId!;
        const cur = await tx.inboundOrder.findUnique({ where: { id } });
        if (!cur) throw new NotFoundException('Inbound order not found.');
        this.companyAccess.validateResourceOwnership(user, cur);
        if (!isInboundConfirmable(cur.status)) {
          throw new InvalidStateException(
            `Only draft or pending-approval orders can be confirmed (current status: ${cur.status}).`,
          );
        }
        await tx.inboundOrder.update({
          where: { id },
          data: { status: 'in_progress', confirmedAt: new Date() },
        });
        await this.workflowBootstrap.startInboundWorkflowTx(tx, user, id, wh, body.stagingByLineId);
        await this.audit.logTx(
          tx,
          this.audit.fromPrincipal(user, {
            action: 'INBOUND_CONFIRMED',
            resourceType: 'inbound_order',
            resourceId: id,
            companyId: cur.companyId,
            previousState: { status: previousStatus },
            newState: {
              status: 'in_progress',
              warehouseId: wh,
              stagingByLineId: body.stagingByLineId,
            },
          }),
        );
      });
      const updated = await this.findById(id, user);
      this.realtime.emitInboundOrderUpdated(updated.companyId, {
        orderId: updated.id,
        status: updated.status,
        reason: 'confirm',
        listItem: adminInboundListItem(updated),
      });
      if (wasPendingApproval) {
        await this.notifications.notifyClientOrderConfirmed({
          companyId: updated.companyId,
          orderType: 'inbound',
          orderId: updated.id,
          orderNumber: updated.orderNumber,
        });
        await this.notifications.dismissPendingAdminNotifications('inbound_order', updated.id);
      }
      return updated;
    }

    const previousStatus = order.status;
    await withTenantRls(this.prisma, user, async (tx) => {
      await tx.inboundOrder.update({
        where: { id },
        data: { status: 'confirmed', confirmedAt: new Date() },
      });
    });
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'INBOUND_CONFIRMED',
        resourceType: 'inbound_order',
        resourceId: id,
        companyId: order.companyId,
        previousState: { status: previousStatus },
        newState: { status: 'confirmed' },
      }),
    );

    const confirmed = await this.findById(id, user);
    this.realtime.emitInboundOrderUpdated(confirmed.companyId, {
      orderId: confirmed.id,
      status: confirmed.status,
      reason: 'confirm',
      listItem: adminInboundListItem(confirmed),
    });
    if (wasPendingApproval) {
      await this.notifications.notifyClientOrderConfirmed({
        companyId: confirmed.companyId,
        orderType: 'inbound',
        orderId: confirmed.id,
        orderNumber: confirmed.orderNumber,
      });
      await this.notifications.dismissPendingAdminNotifications('inbound_order', confirmed.id);
    }
    return confirmed;
  }

  async cancel(id: string, user: AuthPrincipal) {
    const order = await this.findById(id, user);
    // An order can be cancelled any time before it is finished.
    if (
      order.status === InboundOrderStatus.completed ||
      order.status === InboundOrderStatus.cancelled
    ) {
      throw new InvalidStateException(
        `Inbound orders cannot be cancelled once ${order.status} (current: ${order.status}).`,
      );
    }
    const previousStatus = order.status;
    const cancelled = await withTenantRls(this.prisma, user, async (tx) => {
      // Cancelling mid-workflow tears down all remaining work for this order:
      // deleting the workflow instance cascades its nodes, tasks, assignments
      // and events. Any stock already received is intentionally left untouched —
      // cancellation never moves inventory or changes product quantities.
      await tx.workflowInstance.deleteMany({
        where: { referenceType: 'inbound_order', referenceId: id },
      });
      return tx.inboundOrder.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: user.id,
        },
        include: ORDER_INCLUDE,
      });
    });
    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'INBOUND_ORDER_CANCELLED',
        resourceType: 'inbound_order',
        resourceId: cancelled.id,
        companyId: cancelled.companyId,
        previousState: { status: previousStatus },
        newState: { status: cancelled.status, cancelledBy: user.id },
      }),
    );
    this.realtime.emitInboundOrderUpdated(cancelled.companyId, {
      orderId: cancelled.id,
      status: cancelled.status,
      reason: 'cancel',
      listItem: adminInboundListItem(cancelled),
    });
    return cancelled;
  }

  /**
   * Permanently delete an inbound order that has not been confirmed/completed.
   * Only allowed for draft, pending-approval, or cancelled orders. Order lines
   * are removed via cascade; any stray workflow rows are cleaned defensively.
   */
  async remove(id: string, user: AuthPrincipal) {
    const order = await this.findById(id, user);
    if (!INBOUND_DELETABLE.includes(order.status)) {
      throw new InvalidStateException(
        `Only cancelled inbound orders can be deleted. Cancel the order first (current: ${order.status}).`,
      );
    }

    await withTenantRls(this.prisma, user, async (tx) => {
      // Safety net: these states never have stock movements. Refuse rather than
      // silently destroy ledger history if any unexpectedly exist.
      const ledgerCount = await tx.inventoryLedger.count({
        where: { referenceType: 'inbound_order', referenceId: id },
      });
      if (ledgerCount > 0) {
        throw new InvalidStateException(
          'This order has stock movements recorded and cannot be deleted.',
        );
      }
      // No workflows exist for these states, but clean any orphan rows defensively
      // (workflow instances are not FK-linked to the order).
      await tx.workflowInstance.deleteMany({
        where: { referenceType: 'inbound_order', referenceId: id },
      });
      await tx.inboundOrder.delete({ where: { id } });
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'INBOUND_ORDER_DELETED',
        resourceType: 'inbound_order',
        resourceId: id,
        companyId: order.companyId,
        previousState: { status: order.status, orderNumber: order.orderNumber },
        newState: { deleted: true },
      }),
    );
    this.realtime.emitInboundOrderUpdated(order.companyId, {
      orderId: id,
      status: order.status,
      reason: 'delete',
      listItem: adminInboundListItem(order),
    });
    return { id, deleted: true };
  }

  /**
   * Receive items against a single line. Atomic transaction:
   *   1. Validate destination location is `internal`.
   *   2. Resolve effective lot number (lock or override).
   *   3. UPSERT lot if lot-tracked.
   *   4. UPSERT current_stock (positive movement helper; returns before/after).
   *   5. INSERT inventory_ledger row (movement_type=inbound_receive, before/after).
   *   6. UPDATE inbound_order_line.received_quantity (DB trigger guards 110%).
   *   7. Re-evaluate order status (in_progress / partially_received / completed).
   */
  async receiveLine(
    user: AuthPrincipal,
    orderId: string,
    lineId: string,
    dto: ReceiveLineDto,
  ) {
    if (taskOnlyFlows(this.config)) {
      throw new GoneException(
        'Use warehouse RECEIVING task completion when TASK_ONLY_FLOWS=true; line receive API is disabled.',
      );
    }
    const received = await this.prisma.$transaction(async (tx) => {
      await setTenantRlsContext(tx, user);
      const order = await tx.inboundOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Inbound order not found.');
      this.companyAccess.validateResourceOwnership(user, order);
      if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
        throw new InvalidStateException(
          `Receive is only allowed when order status is confirmed/in_progress (current: ${order.status}).`,
        );
      }

      const line = await tx.inboundOrderLine.findUnique({
        where: { id: lineId },
        include: {
          product: {
            select: {
              id: true,
              status: true,
              trackingType: true,
              expiryTracking: true,
              uom: true,
            },
          },
        },
      });
      if (!line || line.inboundOrderId !== orderId) {
        throw new NotFoundException('Inbound line not found on this order.');
      }
      assertProductOrderableForOrders(line.product.status);
      assertDiscreteUomPositiveIntegerQuantity(
        line.product.uom,
        dto.quantity,
        'Receive quantity',
      );

      const delta = new Prisma.Decimal(dto.quantity);
      assertReceivingQuantitiesWithinExpected({
        expected: line.expectedQuantity,
        receivedQty: delta,
        damagedQty: new Prisma.Decimal(0),
        priorReceived: line.receivedQuantity,
        lineId: line.id,
      });

      const location = await tx.location.findUnique({
        where: { id: dto.locationId },
        select: { id: true, warehouseId: true, type: true, status: true },
      });
      if (!location) throw new NotFoundException('Destination location not found.');
      assertLocationUsableForInventoryMove(location.status);
      if (inboundReceiveDefersPutaway(this.config)) {
        if (!this.isDockStagingLocationType(location.type)) {
          throw new InvalidLocationTypeException(
            'Deferred putaway mode: receive only to a receiving dock location (`input`). Inventory posts on putaway task.',
          );
        }
        await tx.inboundOrderLine.update({
          where: { id: lineId },
          data: { receivedQuantity: { increment: delta } },
        });
        await this.refreshInboundOrderHeadStatus(tx, orderId);
        return tx.inboundOrder.findUnique({
          where: { id: orderId },
          include: ORDER_INCLUDE,
        });
      }

      if (!isStorageLocationType(location.type)) {
        throw new InvalidLocationTypeException(
          'Destination must be a storage-capable location (e.g. internal, packing, quarantine). Aisles/sections and dock nodes cannot receive stock.',
        );
      }

      // Resolve effective lot — honour the lock unless overrideLot=true.
      const expected = line.expectedLotNumber?.trim() || null;
      let effectiveLotNumber: string | undefined;
      if (line.product.trackingType === 'lot') {
        if (expected && !dto.overrideLot) {
          if (dto.lotNumber && dto.lotNumber !== expected) {
            throw new LotLockedException();
          }
          effectiveLotNumber = expected;
        } else {
          if (!dto.lotNumber) throw new LotRequiredException();
          effectiveLotNumber = dto.lotNumber;
        }
      }


      let expiryForLot: Date | null = null;
      if (line.product.trackingType === 'lot' && line.product.expiryTracking) {
        if (dto.expiryDate && dto.expiryDate.trim() !== '') {
          expiryForLot = new Date(dto.expiryDate);
        } else if (expected && !dto.overrideLot && line.expectedExpiryDate) {
          expiryForLot = new Date(line.expectedExpiryDate);
        }
        if (!expiryForLot) {
          throw new BadRequestException(
            'expiryDate is required for expiry-tracked products (send on line or use expected expiry).',
          );
        }
      }

      let lotId: string | null = null;
      if (effectiveLotNumber) {
        const existing = await tx.lot.findUnique({
          where: {
            productId_lotNumber: {
              productId: line.productId,
              lotNumber: effectiveLotNumber,
            },
          },
        });
        if (existing) {
          lotId = existing.id;
          if (expiryForLot && !existing.expiryDate) {
            await tx.lot.update({
              where: { id: existing.id },
              data: { expiryDate: expiryForLot },
            });
          }
        } else {
          const created = await tx.lot.create({
            data: {
              productId: line.productId,
              lotNumber: effectiveLotNumber,
              expiryDate: expiryForLot,
            },
          });
          lotId = created.id;
        }
      }

      await this.stock.upsertPositive(tx, {
        companyId: order.companyId,
        productId: line.productId,
        locationId: dto.locationId,
        warehouseId: location.warehouseId,
        lotId,
        quantity: dto.quantity,
      });

      await tx.inventoryLedger.create({
        data: {
          companyId: order.companyId,
          productId: line.productId,
          lotId,
          toLocationId: dto.locationId,
          movementType: 'inbound_receive',
          quantity: new Prisma.Decimal(dto.quantity),
          referenceType: 'inbound_order',
          referenceId: orderId,
          operatorId: user.id,
          idempotencyKey: `bm:inbound:${orderId}:${line.productId}:line:${line.id}:loc:${dto.locationId}:lot:${lotId ?? 'null'}`,
        },
      });

      const newReceived = line.receivedQuantity.plus(new Prisma.Decimal(dto.quantity));
      await tx.inboundOrderLine.update({
        where: { id: lineId },
        data: { receivedQuantity: newReceived },
      });

      await this.refreshInboundOrderHeadStatus(tx, orderId);

      return tx.inboundOrder.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
    });
    if (received) {
      const receivedLine = received.lines.find((l) => l.id === lineId);
      this.realtime.emitInboundOrderUpdated(received.companyId, {
        orderId: received.id,
        status: received.status,
        reason: 'receive_line',
        listItem: adminInboundListItem(received),
      });
      this.realtime.emitInventoryChanged(received.companyId, {
        source: 'inbound_receive_line',
        orderId: received.id,
        productId: receivedLine?.productId,
      });
    }
    return received;
  }

  private async refreshInboundOrderHeadStatus(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const order = await tx.inboundOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) return;
    const allLines = await tx.inboundOrderLine.findMany({
      where: { inboundOrderId: orderId },
      select: { receivedQuantity: true, expectedQuantity: true },
    });
    const allComplete = allLines.every((l) =>
      l.receivedQuantity.greaterThanOrEqualTo(l.expectedQuantity),
    );
    const anyReceived = allLines.some((l) => l.receivedQuantity.greaterThan(0));

    if (!anyReceived) return;
    if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
      return;
    }

    const next = allComplete ? 'in_progress' : 'partially_received';
    if (next !== order.status) {
      await tx.inboundOrder.update({ where: { id: orderId }, data: { status: next } });
    }
  }

  private isDockStagingLocationType(locationType: string): boolean {
    return locationType === 'input';
  }

  /** Lot-tracked inbound lines get a unique expected lot number when the client omits one. */
  private async allocateInboundExpectedLotNumber(productId: string): Promise<string> {
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = generateLotCandidate();
      const clash = await this.prisma.lot.findUnique({
        where: { productId_lotNumber: { productId, lotNumber: candidate } },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    throw new InternalServerErrorException('Could not allocate a unique inbound lot number.');
  }
}
