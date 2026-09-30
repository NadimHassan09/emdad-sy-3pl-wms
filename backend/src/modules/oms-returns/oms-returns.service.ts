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
import { isOmsReturnEligibleStatus } from '../oms/oms-return-eligibility';
import {
  assertOmsOrderUuid,
  dedupeExpressReturnInputs,
  expressReturnStatusRejectReason,
  looksLikeUuid,
  resolveExpressReturnOrder,
} from './express-return-resolve';
import {
  aggregateNormalReturnRows,
  resolveProductOnOrderLines,
  type NormalReturnImportRow,
} from './normal-return-import';
import type {
  ImportOmsReturnsDto,
  PreviewOmsReturnDto,
} from './dto/oms-return.dto';
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

    if (!isOmsReturnEligibleStatus(order.status)) {
      throw new InvalidStateException(
        'OMS returns can only be created for Delivered or Out for Delivery orders.',
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

    // Auto-complete: approve, receive, putaway → inventory goes to "returns" location
    try {
      await this.autoCompleteReturn(created.id, user);
      return this.findById(created.id, user);
    } catch {
      // If auto-complete fails, return is still created as "requested"
      return serialize(created);
    }
  }

  /**
   * Admin: confirm a single return — runs the full auto-complete pipeline
   * (approve → receive → putaway → completed). Idempotent: already-completed
   * returns are returned as-is.
   */
  async confirmReturn(id: string, user: AuthPrincipal) {
    const existing = await this.prisma.omsReturn.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, existing);

    // Idempotent for terminal statuses
    if (
      existing.status === OmsReturnStatus.completed ||
      existing.status === OmsReturnStatus.cancelled ||
      existing.status === OmsReturnStatus.rejected
    ) {
      return this.findById(id, user);
    }

    await this.runConfirmPipeline(id, existing.status, user);
    return this.findById(id, user);
  }

  /**
   * Internal helper: runs the full confirm pipeline based on current status.
   * - requested  → autoCompleteReturn (approve + receive + putaway)
   * - approved   → completeReceiving + completePutaway (warehouse return already exists)
   */
  private async runConfirmPipeline(
    id: string,
    status: OmsReturnStatus | string,
    user: AuthPrincipal,
  ): Promise<void> {
    if (status === OmsReturnStatus.requested || status === 'requested') {
      await this.autoCompleteReturn(id, user);
    } else if (status === OmsReturnStatus.approved || status === 'approved') {
      // WH return already exists — complete remaining stages
      try { await this.completeReceivingAdmin(id, user); } catch { /* already received */ }
      try { await this.completePutawayAdmin(id, user); } catch { /* already put away */ }
    }
  }

  /**
   * Bulk confirm returns — runs the confirm pipeline on each id.
   * Already-completed/cancelled/rejected returns are silently skipped.
   */
  async confirmReturnsBulk(
    ids: string[],
    user: AuthPrincipal,
  ): Promise<{
    requested: number;
    confirmed: number;
    skipped: number;
    failed: number;
    confirmedReturns: Array<{ id: string; returnNumber: string; status: string }>;
    failures: Array<{ id: string; error: string }>;
  }> {
    let confirmed = 0;
    let skipped = 0;
    const confirmedReturns: Array<{ id: string; returnNumber: string; status: string }> = [];
    const failures: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        const existing = await this.prisma.omsReturn.findUnique({ where: { id } });
        if (!existing) {
          failures.push({ id, error: 'Return not found.' });
          continue;
        }
        // Skip already terminal
        if (
          existing.status === OmsReturnStatus.completed ||
          existing.status === OmsReturnStatus.cancelled ||
          existing.status === OmsReturnStatus.rejected
        ) {
          skipped++;
          continue;
        }
        await this.runConfirmPipeline(id, existing.status, user);
        const done = await this.prisma.omsReturn.findUnique({ where: { id } });
        if (done) {
          confirmedReturns.push({ id, returnNumber: done.returnNumber, status: done.status });
          confirmed++;
        }
      } catch (e) {
        failures.push({ id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      requested: ids.length,
      confirmed,
      skipped,
      failed: failures.length,
      confirmedReturns,
      failures,
    };
  }

  /**
   * Warehouse high-speed scan handler:
   * Accepts a scanned code (Waybill QR code with OMS order number, Return number,
   * tracking number, or Carrier AWB) and confirms/restocks the return immediately.
   */
  async confirmReturnByScan(
    user: AuthPrincipal,
    rawCode: string,
  ): Promise<{
    ok: boolean;
    action: 'confirmed' | 'already_completed' | 'created_and_confirmed';
    returnId?: string;
    returnNumber?: string;
    orderNumber?: string;
    clientName?: string;
    message: string;
  }> {
    const trimmed = (rawCode || '').trim();
    if (!trimmed) {
      throw new BadRequestException('الرجاء إدخال أو مسح رمز صالح.');
    }

    // Extract clean identifier if rawCode is a URL
    let cleanCode = trimmed;
    try {
      if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
        const url = new URL(cleanCode);
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          cleanCode = segments[segments.length - 1];
        }
      }
    } catch {
      // ignore URL parse errors
    }

    const candidates = Array.from(new Set([cleanCode, trimmed].filter(Boolean)));

    // 1. First, search OmsReturn by returnNumber or ID
    for (const candidate of candidates) {
      const isUuid = looksLikeUuid(candidate);
      const ret = await this.prisma.omsReturn.findFirst({
        where: isUuid
          ? { id: candidate }
          : { returnNumber: { equals: candidate, mode: 'insensitive' } },
        include: {
          company: true,
          omsOrder: true,
        },
      });

      if (ret) {
        this.companyAccess.validateResourceOwnership(user, ret);
        if (ret.status === OmsReturnStatus.completed) {
          return {
            ok: true,
            action: 'already_completed',
            returnId: ret.id,
            returnNumber: ret.returnNumber,
            orderNumber: ret.omsOrder?.orderNumber ?? '—',
            clientName: ret.company?.name ?? '—',
            message: 'المرتجع مكتمل ومستلم مسبقاً في المستودع.',
          };
        }

        if (ret.status === OmsReturnStatus.cancelled || ret.status === OmsReturnStatus.rejected) {
          throw new BadRequestException(
            `لا يمكن استلام هذا المرتجع لأنه ملغي أو مرفوض (الحالة: ${ret.status}).`,
          );
        }

        await this.runConfirmPipeline(ret.id, ret.status, user);
        return {
          ok: true,
          action: 'confirmed',
          returnId: ret.id,
          returnNumber: ret.returnNumber,
          orderNumber: ret.omsOrder?.orderNumber ?? '—',
          clientName: ret.company?.name ?? '—',
          message: 'تم استلام وتأكيد المرتجع وإعادة البضاعة للمستودع بنجاح.',
        };
      }
    }

    // 2. Search OmsOrder by orderNumber, id, clientReference, trackingNumber
    let matchedOrder: any = null;
    for (const candidate of candidates) {
      const isUuid = looksLikeUuid(candidate);
      const order = await this.prisma.omsOrder.findFirst({
        where: {
          OR: [
            ...(isUuid ? [{ id: candidate }] : []),
            { orderNumber: { equals: candidate, mode: 'insensitive' } },
            { clientReference: { equals: candidate, mode: 'insensitive' } },
            { trackingNumber: { equals: candidate, mode: 'insensitive' } },
          ],
        },
        include: {
          company: true,
          lines: true,
        },
      });

      if (order) {
        matchedOrder = order;
        break;
      }
    }

    // Also check OutboundOrder tracking or CarrierShipment if not found
    if (!matchedOrder) {
      for (const candidate of candidates) {
        // Check OutboundOrder tracking number or order number
        const outbound = await this.prisma.outboundOrder.findFirst({
          where: {
            OR: [
              { trackingNumber: { equals: candidate, mode: 'insensitive' } },
              { orderNumber: { equals: candidate, mode: 'insensitive' } },
            ],
          },
          include: {
            omsOrder: {
              include: { company: true, lines: true },
            },
          },
        });
        if (outbound?.omsOrder) {
          matchedOrder = outbound.omsOrder;
          break;
        }

        // Check CarrierShipment externalAwb or trackingNumber
        const carrierShipment = await this.prisma.carrierShipment.findFirst({
          where: {
            OR: [
              { trackingNumber: { equals: candidate, mode: 'insensitive' } },
              { externalAwb: { equals: candidate, mode: 'insensitive' } },
            ],
          },
          include: {
            outboundOrder: {
              include: {
                omsOrder: {
                  include: { company: true, lines: true },
                },
              },
            },
          },
        });
        if (carrierShipment?.outboundOrder?.omsOrder) {
          matchedOrder = carrierShipment.outboundOrder.omsOrder;
          break;
        }
      }
    }

    if (!matchedOrder) {
      throw new NotFoundException(
        `لم يتم العثور على طلب أو مرتجع مطابق للرمز (${cleanCode}). تأكد من مسح QR بوليصة الشحن الصحيحة.`,
      );
    }

    this.companyAccess.validateResourceOwnership(user, matchedOrder);

    // Check existing returns for this OMS order
    const existingReturns = await this.prisma.omsReturn.findMany({
      where: { omsOrderId: matchedOrder.id },
      orderBy: { createdAt: 'desc' },
      include: { company: true },
    });

    const activeReturn = existingReturns.find(
      (r) => r.status === OmsReturnStatus.requested || r.status === OmsReturnStatus.approved,
    );

    if (activeReturn) {
      await this.runConfirmPipeline(activeReturn.id, activeReturn.status, user);
      return {
        ok: true,
        action: 'confirmed',
        returnId: activeReturn.id,
        returnNumber: activeReturn.returnNumber,
        orderNumber: matchedOrder.orderNumber,
        clientName: matchedOrder.company?.name ?? '—',
        message: 'تم استلام وتأكيد المرتجع بنجاح.',
      };
    }

    // If all existing returns are completed
    if (
      existingReturns.length > 0 &&
      existingReturns.every((r) => r.status === OmsReturnStatus.completed)
    ) {
      if (matchedOrder.status !== OmsOrderStatus.returned) {
        await this.prisma.omsOrder.update({
          where: { id: matchedOrder.id },
          data: { status: OmsOrderStatus.returned },
        });
      }
      return {
        ok: true,
        action: 'already_completed',
        returnId: existingReturns[0].id,
        returnNumber: existingReturns[0].returnNumber,
        orderNumber: matchedOrder.orderNumber,
        clientName: matchedOrder.company?.name ?? '—',
        message: 'تم استلام هذا الطلب وإرجاعه للمستودع مسبقاً.',
      };
    }

    // If no existing return, verify order eligibility
    if (!isOmsReturnEligibleStatus(matchedOrder.status)) {
      throw new BadRequestException(
        `لا يمكن إرجاع هذا الطلب لأن حالته الحالية (${matchedOrder.status}) غير مؤهلة للإرجاع. ${expressReturnStatusRejectReason(matchedOrder.status)}`,
      );
    }

    // Calculate returnable lines
    const priorReturned = await this.sumActiveReturnedQtyByProduct(matchedOrder.id);
    const returnLines: Array<{ productId: string; quantity: number }> = [];

    for (const ol of matchedOrder.lines) {
      const already = priorReturned.get(ol.productId) ?? new Prisma.Decimal(0);
      const returnable = Number(ol.requestedQuantity.sub(already));
      if (returnable > 0) {
        returnLines.push({ productId: ol.productId, quantity: returnable });
      }
    }

    if (returnLines.length === 0) {
      if (matchedOrder.status !== OmsOrderStatus.returned) {
        await this.prisma.omsOrder.update({
          where: { id: matchedOrder.id },
          data: { status: OmsOrderStatus.returned },
        });
      }
      return {
        ok: true,
        action: 'already_completed',
        orderNumber: matchedOrder.orderNumber,
        clientName: matchedOrder.company?.name ?? '—',
        message: 'كامل بنود وكميات هذا الطلب تم إرجاعها مسبقاً.',
      };
    }

    // Create the return
    const createdReturn = await this.create(user, {
      omsOrderId: matchedOrder.id,
      lines: returnLines,
      reason: 'استرجاع فوري عبر مسح QR بوليصة الشحن',
    });

    // Confirm and restock immediately
    await this.confirmReturn(createdReturn.id, user);

    return {
      ok: true,
      action: 'created_and_confirmed',
      returnId: createdReturn.id,
      returnNumber: createdReturn.returnNumber,
      orderNumber: matchedOrder.orderNumber,
      clientName: matchedOrder.company?.name ?? '—',
      message: 'تم إنشاء المرتجع وتأكيد استلامه في المستودع بنجاح.',
    };
  }

  /**
   * Resolves the default execution plan for a return using the default receiving dock
   * and the canonical "Returns" warehouse storage location.
   * Ensures lines are present (falling back to omsOrder.lines if empty).
   */
  private async resolveDefaultReturnExecutionPlan(
    omsReturn: {
      id: string;
      omsOrderId: string;
      lines: Array<{ id: string; productId: string; quantity: Prisma.Decimal | number }>;
      omsOrder?: {
        id: string;
        outboundOrderId: string | null;
        lines?: Array<{ productId: string; requestedQuantity: Prisma.Decimal }>;
      } | null;
    },
    warehouseIdCandidate?: string,
  ): Promise<{ warehouseId: string; plan: InboundExecutionPlan }> {
    const outboundId = omsReturn.omsOrder?.outboundOrderId;
    let warehouseId = warehouseIdCandidate;

    if (!warehouseId && outboundId) {
      warehouseId = (
        await this.prisma.stockReservation.findFirst({
          where: { outboundOrderId: outboundId },
          orderBy: { createdAt: 'desc' },
          select: { location: { select: { warehouseId: true } } },
        })
      )?.location.warehouseId;
    }

    if (!warehouseId && outboundId) {
      const ob = await this.prisma.outboundOrder.findUnique({
        where: { id: outboundId },
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

    if (!warehouseId) {
      throw new BadRequestException('No active warehouse found to process return.');
    }

    // Find the "Returns" location in the warehouse
    let returnsLocation = await this.prisma.location.findFirst({
      where: {
        warehouseId,
        name: { equals: 'Returns', mode: 'insensitive' },
        status: 'active',
      },
      select: { id: true },
    });

    if (!returnsLocation) {
      returnsLocation = await this.prisma.location.findFirst({
        where: {
          warehouseId,
          name: { contains: 'return', mode: 'insensitive' },
          status: 'active',
        },
        select: { id: true },
      });
    }

    if (!returnsLocation) {
      returnsLocation = await this.prisma.location.findFirst({
        where: {
          warehouseId,
          type: 'internal',
          status: 'active',
        },
        select: { id: true },
      });
    }

    // Find a receiving dock (input location) in the warehouse
    let receivingDock = await this.prisma.location.findFirst({
      where: { warehouseId, type: 'input', status: 'active' },
      select: { id: true },
    });

    if (!receivingDock) {
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

    const defaultDockId = receivingDock?.id ?? returnsLocation?.id;
    const defaultPutawayId = returnsLocation?.id ?? receivingDock?.id;

    if (!defaultDockId || !defaultPutawayId) {
      throw new BadRequestException(
        'Warehouse location configuration error: neither receiving dock nor Returns storage location found.',
      );
    }

    // Make sure return lines exist (repair empty return if needed)
    let returnLines = omsReturn.lines;
    if (returnLines.length === 0 && omsReturn.omsOrderId) {
      const orderLines = await this.prisma.omsOrderLine.findMany({
        where: { omsOrderId: omsReturn.omsOrderId },
      });
      const createdLines = [];
      for (let idx = 0; idx < orderLines.length; idx++) {
        const ol = orderLines[idx];
        const qty = ol.requestedQuantity;
        const lineTotal = ol.unitPrice != null ? ol.unitPrice.mul(qty) : null;
        const nl = await this.prisma.omsReturnLine.create({
          data: {
            omsReturnId: omsReturn.id,
            productId: ol.productId,
            quantity: qty,
            unitPrice: ol.unitPrice ?? undefined,
            lineTotal: lineTotal ?? undefined,
            lineNumber: idx + 1,
          },
        });
        createdLines.push(nl);
      }
      returnLines = createdLines;
    }

    const plan: InboundExecutionPlan = {
      warehouseId,
      receivingDockId: defaultDockId,
      planUpdatedAt: new Date().toISOString(),
      lines: returnLines.map((l) => ({
        productId: l.productId,
        orderLineId: l.id,
        expectedQty: Number(l.quantity),
        putaway: [{ locationId: defaultPutawayId, qty: Number(l.quantity) }],
      })),
    };

    return { warehouseId, plan };
  }

  /**
   * Automatically approve, receive, and putaway a return using the canonical
   * default receiving dock and "returns" warehouse location.
   * This eliminates manual plan/approval steps when confirming a return.
   */
  private async autoCompleteReturn(returnId: string, user: AuthPrincipal): Promise<void> {
    const omsReturn = await this.prisma.omsReturn.findUnique({
      where: { id: returnId },
      include: {
        ...INCLUDE,
        omsOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            outboundOrderId: true,
            lines: { select: { productId: true, requestedQuantity: true } },
          },
        },
      },
    });
    if (!omsReturn || omsReturn.status !== OmsReturnStatus.requested) return;

    const isCovered = await this.isOrderFullyReturnedByCompletedReturns(omsReturn.omsOrderId);
    if (isCovered) {
      await withTenantRls(this.prisma, user, async (tx) => {
        await tx.omsReturn.update({
          where: { id: returnId },
          data: {
            status: OmsReturnStatus.completed,
            completedAt: new Date(),
            approvedAt: new Date(),
            approvedBy: user.id,
            notes:
              (omsReturn.notes ? omsReturn.notes + '\n' : '') +
              'Automatically resolved: Order was already fully received and restocked by prior completed return(s).',
          },
        });
      });
      await this.maybeMarkOmsFullyReturned(user, omsReturn.omsOrderId);
      return;
    }

    const { warehouseId, plan } = await this.resolveDefaultReturnExecutionPlan(omsReturn);

    // Save plan
    await this.updatePlan(returnId, user, {
      executionPlan: plan as unknown as Record<string, unknown>,
      executionMode: 'admin',
    });

    // Approve
    await this.approve(returnId, user, { warehouseId });

    // Complete receiving
    try {
      await this.completeReceivingAdmin(returnId, user);
    } catch {
      // Ignore if receiving was already completed
    }

    // Complete putaway
    await this.completePutawayAdmin(returnId, user);
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

    let plan = parseInboundExecutionPlan(existing.executionPlan);
    let warehouseId = dto.warehouseId ?? plan?.warehouseId;

    if (!plan || plan.lines.length === 0 || !warehouseId) {
      const resolved = await this.resolveDefaultReturnExecutionPlan(existing, warehouseId);
      warehouseId = resolved.warehouseId;
      plan = resolved.plan;
      await this.updatePlan(id, user, {
        executionPlan: plan as unknown as Record<string, unknown>,
        executionMode: 'admin',
      });
    }
    assertInboundAdminPlanComplete(plan);

    const isCovered = await this.isOrderFullyReturnedByCompletedReturns(existing.omsOrderId);
    if (isCovered) {
      await withTenantRls(this.prisma, user, async (tx) => {
        await tx.omsReturn.update({
          where: { id },
          data: {
            status: OmsReturnStatus.completed,
            completedAt: new Date(),
            approvedAt: new Date(),
            approvedBy: user.id,
            notes:
              (existing.notes ? existing.notes + '\n' : '') +
              'Automatically resolved: Order was already fully received and restocked by prior completed return(s).',
          },
        });
      });
      await this.maybeMarkOmsFullyReturned(user, existing.omsOrderId);
      return this.findById(id, user);
    }

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

    warehouseId =
      warehouseId ??
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
    assertOmsOrderUuid(omsOrderId);
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

  private async isOrderFullyReturnedByCompletedReturns(omsOrderId: string): Promise<boolean> {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: { lines: true },
    });
    if (!order || order.lines.length === 0) return false;

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
      if (ret.lessThan(ol.requestedQuantity)) return false;
    }
    return true;
  }

  private async maybeMarkOmsFullyReturned(
    user: AuthPrincipal,
    omsOrderId: string,
  ): Promise<void> {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: { lines: true },
    });
    if (!order || !isOmsReturnEligibleStatus(order.status)) return;

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

  /**
   * Normal Return preview — resolve order reference and returnable lines.
   * Does not change Express Return behavior.
   */
  async previewNormalReturn(user: AuthPrincipal, dto: PreviewOmsReturnDto) {
    const resolved = await resolveExpressReturnOrder(this.prisma, dto.orderReference, {
      lines: {
        include: { product: { select: { id: true, name: true, sku: true, uom: true } } },
        orderBy: { lineNumber: 'asc' },
      },
    });
    if (!resolved.ok) {
      throw new NotFoundException(resolved.error);
    }
    const order = resolved.order;
    this.companyAccess.validateResourceOwnership(user, order);

    if (!isOmsReturnEligibleStatus(order.status)) {
      throw new InvalidStateException(expressReturnStatusRejectReason(order.status));
    }

    const priorReturned = await this.sumActiveReturnedQtyByProduct(order.id);
    const lines = (order.lines as Array<{
      productId: string;
      requestedQuantity: Prisma.Decimal;
      product?: { id: string; name: string; sku: string; uom?: string } | null;
    }>).map((ol) => {
      const ordered = Number(ol.requestedQuantity);
      const alreadyReturned = Number(priorReturned.get(ol.productId) ?? 0);
      const returnable = Math.max(0, ordered - alreadyReturned);
      return {
        productId: ol.productId,
        sku: ol.product?.sku ?? '',
        name: ol.product?.name ?? '',
        uom: ol.product?.uom ?? undefined,
        ordered,
        alreadyReturned,
        returnable,
      };
    });

    return {
      omsOrderId: order.id as string,
      orderNumber: order.orderNumber as string,
      clientReference: (order.clientReference as string | null) ?? null,
      matchedBy: resolved.matchedBy,
      lines,
    };
  }

  /**
   * Normal Return CSV validate-only (no create).
   * Same pipeline as import through aggregate + returnable check.
   */
  async validateNormalReturnImport(user: AuthPrincipal, dto: ImportOmsReturnsDto) {
    return this.prepareNormalReturnImport(user, dto);
  }

  /**
   * Normal Return CSV/bulk import (create after prepare).
   * Prefer validate + modal Confirm; this remains for direct create callers.
   */
  async importNormalReturns(user: AuthPrincipal, dto: ImportOmsReturnsDto) {
    const prepared = await this.prepareNormalReturnImport(user, dto);
    const created: Array<{
      omsOrderId: string;
      orderNumber: string;
      returnId: string;
      returnNumber: string;
    }> = [];
    const failed = [...prepared.failed];

    for (const orderReady of prepared.ready) {
      const lines = orderReady.lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({ productId: l.productId, quantity: l.quantity }));
      if (lines.length === 0) continue;
      try {
        const result = await this.create(user, {
          omsOrderId: orderReady.omsOrderId,
          reason: dto.reason,
          lines,
        });
        created.push({
          omsOrderId: orderReady.omsOrderId,
          orderNumber: orderReady.orderNumber,
          returnId: result.id,
          returnNumber: result.returnNumber,
        });
      } catch (err: any) {
        for (const line of orderReady.lines.filter((l) => l.quantity > 0)) {
          failed.push({
            order_reference: orderReady.orderNumber,
            product_reference: line.sku || line.productId,
            quantity: line.quantity,
            reason: err?.message ?? 'Failed to create return',
          });
        }
      }
    }

    return { created, failed };
  }

  /**
   * Shared Normal CSV pipeline: resolve → validate → aggregate → returnable check.
   * Does not create returns.
   */
  private async prepareNormalReturnImport(
    user: AuthPrincipal,
    dto: ImportOmsReturnsDto,
  ): Promise<{
    ready: Array<{
      omsOrderId: string;
      orderNumber: string;
      clientReference: string | null;
      lines: Array<{
        productId: string;
        sku: string;
        name: string;
        uom?: string;
        ordered: number;
        alreadyReturned: number;
        returnable: number;
        quantity: number;
      }>;
    }>;
    failed: Array<{
      order_reference: string;
      product_reference: string;
      quantity: number;
      reason: string;
    }>;
  }> {
    type FailedRow = {
      order_reference: string;
      product_reference: string;
      quantity: number;
      reason: string;
    };

    const failed: FailedRow[] = [];
    const resolvedReady: Array<{
      omsOrderId: string;
      productId: string;
      quantity: number;
      source: NormalReturnImportRow;
    }> = [];

    const orderCache = new Map<
      string,
      {
        id: string;
        orderNumber: string;
        clientReference: string | null;
        status: OmsOrderStatus;
        companyId: string;
        lines: Array<{
          productId: string;
          requestedQuantity: Prisma.Decimal;
          product?: { id: string; sku: string; name: string; uom?: string } | null;
        }>;
        priorReturned: Map<string, Prisma.Decimal>;
      }
    >();

    const resolveOrderCached = async (orderReference: string) => {
      const key = orderReference.trim().toLowerCase();
      const hit = orderCache.get(key);
      if (hit) return { ok: true as const, order: hit };

      const resolved = await resolveExpressReturnOrder(this.prisma, orderReference, {
        lines: {
          include: { product: { select: { id: true, name: true, sku: true, uom: true } } },
          orderBy: { lineNumber: 'asc' },
        },
      });
      if (!resolved.ok) return { ok: false as const, error: resolved.error };

      const order = resolved.order;
      this.companyAccess.validateResourceOwnership(user, order);
      const priorReturned = await this.sumActiveReturnedQtyByProduct(order.id);
      const cached = {
        id: order.id as string,
        orderNumber: order.orderNumber as string,
        clientReference: (order.clientReference as string | null) ?? null,
        status: order.status as OmsOrderStatus,
        companyId: order.companyId as string,
        lines: order.lines as Array<{
          productId: string;
          requestedQuantity: Prisma.Decimal;
          product?: { id: string; sku: string; name: string; uom?: string } | null;
        }>,
        priorReturned,
      };
      orderCache.set(key, cached);
      orderCache.set(cached.id.toLowerCase(), cached);
      return { ok: true as const, order: cached };
    };

    for (let i = 0; i < dto.rows.length; i++) {
      const raw = dto.rows[i];
      const source: NormalReturnImportRow = {
        orderReference: String(raw.orderReference ?? '').trim(),
        productReference: String(raw.productReference ?? '').trim(),
        quantity: Number(raw.quantity),
        rowIndex: i,
      };

      const pushFail = (reason: string) => {
        failed.push({
          order_reference: source.orderReference,
          product_reference: source.productReference,
          quantity: Number.isFinite(source.quantity) ? source.quantity : 0,
          reason,
        });
      };

      if (!source.orderReference) {
        pushFail('Order not found.');
        continue;
      }
      if (!source.productReference) {
        pushFail('Product not found in order');
        continue;
      }
      if (!Number.isFinite(source.quantity) || source.quantity <= 0) {
        pushFail('Quantity must be greater than 0');
        continue;
      }

      let orderResult: Awaited<ReturnType<typeof resolveOrderCached>>;
      try {
        orderResult = await resolveOrderCached(source.orderReference);
      } catch (err: any) {
        pushFail(err?.message ?? 'Order access denied');
        continue;
      }
      if (!orderResult.ok) {
        pushFail(orderResult.error === 'Order not found.' ? 'Order not found' : orderResult.error);
        continue;
      }

      const order = orderResult.order;
      if (!isOmsReturnEligibleStatus(order.status)) {
        pushFail(expressReturnStatusRejectReason(order.status));
        continue;
      }

      const line = resolveProductOnOrderLines(order.lines, source.productReference);
      if (!line) {
        pushFail('Product not found in order');
        continue;
      }

      resolvedReady.push({
        omsOrderId: order.id,
        productId: line.productId,
        quantity: source.quantity,
        source,
      });
    }

    const aggregates = aggregateNormalReturnRows(resolvedReady);
    /** omsOrderId → productId → aggregated qty (only lines that passed returnable check) */
    const acceptedQty = new Map<string, Map<string, number>>();
    const acceptedOrderIds = new Set<string>();

    for (const agg of aggregates) {
      const order =
        [...orderCache.values()].find((o) => o.id === agg.omsOrderId) ?? null;
      if (!order) {
        for (const src of agg.sourceRows) {
          failed.push({
            order_reference: src.orderReference,
            product_reference: src.productReference,
            quantity: src.quantity,
            reason: 'Order not found',
          });
        }
        continue;
      }

      const orderLine = order.lines.find((l) => l.productId === agg.productId);
      const ordered = Number(orderLine?.requestedQuantity ?? 0);
      const already = Number(order.priorReturned.get(agg.productId) ?? 0);
      const returnable = Math.max(0, ordered - already);

      if (agg.quantity > returnable) {
        for (const src of agg.sourceRows) {
          failed.push({
            order_reference: src.orderReference,
            product_reference: src.productReference,
            quantity: src.quantity,
            reason: 'Requested quantity exceeds returnable quantity',
          });
        }
        continue;
      }

      acceptedOrderIds.add(order.id);
      const byProduct = acceptedQty.get(order.id) ?? new Map<string, number>();
      byProduct.set(agg.productId, agg.quantity);
      acceptedQty.set(order.id, byProduct);
    }

    const ready: Array<{
      omsOrderId: string;
      orderNumber: string;
      clientReference: string | null;
      lines: Array<{
        productId: string;
        sku: string;
        name: string;
        uom?: string;
        ordered: number;
        alreadyReturned: number;
        returnable: number;
        quantity: number;
      }>;
    }> = [];

    // Unique orders by id (cache may have duplicate entries under different keys).
    const uniqueOrders = new Map<string, {
      id: string;
      orderNumber: string;
      clientReference: string | null;
      status: OmsOrderStatus;
      companyId: string;
      lines: Array<{
        productId: string;
        requestedQuantity: Prisma.Decimal;
        product?: { id: string; sku: string; name: string; uom?: string } | null;
      }>;
      priorReturned: Map<string, Prisma.Decimal>;
    }>();
    for (const order of orderCache.values()) {
      uniqueOrders.set(order.id, order);
    }

    for (const orderId of acceptedOrderIds) {
      const order = uniqueOrders.get(orderId);
      if (!order) continue;
      const qtyMap = acceptedQty.get(order.id) ?? new Map();
      ready.push({
        omsOrderId: order.id,
        orderNumber: order.orderNumber,
        clientReference: order.clientReference,
        lines: order.lines.map((ol) => {
          const ordered = Number(ol.requestedQuantity);
          const alreadyReturned = Number(order.priorReturned.get(ol.productId) ?? 0);
          const returnable = Math.max(0, ordered - alreadyReturned);
          return {
            productId: ol.productId,
            sku: ol.product?.sku ?? '',
            name: ol.product?.name ?? '',
            uom: ol.product?.uom ?? undefined,
            ordered,
            alreadyReturned,
            returnable,
            quantity: qtyMap.get(ol.productId) ?? 0,
          };
        }),
      });
    }

    return { ready, failed };
  }

  async expressReturn(
    user: AuthPrincipal,
    dto: { omsOrderIds: string[]; reason?: string },
  ): Promise<{
    created: Array<{ omsOrderId: string; orderNumber: string; returnId: string; returnNumber: string }>;
    failed: Array<{
      omsOrderId: string;
      input?: string;
      orderNumber?: string;
      clientReference?: string | null;
      error: string;
    }>;
  }> {
    const uniqueInputs = dedupeExpressReturnInputs(dto.omsOrderIds).slice(0, 200);
    const created: Array<{
      omsOrderId: string;
      orderNumber: string;
      returnId: string;
      returnNumber: string;
    }> = [];
    const failed: Array<{
      omsOrderId: string;
      input?: string;
      orderNumber?: string;
      clientReference?: string | null;
      error: string;
    }> = [];
    const seenOrderIds = new Set<string>();

    for (const input of uniqueInputs) {
      try {
        const resolved = await resolveExpressReturnOrder(this.prisma, input, {
          lines: true,
        });
        if (!resolved.ok) {
          failed.push({ omsOrderId: input, input, error: resolved.error });
          continue;
        }
        const order = resolved.order;
        if (seenOrderIds.has(order.id)) {
          continue;
        }
        seenOrderIds.add(order.id);

        this.companyAccess.validateResourceOwnership(user, order);

        if (!isOmsReturnEligibleStatus(order.status)) {
          failed.push({
            omsOrderId: order.id,
            input,
            orderNumber: order.orderNumber,
            clientReference: order.clientReference,
            error: expressReturnStatusRejectReason(order.status),
          });
          continue;
        }

        const priorReturned = await this.sumActiveReturnedQtyByProduct(order.id);
        const lines: Array<{ productId: string; quantity: number }> = [];

        for (const ol of order.lines) {
          const already = priorReturned.get(ol.productId) ?? new Prisma.Decimal(0);
          const returnable = Number(ol.requestedQuantity.sub(already));
          if (returnable > 0) {
            lines.push({ productId: ol.productId, quantity: returnable });
          }
        }

        if (lines.length === 0) {
          failed.push({
            omsOrderId: order.id,
            input,
            orderNumber: order.orderNumber,
            clientReference: order.clientReference,
            error: 'Order is already fully returned',
          });
          continue;
        }

        const result = await this.create(user, {
          omsOrderId: order.id,
          lines,
          reason: dto.reason,
        });

        created.push({
          omsOrderId: order.id,
          orderNumber: order.orderNumber,
          returnId: result.id,
          returnNumber: result.returnNumber,
        });
      } catch (err: any) {
        failed.push({
          omsOrderId: input,
          input,
          error: err?.message ?? 'Unknown error',
        });
      }
    }

    return { created, failed };
  }

  async validateOrdersForExpressReturn(
    user: AuthPrincipal,
    dto: { omsOrderIds: string[] },
  ): Promise<
    Array<{
      input: string;
      omsOrderId: string;
      orderNumber: string;
      clientReference: string | null;
      matchedBy?: 'id' | 'orderNumber' | 'clientReference';
      eligible: boolean;
      error?: string;
      lines?: Array<{
        productId: string;
        productName: string;
        productSku: string;
        ordered: number;
        alreadyReturned: number;
        returnable: number;
      }>;
    }>
  > {
    const uniqueInputs = dedupeExpressReturnInputs(dto.omsOrderIds).slice(0, 200);
    const results: Array<{
      input: string;
      omsOrderId: string;
      orderNumber: string;
      clientReference: string | null;
      matchedBy?: 'id' | 'orderNumber' | 'clientReference';
      eligible: boolean;
      error?: string;
      lines?: Array<{
        productId: string;
        productName: string;
        productSku: string;
        ordered: number;
        alreadyReturned: number;
        returnable: number;
      }>;
    }> = [];
    const seenOrderIds = new Set<string>();

    const lineInclude = {
      lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
    };

    for (const input of uniqueInputs) {
      try {
        const resolved = await resolveExpressReturnOrder(this.prisma, input, lineInclude);
        if (!resolved.ok) {
          results.push({
            input,
            omsOrderId: '',
            orderNumber: '',
            clientReference: null,
            eligible: false,
            error: resolved.error,
          });
          continue;
        }

        const order = resolved.order;
        if (seenOrderIds.has(order.id)) {
          results.push({
            input,
            omsOrderId: order.id,
            orderNumber: order.orderNumber,
            clientReference: order.clientReference,
            matchedBy: resolved.matchedBy,
            eligible: false,
            error: 'Duplicate of another resolved OMS order in this request',
          });
          continue;
        }
        seenOrderIds.add(order.id);

        this.companyAccess.validateResourceOwnership(user, order);

        if (!isOmsReturnEligibleStatus(order.status)) {
          results.push({
            input,
            omsOrderId: order.id,
            orderNumber: order.orderNumber,
            clientReference: order.clientReference,
            matchedBy: resolved.matchedBy,
            eligible: false,
            error: expressReturnStatusRejectReason(order.status),
          });
          continue;
        }

        const priorReturned = await this.sumActiveReturnedQtyByProduct(order.id);
        const lines: Array<{
          productId: string;
          productName: string;
          productSku: string;
          ordered: number;
          alreadyReturned: number;
          returnable: number;
        }> = [];

        for (const ol of order.lines) {
          const already = priorReturned.get(ol.productId) ?? new Prisma.Decimal(0);
          const ordered = Number(ol.requestedQuantity);
          const alreadyNum = Number(already);
          const returnable = ordered - alreadyNum;
          lines.push({
            productId: ol.productId,
            productName: ol.product?.name ?? '',
            productSku: ol.product?.sku ?? '',
            ordered,
            alreadyReturned: alreadyNum,
            returnable: Math.max(returnable, 0),
          });
        }

        const hasReturnable = lines.some((l) => l.returnable > 0);
        results.push({
          input,
          omsOrderId: order.id,
          orderNumber: order.orderNumber,
          clientReference: order.clientReference,
          matchedBy: resolved.matchedBy,
          eligible: hasReturnable,
          error: hasReturnable ? undefined : 'Order is already fully returned',
          lines,
        });
      } catch (err: any) {
        results.push({
          input,
          omsOrderId: '',
          orderNumber: '',
          clientReference: null,
          eligible: false,
          error: err?.message ?? 'Unknown error',
        });
      }
    }

    return results;
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
