import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  OmsOrderStatus,
  OmsReturnStatus,
  Prisma,
  ProductTrackingType,
  ReturnItemDisposition,
  ReturnLineStatus,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { CodRecordsService } from '../cod/cod-records.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ReturnsService } from '../returns/returns.service';
import {
  ApproveOmsReturnDto,
  CreateOmsReturnDto,
  RejectOmsReturnDto,
  UpdateOmsReturnPlanDto,
} from './dto/oms-return.dto';
import {
  assertOmsReturnAdminStageAction,
  nextOmsReturnAdminAction,
} from './oms-return-admin-stages';
import {
  assertInboundAdminPlanComplete,
  normalizeExecutionMode,
  parseInboundExecutionPlan,
} from '../orders/execution-plan.util';
import type { InboundExecutionPlan } from '../orders/execution-plan.types';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../common/transformers/query-transform';
import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { IsUuidLoose } from '../../common/validators/is-uuid-loose';

export class ListOmsReturnsQueryDto extends PaginationDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  companyId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsUuidLoose()
  omsOrderId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(OmsReturnStatus)
  status?: OmsReturnStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

const INCLUDE = {
  company: { select: { id: true, name: true } },
  omsOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      outboundOrderId: true,
    },
  },
  warehouseReturn: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      warehouseId: true,
      lines: {
        orderBy: { lineNumber: 'asc' as const },
        select: {
          id: true,
          productId: true,
          expectedQuantity: true,
          receivedQuantity: true,
          postedQuantity: true,
          lineStatus: true,
          targetLocationId: true,
        },
      },
    },
  },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          uom: true,
          trackingType: true,
          imagePath: true,
        },
      },
    },
  },
} satisfies Prisma.OmsReturnInclude;

function decStr(v: Prisma.Decimal | string | number | null | undefined): string {
  if (v == null) return '0';
  return typeof v === 'object' && 'toString' in v ? v.toString() : String(v);
}

function resolvePlanPutawayLocationId(
  plan: InboundExecutionPlan,
  productId: string,
): string {
  const planLine = plan.lines.find((l) => l.productId === productId);
  const splits = planLine?.putaway ?? [];
  if (splits.length === 0) {
    throw new BadRequestException(
      `Plan is missing putaway location for product ${productId}.`,
    );
  }
  const locationIds = [...new Set(splits.map((s) => s.locationId))];
  if (locationIds.length > 1) {
    throw new BadRequestException(
      `Return putaway supports one location per product (got ${locationIds.length} for ${productId}).`,
    );
  }
  return locationIds[0]!;
}

function serialize(row: {
  id: string;
  companyId: string;
  omsOrderId: string;
  warehouseReturnId: string | null;
  returnNumber: string;
  status: OmsReturnStatus;
  reason: string | null;
  notes: string | null;
  rejectionReason: string | null;
  executionMode?: string | null;
  executionPlan?: Prisma.JsonValue | null;
  createdBy: string;
  approvedBy: string | null;
  rejectedBy: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  company?: { id: string; name: string } | null;
  omsOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    outboundOrderId: string | null;
  } | null;
  warehouseReturn?: {
    id: string;
    orderNumber: string;
    status: string;
    warehouseId?: string | null;
    lines?: Array<{
      id: string;
      productId: string;
      expectedQuantity: Prisma.Decimal;
      receivedQuantity: Prisma.Decimal;
      postedQuantity: Prisma.Decimal;
      lineStatus: string;
      targetLocationId: string | null;
    }>;
  } | null;
  lines: Array<{
    id: string;
    productId: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal | null;
    lineTotal: Prisma.Decimal | null;
    lotId: string | null;
    lineNumber: number;
    product?: {
      id: string;
      sku: string;
      name: string;
      uom: string;
      trackingType: string;
      imagePath?: string | null;
    } | null;
  }>;
}) {
  const whLines = row.warehouseReturn?.lines ?? [];
  const hasUnreceivedQty = whLines.some((l) =>
    l.receivedQuantity.lt(l.expectedQuantity),
  );
  const hasUnpostedQty = whLines.some(
    (l) =>
      l.lineStatus !== ReturnLineStatus.posted &&
      l.receivedQuantity.gt(0),
  );
  const nextAction = nextOmsReturnAdminAction(row.status, {
    status: row.warehouseReturn?.status ?? null,
    hasUnreceivedQty,
    hasUnpostedQty,
  });

  return {
    ...row,
    executionMode: normalizeExecutionMode(row.executionMode),
    executionPlan: parseInboundExecutionPlan(row.executionPlan),
    nextAdminAction: nextAction,
    lines: row.lines.map((l) => ({
      ...l,
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice?.toString() ?? null,
      lineTotal: l.lineTotal?.toString() ?? null,
    })),
    warehouseReturn: row.warehouseReturn
      ? {
          ...row.warehouseReturn,
          lines: whLines.map((l) => ({
            ...l,
            expectedQuantity: decStr(l.expectedQuantity),
            receivedQuantity: decStr(l.receivedQuantity),
            postedQuantity: decStr(l.postedQuantity),
          })),
        }
      : null,
  };
}

@Injectable()
export class OmsReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    @Inject(forwardRef(() => ReturnsService))
    private readonly warehouseReturns: ReturnsService,
    private readonly cod: CodRecordsService,
    private readonly realtime: RealtimeService,
  ) {}

  private emitReturn(
    companyId: string,
    returnId: string,
    status: string,
    event: string,
    omsOrderId?: string,
  ): void {
    this.realtime.emitOmsReturnEvent(companyId, {
      returnId,
      status,
      event,
      omsOrderId,
    });
  }

  async list(user: AuthPrincipal, query: ListOmsReturnsQueryDto) {
    const where: Prisma.OmsReturnWhereInput = {};
    const companyId = readCompanyIdCatalogFilter(
      this.companyAccess,
      user,
      query.companyId,
    );
    if (companyId) where.companyId = companyId;
    if (query.omsOrderId) where.omsOrderId = query.omsOrderId;
    if (query.status) where.status = query.status;

    if (query.search?.trim()) {
      const t = query.search.trim();
      where.OR = [
        { returnNumber: { contains: t, mode: 'insensitive' } },
        { reason: { contains: t, mode: 'insensitive' } },
        { notes: { contains: t, mode: 'insensitive' } },
        { company: { name: { contains: t, mode: 'insensitive' } } },
        { omsOrder: { orderNumber: { contains: t, mode: 'insensitive' } } },
      ];
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.omsReturn.findMany({
          where,
          include: INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
        }),
        tx.omsReturn.count({ where }),
      ]);
      return {
        items: items.map(serialize),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async findById(id: string, user: AuthPrincipal) {
    const row = await withTenantRls(this.prisma, user, async (tx) =>
      tx.omsReturn.findUnique({ where: { id }, include: INCLUDE }),
    );
    if (!row) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, row);
    return serialize(row);
  }

  async create(user: AuthPrincipal, dto: CreateOmsReturnDto) {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: dto.omsOrderId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException('OMS order not found.');
    this.companyAccess.validateResourceOwnership(user, order);

    if (order.status !== OmsOrderStatus.delivered) {
      throw new InvalidStateException(
        'OMS returns can only be created for Delivered orders.',
      );
    }

    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, companyId: true, trackingType: true, sku: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }
    for (const p of products) {
      if (p.companyId !== order.companyId) {
        throw new BadRequestException('Product does not belong to the order company.');
      }
    }
    const productById = new Map(products.map((p) => [p.id, p]));
    const resolvedLines: Array<{
      productId: string;
      quantity: number;
      unitPrice?: number;
      lotId: string | null;
    }> = [];

    // Transactional remaining-qty guard: sum active prior return lines per product.
    const priorReturned = await this.sumActiveReturnedQtyByProduct(order.id);
    const requestedNow = new Map<string, Prisma.Decimal>();

    for (const line of dto.lines) {
      const p = productById.get(line.productId)!;
      let lotId = line.lotId ?? null;
      if (p.trackingType === ProductTrackingType.lot && !lotId) {
        lotId = await this.resolveLotFromOutbound(
          line.productId,
          order.outboundOrderId,
        );
      }
      if (p.trackingType === ProductTrackingType.lot && !lotId) {
        throw new BadRequestException(
          `Product ${p.sku} requires a lotId on the return line.`,
        );
      }
      const orderLine = order.lines.find((l) => l.productId === line.productId);
      if (!orderLine) {
        throw new BadRequestException(
          `Product ${p.sku} is not on the original OMS order.`,
        );
      }
      const qty = new Prisma.Decimal(line.quantity);
      const already = priorReturned.get(line.productId) ?? new Prisma.Decimal(0);
      const batch = requestedNow.get(line.productId) ?? new Prisma.Decimal(0);
      const nextBatch = batch.add(qty);
      requestedNow.set(line.productId, nextBatch);
      if (already.add(nextBatch).greaterThan(orderLine.requestedQuantity)) {
        const available = orderLine.requestedQuantity.sub(already);
        throw new BadRequestException(
          `Return qty for ${p.sku} exceeds remaining returnable quantity ` +
            `(ordered ${orderLine.requestedQuantity.toString()}, already returned ${already.toString()}, available ${available.toString()}).`,
        );
      }
      resolvedLines.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lotId,
      });
    }

    // return_number left blank → trg_oms_return_number / next_seq_number('OR')
    // (global unique; do not use per-company count — collides with UNIQUE return_number)
    const created = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsReturn.create({
        data: {
          companyId: order.companyId,
          omsOrderId: order.id,
          status: OmsReturnStatus.requested,
          executionMode: 'admin',
          reason: dto.reason?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdBy: user.id,
          lines: {
            create: resolvedLines.map((l, idx) => {
              const unitPrice =
                l.unitPrice != null
                  ? new Prisma.Decimal(l.unitPrice)
                  : order.lines.find((ol) => ol.productId === l.productId)
                      ?.unitPrice ?? null;
              const qty = new Prisma.Decimal(l.quantity);
              const lineTotal = unitPrice != null ? unitPrice.mul(qty) : null;
              return {
                productId: l.productId,
                quantity: qty,
                unitPrice: unitPrice ?? undefined,
                lineTotal: lineTotal ?? undefined,
                lotId: l.lotId,
                lineNumber: idx + 1,
              };
            }),
          },
        },
        include: INCLUDE,
      });
      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: order.id,
          companyId: order.companyId,
          eventType: 'oms_return.created',
          createdBy: user.id,
          payload: {
            omsReturnId: row.id,
            returnNumber: row.returnNumber,
          },
        },
      });
      return row;
    });

    this.emitReturn(
      created.companyId,
      created.id,
      created.status,
      'oms_return.created',
      created.omsOrderId,
    );
    return serialize(created);
  }

  async updatePlan(id: string, user: AuthPrincipal, dto: UpdateOmsReturnPlanDto) {
    const existing = await this.prisma.omsReturn.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!existing) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, existing);

    if (existing.status !== OmsReturnStatus.requested) {
      throw new InvalidStateException(
        `Plan can only be edited while the return is requested (current: ${existing.status}).`,
      );
    }

    let executionPlan: Prisma.InputJsonValue | undefined;
    if (dto.executionPlan !== undefined) {
      const parsed = parseInboundExecutionPlan(dto.executionPlan);
      if (!parsed) throw new BadRequestException('Invalid executionPlan.');
      const withLineIds: InboundExecutionPlan = {
        ...parsed,
        planUpdatedAt: new Date().toISOString(),
        lines: existing.lines.map((ol) => {
          const match =
            parsed.lines.find((l) => l.orderLineId === ol.id) ??
            parsed.lines.find((l) => l.productId === ol.productId);
          return {
            productId: ol.productId,
            orderLineId: ol.id,
            expectedQty: Number(ol.quantity),
            putaway: match?.putaway ?? [],
          };
        }),
      };
      assertInboundAdminPlanComplete(withLineIds);
      executionPlan = withLineIds as unknown as Prisma.InputJsonValue;
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) =>
      tx.omsReturn.update({
        where: { id },
        data: {
          ...(dto.executionMode !== undefined
            ? { executionMode: normalizeExecutionMode(dto.executionMode) }
            : { executionMode: existing.executionMode ?? 'admin' }),
          ...(executionPlan !== undefined ? { executionPlan } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        },
        include: INCLUDE,
      }),
    );

    this.emitReturn(
      existing.companyId,
      id,
      updated.status,
      'oms_return.plan_updated',
      existing.omsOrderId,
    );
    return serialize(updated);
  }

  async approve(id: string, user: AuthPrincipal, dto: ApproveOmsReturnDto = {}) {
    const existing = await this.prisma.omsReturn.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        omsOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            outboundOrderId: true,
            lines: {
              select: { productId: true, requestedQuantity: true },
            },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, existing);

    // Idempotent: already approved — do not auto-finalize; stages continue separately.
    if (
      existing.status === OmsReturnStatus.approved &&
      existing.warehouseReturnId
    ) {
      return this.findById(id, user);
    }

    if (existing.status === OmsReturnStatus.completed) {
      return this.findById(id, user);
    }

    assertOmsReturnAdminStageAction(existing.status, 'approve');

    const plan = parseInboundExecutionPlan(existing.executionPlan);
    if (!plan) {
      throw new BadRequestException(
        'Approve requires a saved execution plan (receiving dock + putaway locations).',
      );
    }
    assertInboundAdminPlanComplete(plan);

    // Fail early with SKU-level message when other returns already cover ordered qty.
    await this.assertOmsReturnStillReturnable(existing);

    const outboundId = existing.omsOrder?.outboundOrderId;
    if (!outboundId) {
      throw new BadRequestException(
        'OMS order has no outbound; cannot create warehouse return.',
      );
    }

    const outboundLines = await this.prisma.outboundOrderLine.findMany({
      where: { outboundOrderId: outboundId },
      select: { id: true, productId: true },
    });
    const outboundLineByProduct = new Map(
      outboundLines.map((l) => [l.productId, l.id]),
    );

    const warehouseId =
      dto.warehouseId ??
      plan.warehouseId ??
      (
        await this.prisma.stockReservation.findFirst({
          where: { outboundOrderId: outboundId },
          orderBy: { createdAt: 'desc' },
          select: { location: { select: { warehouseId: true } } },
        })
      )?.location.warehouseId;

    if (!warehouseId) {
      throw new BadRequestException(
        'Cannot resolve warehouse for return. Provide warehouseId on the plan or approve.',
      );
    }

    // Resume an orphan WH return from a previous approve attempt (same return #).
    let whReturn = await this.prisma.returnOrder.findFirst({
      where: {
        originalOutboundOrderId: outboundId,
        clientReference: existing.returnNumber,
        status: { notIn: ['cancelled', 'completed'] },
      },
      select: { id: true, status: true },
    });

    if (!whReturn) {
      const created = await this.warehouseReturns.create(user, {
        companyId: existing.companyId,
        warehouseId,
        originalOutboundOrderId: outboundId,
        notes: existing.reason ?? existing.notes ?? undefined,
        clientReference: existing.returnNumber,
        lines: existing.lines.map((l) => ({
          productId: l.productId,
          expectedQuantity: Number(l.quantity),
          lotId: l.lotId ?? undefined,
          outboundOrderLineId: outboundLineByProduct.get(l.productId),
        })),
      });
      whReturn = { id: created.id, status: created.status };
    }

    if (whReturn.status === 'draft') {
      await this.warehouseReturns.confirm(user, whReturn.id);
      whReturn = { id: whReturn.id, status: 'confirmed' };
    }
    if (whReturn.status === 'confirmed') {
      await this.warehouseReturns.startReceiving(user, whReturn.id);
    }

    await withTenantRls(this.prisma, user, async (tx) => {
      await tx.omsReturn.update({
        where: { id },
        data: {
          status: OmsReturnStatus.approved,
          warehouseReturnId: whReturn.id,
          approvedAt: new Date(),
          approvedBy: user.id,
          executionMode: existing.executionMode ?? 'admin',
        },
      });
      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: existing.omsOrderId,
          companyId: existing.companyId,
          eventType: 'oms_return.approved',
          createdBy: user.id,
          payload: {
            omsReturnId: id,
            warehouseReturnId: whReturn.id,
            receivingDockId: plan.receivingDockId,
          },
        },
      });
      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: existing.omsOrderId,
          companyId: existing.companyId,
          eventType: 'warehouse_return.created',
          createdBy: user.id,
          payload: { warehouseReturnId: whReturn.id },
        },
      });
    });

    const approved = await this.findById(id, user);
    this.emitReturn(
      existing.companyId,
      id,
      typeof approved === 'object' && approved && 'status' in approved
        ? String((approved as { status: string }).status)
        : 'approved',
      'oms_return.approved',
      existing.omsOrderId,
    );
    return approved;
  }

  async completeReceivingAdmin(id: string, user: AuthPrincipal) {
    const existing = await this.prisma.omsReturn.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!existing) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, existing);
    assertOmsReturnAdminStageAction(existing.status, 'complete_receiving');

    if (!existing.warehouseReturnId || !existing.warehouseReturn) {
      throw new BadRequestException('Approved return has no warehouse return yet.');
    }

    const whId = existing.warehouseReturnId;
    let wh = await this.warehouseReturns.findById(whId, user);

    for (const line of wh.lines) {
      const remaining = line.expectedQuantity.minus(line.receivedQuantity);
      if (remaining.gt(0)) {
        await this.warehouseReturns.receiveLine(user, whId, line.id, {
          quantity: Number(remaining),
        });
      }
    }

    wh = await this.warehouseReturns.findById(whId, user);
    this.emitReturn(
      existing.companyId,
      id,
      existing.status,
      'oms_return.receiving_completed',
      existing.omsOrderId,
    );
    return this.findById(id, user);
  }

  async completePutawayAdmin(id: string, user: AuthPrincipal) {
    const existing = await this.prisma.omsReturn.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!existing) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, existing);
    assertOmsReturnAdminStageAction(existing.status, 'complete_putaway');

    if (!existing.warehouseReturnId) {
      throw new BadRequestException('Approved return has no warehouse return yet.');
    }

    const plan = parseInboundExecutionPlan(existing.executionPlan);
    if (!plan) {
      throw new BadRequestException('Putaway requires a saved execution plan.');
    }

    const whId = existing.warehouseReturnId;
    let wh = await this.warehouseReturns.findById(whId, user);

    for (const line of wh.lines) {
      if (line.receivedQuantity.lt(line.expectedQuantity)) {
        throw new BadRequestException(
          'Mark receiving complete before putaway.',
        );
      }
    }

    for (const line of wh.lines) {
      if (line.lineStatus === ReturnLineStatus.posted) continue;
      if (line.receivedQuantity.lte(0)) continue;
      const targetLocationId = resolvePlanPutawayLocationId(plan, line.productId);
      await this.warehouseReturns.applyDisposition(user, whId, line.id, {
        disposition: ReturnItemDisposition.restock,
        targetLocationId,
      });
    }

    await this.warehouseReturns.complete(user, whId);

    this.emitReturn(
      existing.companyId,
      id,
      OmsReturnStatus.completed,
      'oms_return.putaway_completed',
      existing.omsOrderId,
    );
    return this.findById(id, user);
  }

  async reject(id: string, user: AuthPrincipal, dto: RejectOmsReturnDto = {}) {
    const existing = await this.prisma.omsReturn.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, existing);
    if (existing.status !== OmsReturnStatus.requested) {
      throw new InvalidStateException(
        `Only requested returns can be rejected (current: ${existing.status}).`,
      );
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsReturn.update({
        where: { id },
        data: {
          status: OmsReturnStatus.rejected,
          rejectedAt: new Date(),
          rejectedBy: user.id,
          rejectionReason: dto.reason?.trim() || null,
        },
        include: INCLUDE,
      });
      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: existing.omsOrderId,
          companyId: existing.companyId,
          eventType: 'oms_return.rejected',
          createdBy: user.id,
          payload: { reason: dto.reason },
        },
      });
      return row;
    });

    this.emitReturn(
      existing.companyId,
      id,
      updated.status,
      'oms_return.rejected',
      existing.omsOrderId,
    );
    return serialize(updated);
  }
  async onWarehouseReturnCompleted(
    user: AuthPrincipal,
    warehouseReturnId: string,
  ) {
    const omsReturn = await this.prisma.omsReturn.findUnique({
      where: { warehouseReturnId },
      include: { lines: true },
    });
    if (!omsReturn) return null;

    if (omsReturn.status === OmsReturnStatus.completed) {
      // Retry COD adjustment if needed
      await this.applyCodAdjustment(user, omsReturn);
      return this.findById(omsReturn.id, user);
    }

    if (omsReturn.status !== OmsReturnStatus.approved) {
      return null;
    }

    await this.prisma.omsReturn.update({
      where: { id: omsReturn.id },
      data: {
        status: OmsReturnStatus.completed,
        completedAt: new Date(),
      },
    });

    await this.prisma.omsOrderEvent.create({
      data: {
        omsOrderId: omsReturn.omsOrderId,
        companyId: omsReturn.companyId,
        eventType: 'oms_return.completed',
        createdBy: user.id,
        payload: { omsReturnId: omsReturn.id, warehouseReturnId },
      },
    });

    await this.applyCodAdjustment(user, omsReturn);

    // OMS status → returned ONLY after goods received/complete AND all qty returned.
    // Requested/approved alone must never set OMS returned.
    await this.maybeMarkOmsFullyReturned(user, omsReturn.omsOrderId);

    const completed = await this.findById(omsReturn.id, user);
    this.emitReturn(
      omsReturn.companyId,
      omsReturn.id,
      'completed',
      'oms_return.completed',
      omsReturn.omsOrderId,
    );
    return completed;
  }

  /** Sum quantities on non-cancelled/rejected returns for an OMS order, by product. */
  private async sumActiveReturnedQtyByProduct(
    omsOrderId: string,
    excludeReturnId?: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const lines = await this.prisma.omsReturnLine.findMany({
      where: {
        omsReturn: {
          omsOrderId,
          status: {
            in: [
              OmsReturnStatus.requested,
              OmsReturnStatus.approved,
              OmsReturnStatus.completed,
            ],
          },
          ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
        },
      },
      select: { productId: true, quantity: true },
    });
    const map = new Map<string, Prisma.Decimal>();
    for (const l of lines) {
      const cur = map.get(l.productId) ?? new Prisma.Decimal(0);
      map.set(l.productId, cur.add(l.quantity));
    }
    return map;
  }

  /**
   * Guard approve against other OMS returns that already consumed returnable qty.
   * Uses product SKU in the error (not outbound-line UUIDs).
   */
  private async assertOmsReturnStillReturnable(
    omsReturn: {
      id: string;
      omsOrderId: string;
      lines: Array<{
        productId: string;
        quantity: Prisma.Decimal;
        product?: { sku: string } | null;
      }>;
      omsOrder?: {
        lines?: Array<{ productId: string; requestedQuantity: Prisma.Decimal }>;
      } | null;
    },
  ): Promise<void> {
    const orderLines =
      omsReturn.omsOrder?.lines ??
      (
        await this.prisma.omsOrder.findUnique({
          where: { id: omsReturn.omsOrderId },
          select: { lines: { select: { productId: true, requestedQuantity: true } } },
        })
      )?.lines ??
      [];

    const prior = await this.sumActiveReturnedQtyByProduct(
      omsReturn.omsOrderId,
      omsReturn.id,
    );

    for (const line of omsReturn.lines) {
      const ordered = orderLines.find((l) => l.productId === line.productId);
      if (!ordered) {
        throw new BadRequestException(
          `Product ${line.product?.sku ?? line.productId} is not on the original OMS order.`,
        );
      }
      const already = prior.get(line.productId) ?? new Prisma.Decimal(0);
      const available = ordered.requestedQuantity.sub(already);
      if (line.quantity.gt(available)) {
        const sku = line.product?.sku ?? line.productId;
        throw new BadRequestException(
          `Cannot approve return for ${sku}: ordered ${ordered.requestedQuantity.toString()}, ` +
            `already covered by other returns ${already.toString()}, ` +
            `this return requests ${line.quantity.toString()} ` +
            `(available ${Prisma.Decimal.max(available, new Prisma.Decimal(0)).toString()}). ` +
            `Reject this return or reduce its quantity.`,
        );
      }
    }
  }

  private async maybeMarkOmsFullyReturned(
    user: AuthPrincipal,
    omsOrderId: string,
  ): Promise<void> {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: { lines: true },
    });
    if (!order || order.status !== OmsOrderStatus.delivered) return;

    // Only completed returns count toward "goods received / fully returned".
    const completedLines = await this.prisma.omsReturnLine.findMany({
      where: {
        omsReturn: {
          omsOrderId,
          status: OmsReturnStatus.completed,
        },
      },
      select: { productId: true, quantity: true },
    });
    const returnedByProduct = new Map<string, Prisma.Decimal>();
    for (const l of completedLines) {
      const cur = returnedByProduct.get(l.productId) ?? new Prisma.Decimal(0);
      returnedByProduct.set(l.productId, cur.add(l.quantity));
    }

    for (const ol of order.lines) {
      const ret = returnedByProduct.get(ol.productId) ?? new Prisma.Decimal(0);
      if (ret.lessThan(ol.requestedQuantity)) return;
    }

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
        createdBy: user.id,
        payload: {
          reason: 'all_ordered_qty_returned_via_completed_returns',
        },
      },
    });
    try {
      await this.cod.markReturnedForOrder(omsOrderId, user);
    } catch {
      // COD mark is best-effort; return completion already succeeded.
    }
  }

  private async applyCodAdjustment(
    user: AuthPrincipal,
    omsReturn: {
      id: string;
      companyId: string;
      omsOrderId: string;
      reason: string | null;
      lines: Array<{
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal | null;
        lineTotal: Prisma.Decimal | null;
      }>;
    },
  ) {
    const amount = omsReturn.lines.reduce((sum, l) => {
      if (l.lineTotal != null) return sum.add(l.lineTotal);
      if (l.unitPrice != null) return sum.add(l.unitPrice.mul(l.quantity));
      return sum;
    }, new Prisma.Decimal(0));

    if (amount.isZero()) {
      try {
        await this.cod.markReturnedForOrder(omsReturn.omsOrderId, user);
      } catch {
        // ignore
      }
      return;
    }

    try {
      await this.cod.createReturnAdjustment({
        user,
        omsReturnId: omsReturn.id,
        companyId: omsReturn.companyId,
        omsOrderId: omsReturn.omsOrderId,
        amount,
        reason: omsReturn.reason ?? undefined,
      });
    } catch {
      // Inventory stays completed; admin can retry via WH return complete again
    }
  }

  private async resolveLotFromOutbound(
    productId: string,
    outboundOrderId: string | null,
  ): Promise<string | null> {
    if (!outboundOrderId) return null;

    const byLine = await this.prisma.outboundOrderLine.findFirst({
      where: {
        outboundOrderId,
        productId,
        specificLotId: { not: null },
      },
      select: { specificLotId: true },
    });
    if (byLine?.specificLotId) return byLine.specificLotId;

    const reservation = await this.prisma.stockReservation.findFirst({
      where: {
        outboundOrderId,
        productId,
        lotId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { lotId: true },
    });
    return reservation?.lotId ?? null;
  }
}
