import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CodGenerationStatus,
  CodRecordStatus,
  OmsOrderStatus,
  Prisma,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { CreateCodAdjustmentDto } from './dto/cod.dto';
import { ListCodRecordsQueryDto } from './dto/list-cod-records-query.dto';
import { RealtimeService } from '../realtime/realtime.service';

const INCLUDE = {
  company: { select: { id: true, name: true } },
  omsOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      recipientName: true,
      paymentMethod: true,
    },
  },
  adjustments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.CodRecordInclude;

function serialize(record: {
  id: string;
  companyId: string;
  omsOrderId: string;
  originalAmount: Prisma.Decimal;
  currency: string;
  status: CodRecordStatus;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  availableAt: Date | null;
  paidOutAt: Date | null;
  company?: { id: string; name: string } | null;
  omsOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    recipientName: string | null;
    paymentMethod: string | null;
  } | null;
  adjustments: Array<{
    id: string;
    amount: Prisma.Decimal;
    reason: string | null;
    omsReturnId: string | null;
    createdAt: Date;
    createdBy: string;
  }>;
}) {
  const adjustmentSum = record.adjustments.reduce(
    (s, a) => s.add(a.amount),
    new Prisma.Decimal(0),
  );
  const currentAmount = record.originalAmount.add(adjustmentSum);
  return {
    id: record.id,
    companyId: record.companyId,
    company: record.company ?? null,
    omsOrderId: record.omsOrderId,
    omsOrder: record.omsOrder ?? null,
    originalAmount: record.originalAmount.toString(),
    currentAmount: currentAmount.toString(),
    currency: record.currency,
    status: record.status,
    notes: record.notes,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    availableAt: record.availableAt,
    paidOutAt: record.paidOutAt,
    adjustments: record.adjustments.map((a) => ({
      id: a.id,
      amount: a.amount.toString(),
      reason: a.reason,
      omsReturnId: a.omsReturnId,
      createdAt: a.createdAt,
      createdBy: a.createdBy,
    })),
  };
}

@Injectable()
export class CodRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  private async recordEvent(
    tx: Prisma.TransactionClient,
    params: {
      omsOrderId: string;
      companyId: string;
      eventType: string;
      createdBy: string;
      payload?: Record<string, unknown>;
    },
  ) {
    await tx.omsOrderEvent.create({
      data: {
        omsOrderId: params.omsOrderId,
        companyId: params.companyId,
        eventType: params.eventType,
        createdBy: params.createdBy,
        payload: params.payload as never,
      },
    });
  }

  async list(user: AuthPrincipal, query: ListCodRecordsQueryDto) {
    const where: Prisma.CodRecordWhereInput = {};
    const companyId = readCompanyIdCatalogFilter(
      this.companyAccess,
      user,
      query.companyId,
    );
    if (companyId) where.companyId = companyId;
    if (query.status) where.status = query.status;
    if (query.omsOrderId) where.omsOrderId = query.omsOrderId;

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.codRecord.findMany({
          where,
          include: INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
        }),
        tx.codRecord.count({ where }),
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
    const record = await withTenantRls(this.prisma, user, async (tx) =>
      tx.codRecord.findUnique({ where: { id }, include: INCLUDE }),
    );
    if (!record) throw new NotFoundException('COD record not found.');
    this.companyAccess.validateResourceOwnership(user, record);
    return serialize(record);
  }

  async findByOmsOrder(omsOrderId: string, user: AuthPrincipal) {
    const record = await withTenantRls(this.prisma, user, async (tx) =>
      tx.codRecord.findUnique({
        where: { omsOrderId },
        include: INCLUDE,
      }),
    );
    if (!record) return null;
    this.companyAccess.validateResourceOwnership(user, record);
    return serialize(record);
  }

  /**
   * Idempotent COD creation on Delivered. Unique on omsOrderId.
   * Non-COD orders: marks generation none and returns null.
   */
  async generateForDeliveredOrder(user: AuthPrincipal, omsOrderId: string) {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
    });
    if (!order) throw new NotFoundException('OMS order not found.');
    this.companyAccess.validateResourceOwnership(user, order);

    if (order.status !== OmsOrderStatus.delivered) {
      throw new InvalidStateException('COD is only generated for Delivered orders.');
    }

    if (order.paymentMethod !== 'COD') {
      await this.prisma.omsOrder.update({
        where: { id: omsOrderId },
        data: { codGenerationStatus: CodGenerationStatus.none },
      });
      return null;
    }

    const existing = await this.prisma.codRecord.findUnique({
      where: { omsOrderId },
      include: INCLUDE,
    });
    if (existing) {
      await this.prisma.omsOrder.update({
        where: { id: omsOrderId },
        data: { codGenerationStatus: CodGenerationStatus.ok },
      });
      return serialize(existing);
    }

    const amount = order.codAmount ?? order.subtotal ?? new Prisma.Decimal(0);
    if (amount.isZero()) {
      throw new BadRequestException('COD amount is zero; cannot generate COD record.');
    }

    try {
      const created = await withTenantRls(this.prisma, user, async (tx) => {
        const row = await tx.codRecord.create({
          data: {
            companyId: order.companyId,
            omsOrderId: order.id,
            originalAmount: amount,
            currency: order.currency ?? 'USD',
            status: CodRecordStatus.pending,
            createdBy: user.id,
          },
          include: INCLUDE,
        });
        await tx.omsOrder.update({
          where: { id: omsOrderId },
          data: {
            codGenerationStatus: CodGenerationStatus.ok,
            codStatus: 'pending',
          },
        });
        await this.recordEvent(tx, {
          omsOrderId,
          companyId: order.companyId,
          eventType: 'cod.generated',
          createdBy: user.id,
          payload: { codRecordId: row.id, originalAmount: amount.toString() },
        });
        return row;
      });
      return serialize(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const again = await this.prisma.codRecord.findUnique({
          where: { omsOrderId },
          include: INCLUDE,
        });
        if (again) {
          await this.prisma.omsOrder.update({
            where: { id: omsOrderId },
            data: { codGenerationStatus: CodGenerationStatus.ok },
          });
          return serialize(again);
        }
      }
      await this.prisma.omsOrder.update({
        where: { id: omsOrderId },
        data: { codGenerationStatus: CodGenerationStatus.failed },
      });
      throw err;
    }
  }

  async retryGeneration(omsOrderId: string, user: AuthPrincipal) {
    return this.generateForDeliveredOrder(user, omsOrderId);
  }

  async setStatus(id: string, user: AuthPrincipal, status: CodRecordStatus) {
    const existing = await this.prisma.codRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('COD record not found.');
    this.companyAccess.validateResourceOwnership(user, existing);

    if (existing.status === status) {
      const full = await this.prisma.codRecord.findUnique({
        where: { id },
        include: INCLUDE,
      });
      return serialize(full!);
    }

    const transitions: Record<CodRecordStatus, CodRecordStatus[]> = {
      pending: ['available'],
      available: ['paid_out'],
      paid_out: [],
    };
    if (!transitions[existing.status].includes(status)) {
      throw new InvalidStateException(
        `Cannot change COD status from ${existing.status} to ${status}.`,
      );
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.codRecord.update({
        where: { id },
        data: {
          status,
          availableAt: status === 'available' ? new Date() : undefined,
          paidOutAt: status === 'paid_out' ? new Date() : undefined,
        },
        include: INCLUDE,
      });
      await this.recordEvent(tx, {
        omsOrderId: row.omsOrderId,
        companyId: row.companyId,
        eventType: 'cod.status_changed',
        createdBy: user.id,
        payload: { from: existing.status, to: status, codRecordId: id },
      });
      if (status === 'available') {
        await tx.omsOrder.update({
          where: { id: row.omsOrderId },
          data: { codStatus: 'collected', codCollectedAt: new Date() },
        });
      }
      if (status === 'paid_out') {
        await tx.omsOrder.update({
          where: { id: row.omsOrderId },
          data: { codStatus: 'remitted', codRemittedAt: new Date() },
        });
      }
      return row;
    });

    this.realtime.emitCodUpdated(updated.companyId, {
      orderId: updated.omsOrderId,
      codRecordId: updated.id,
      status,
    });
    return serialize(updated);
  }

  async addManualAdjustment(
    id: string,
    user: AuthPrincipal,
    dto: CreateCodAdjustmentDto,
  ) {
    const existing = await this.prisma.codRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('COD record not found.');
    this.companyAccess.validateResourceOwnership(user, existing);
    if (existing.status === CodRecordStatus.paid_out) {
      throw new InvalidStateException('Cannot adjust a paid-out COD record.');
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      await tx.codAdjustment.create({
        data: {
          codRecordId: id,
          amount: new Prisma.Decimal(dto.amount),
          reason: dto.reason?.trim() || 'Manual adjustment',
          createdBy: user.id,
        },
      });
      await this.recordEvent(tx, {
        omsOrderId: existing.omsOrderId,
        companyId: existing.companyId,
        eventType: 'cod.adjustment_created',
        createdBy: user.id,
        payload: { amount: dto.amount, reason: dto.reason, manual: true },
      });
      return tx.codRecord.findUnique({ where: { id }, include: INCLUDE });
    });

    return serialize(updated!);
  }

  /**
   * Idempotent COD adjustment from completed OMS return (negative amount).
   */
  async createReturnAdjustment(params: {
    user: AuthPrincipal;
    omsReturnId: string;
    companyId: string;
    omsOrderId: string;
    amount: Prisma.Decimal;
    reason?: string;
  }) {
    const existingAdj = await this.prisma.codAdjustment.findUnique({
      where: { omsReturnId: params.omsReturnId },
    });
    if (existingAdj) {
      const record = await this.prisma.codRecord.findUnique({
        where: { id: existingAdj.codRecordId },
        include: INCLUDE,
      });
      return record ? serialize(record) : null;
    }

    const cod = await this.prisma.codRecord.findUnique({
      where: { omsOrderId: params.omsOrderId },
    });
    if (!cod) {
      throw new BadRequestException(
        'No COD record for this order; cannot create return adjustment.',
      );
    }

    const signed = params.amount.isPositive()
      ? params.amount.negated()
      : params.amount;

    const updated = await withTenantRls(this.prisma, params.user, async (tx) => {
      await tx.codAdjustment.create({
        data: {
          codRecordId: cod.id,
          omsReturnId: params.omsReturnId,
          amount: signed,
          reason: params.reason?.trim() || 'OMS return completed',
          createdBy: params.user.id,
        },
      });
      await this.recordEvent(tx, {
        omsOrderId: params.omsOrderId,
        companyId: params.companyId,
        eventType: 'cod.adjustment_created',
        createdBy: params.user.id,
        payload: {
          omsReturnId: params.omsReturnId,
          amount: signed.toString(),
        },
      });
      return tx.codRecord.findUnique({ where: { id: cod.id }, include: INCLUDE });
    });

    return serialize(updated!);
  }
}
