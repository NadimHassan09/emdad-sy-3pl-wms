import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialTransactionCategory,
  FinancialTransactionStatus,
  FinancialTransactionType,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FinancialAccountsService } from './financial-accounts.service';
import {
  ListFinancialTransactionsQueryDto,
  PostManualAdjustmentDto,
} from './dto/financial.dto';

export interface PostTransactionParams {
  companyId: string;
  type: FinancialTransactionType;
  category: FinancialTransactionCategory;
  amount: Prisma.Decimal | number;
  currency?: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  creditAvailable?: boolean;
  debitAvailable?: boolean;
}

@Injectable()
export class FinancialTransactionsService {
  private readonly logger = new Logger(FinancialTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: FinancialAccountsService,
  ) {}

  generateTransactionNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `TXN-${dateStr}-${rand}`;
  }

  async postTransaction(
    params: PostTransactionParams,
    externalTx?: Prisma.TransactionClient,
  ) {
    const decAmount = new Prisma.Decimal(params.amount);
    if (decAmount.lte(0)) {
      throw new BadRequestException('Transaction amount must be strictly positive');
    }

    const runner = async (tx: Prisma.TransactionClient) => {
      // 1. Idempotency check
      if (params.idempotencyKey) {
        const existing = await tx.financialTransaction.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) {
          this.logger.warn(
            `Transaction already posted for idempotencyKey=${params.idempotencyKey}, returning existing ${existing.transactionNumber}`,
          );
          return existing;
        }
      }

      // 2. Ensure account exists
      await this.accounts.ensureAccount(params.companyId, tx);

      // 3. Generate transaction number
      const transactionNumber = this.generateTransactionNumber();
      const now = new Date();

      // 4. Create transaction row
      const txn = await tx.financialTransaction.create({
        data: {
          companyId: params.companyId,
          transactionNumber,
          type: params.type,
          category: params.category,
          amount: decAmount,
          currency: params.currency ?? 'USD',
          description: params.description,
          referenceType: params.referenceType ?? null,
          referenceId: params.referenceId ? String(params.referenceId) : null,
          status: FinancialTransactionStatus.posted,
          idempotencyKey: params.idempotencyKey ?? null,
          metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          createdBy: params.createdBy ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

      // 5. Update account balances atomically
      const isCredit = params.type === FinancialTransactionType.credit;
      const currentDelta = isCredit ? decAmount : decAmount.negated();
      const creditDelta = isCredit ? decAmount : new Prisma.Decimal(0);
      const debitDelta = isCredit ? new Prisma.Decimal(0) : decAmount;

      let availableDelta = new Prisma.Decimal(0);
      if (isCredit && params.creditAvailable !== false) {
        // default: credits to client account become available balance unless explicitly false
        availableDelta = decAmount;
      } else if (!isCredit && params.debitAvailable !== false) {
        // debits reduce available balance unless explicitly false
        availableDelta = decAmount.negated();
      }

      await this.accounts.updateBalances(
        params.companyId,
        {
          currentDelta,
          availableDelta,
          creditDelta,
          debitDelta,
          lastTransactionAt: now,
        },
        tx,
      );

      return txn;
    };

    if (externalTx) {
      return runner(externalTx);
    }
    return this.prisma.$transaction((tx) => runner(tx));
  }

  async createManualAdjustment(
    dto: PostManualAdjustmentDto,
    user: AuthPrincipal,
  ) {
    if (!dto.description || dto.description.trim().length === 0) {
      throw new BadRequestException('A reason/description is mandatory for manual adjustments');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { id: true, name: true },
    });
    if (!company) {
      throw new NotFoundException(`Company not found: ${dto.companyId}`);
    }

    return this.postTransaction({
      companyId: dto.companyId,
      type: dto.type,
      category: dto.category ?? FinancialTransactionCategory.manual_adjustment,
      amount: dto.amount,
      description: dto.description.trim(),
      referenceType: dto.referenceType ?? 'manual_adjustment',
      referenceId: dto.referenceId,
      createdBy: user.id,
      metadata: {
        adjustedBy: user.email ?? user.id,
      },
    });
  }

  async listTransactions(
    params: ListFinancialTransactionsQueryDto,
    user?: AuthPrincipal | { companyId?: string },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const skip = (page - 1) * limit;

    let companyIdFilter = params.companyId;
    if (user?.companyId) {
      // Client role strict isolation
      companyIdFilter = user.companyId;
    }

    const where: Prisma.FinancialTransactionWhereInput = {
      ...(companyIdFilter ? { companyId: companyIdFilter } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.referenceType ? { referenceType: params.referenceType } : {}),
      ...(params.startDate || params.endDate
        ? {
            createdAt: {
              ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
              ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { transactionNumber: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
              { referenceId: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.financialTransaction.count({ where }),
      this.prisma.financialTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          company: {
            select: { id: true, name: true, tradeName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTransactionById(id: string, user?: AuthPrincipal | { companyId?: string }) {
    const txn = await this.prisma.financialTransaction.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true, tradeName: true },
        },
      },
    });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (user?.companyId && txn.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this transaction');
    }
    return txn;
  }

  /**
   * Debits the client account for commercial shipping fee upon dispatch/delivery.
   * Guaranteed idempotent per omsOrderId.
   */
  async recordShippingFeeCharge(
    omsOrderId: string,
    externalTx?: Prisma.TransactionClient,
  ) {
    const client = externalTx ?? this.prisma;
    const order = await client.omsOrder.findUnique({
      where: { id: omsOrderId },
      select: {
        id: true,
        orderNumber: true,
        companyId: true,
        shippingFee: true,
        currency: true,
      },
    });

    if (!order || !order.shippingFee || order.shippingFee.lte(0)) {
      return null;
    }

    const idempotencyKey = `shipping_fee_ord_${omsOrderId}`;
    return this.postTransaction(
      {
        companyId: order.companyId,
        type: FinancialTransactionType.debit,
        category: FinancialTransactionCategory.shipping_fee,
        amount: order.shippingFee,
        currency: order.currency ?? 'USD',
        description: `Shipping fee for order ${order.orderNumber}`,
        referenceType: 'oms_order',
        referenceId: omsOrderId,
        idempotencyKey,
        debitAvailable: true,
        metadata: {
          omsOrderId,
          orderNumber: order.orderNumber,
        },
      },
      externalTx,
    );
  }

  /**
   * Records a manual or auto shipping fee adjustment on an OMS order.
   */
  async recordShippingFeeAdjustment(
    omsOrderId: string,
    diff: Prisma.Decimal,
    reason?: string,
    userId?: string,
    externalTx?: Prisma.TransactionClient,
  ) {
    if (diff.isZero()) return null;

    const client = externalTx ?? this.prisma;
    const order = await client.omsOrder.findUnique({
      where: { id: omsOrderId },
      select: {
        id: true,
        orderNumber: true,
        companyId: true,
        currency: true,
      },
    });
    if (!order) return null;

    const isIncrease = diff.gt(0);
    const amount = diff.abs();

    return this.postTransaction(
      {
        companyId: order.companyId,
        type: isIncrease ? FinancialTransactionType.debit : FinancialTransactionType.credit,
        category: FinancialTransactionCategory.shipping_fee,
        amount,
        currency: order.currency ?? 'USD',
        description: `Shipping fee adjustment for order ${order.orderNumber}: ${reason ?? (isIncrease ? 'Fee increased' : 'Fee reduced')}`,
        referenceType: 'oms_order',
        referenceId: omsOrderId,
        idempotencyKey: `shipping_fee_adj_${omsOrderId}_${Date.now()}`,
        createdBy: userId,
        creditAvailable: !isIncrease,
        debitAvailable: isIncrease,
        metadata: {
          omsOrderId,
          orderNumber: order.orderNumber,
          difference: diff.toString(),
          reason,
        },
      },
      externalTx,
    );
  }
}
