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
} from './dto/oms-return.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmptyToUndefined } from '../../common/transformers/query-transform';
import { IsOptional, IsEnum } from 'class-validator';
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
    select: { id: true, orderNumber: true, status: true },
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
        },
      },
    },
  },
} satisfies Prisma.OmsReturnInclude;

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
    } | null;
  }>;
}) {
  return {
    ...row,
    lines: row.lines.map((l) => ({
      ...l,
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice?.toString() ?? null,
      lineTotal: l.lineTotal?.toString() ?? null,
    })),
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
      if (new Prisma.Decimal(line.quantity).greaterThan(orderLine.requestedQuantity)) {
        throw new BadRequestException(
          `Return qty for ${p.sku} exceeds ordered quantity.`,
        );
      }
      resolvedLines.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lotId,
      });
    }

    const seq = await this.prisma.omsReturn.count({
      where: { companyId: order.companyId },
    });
    const returnNumber = `OR-${String(seq + 1).padStart(6, '0')}`;

    const created = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsReturn.create({
        data: {
          companyId: order.companyId,
          omsOrderId: order.id,
          returnNumber,
          status: OmsReturnStatus.requested,
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
          payload: { omsReturnId: row.id, returnNumber },
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

  async approve(id: string, user: AuthPrincipal, dto: ApproveOmsReturnDto = {}) {
    const existing = await this.prisma.omsReturn.findUnique({
      where: { id },
      include: { ...INCLUDE, omsOrder: true },
    });
    if (!existing) throw new NotFoundException('OMS return not found.');
    this.companyAccess.validateResourceOwnership(user, existing);

    if (
      existing.status === OmsReturnStatus.approved &&
      existing.warehouseReturnId
    ) {
      const wh = await this.prisma.returnOrder.findUnique({
        where: { id: existing.warehouseReturnId },
        select: { status: true },
      });
      if (wh && wh.status !== 'completed') {
        await this.warehouseReturns.finalizeAfterOmsApproval(
          user,
          existing.warehouseReturnId,
        );
      } else if (wh?.status === 'completed') {
        await this.onWarehouseReturnCompleted(user, existing.warehouseReturnId);
      }
      return this.findById(id, user);
    }

    if (existing.status === OmsReturnStatus.completed) {
      return this.findById(id, user);
    }

    if (existing.status !== OmsReturnStatus.requested) {
      throw new InvalidStateException(
        `Only requested returns can be approved (current: ${existing.status}).`,
      );
    }

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
      (
        await this.prisma.stockReservation.findFirst({
          where: { outboundOrderId: outboundId },
          orderBy: { createdAt: 'desc' },
          select: { location: { select: { warehouseId: true } } },
        })
      )?.location.warehouseId;

    if (!warehouseId) {
      throw new BadRequestException(
        'Cannot resolve warehouse for return restock. Provide warehouseId on approve.',
      );
    }

    const whReturn = await this.warehouseReturns.create(user, {
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

    await withTenantRls(this.prisma, user, async (tx) => {
      await tx.omsReturn.update({
        where: { id },
        data: {
          status: OmsReturnStatus.approved,
          warehouseReturnId: whReturn.id,
          approvedAt: new Date(),
          approvedBy: user.id,
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

    // Restock + ledger + complete WH return (COD adjustment on complete).
    await this.warehouseReturns.finalizeAfterOmsApproval(user, whReturn.id);

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

    if (amount.isZero()) return;

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
