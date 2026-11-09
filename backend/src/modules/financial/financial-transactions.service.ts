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
import { readManagedUsdToSypRate, toAccountAmount } from './account-currency';
import { randomBytes } from 'crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  buildTabularExport,
  EXPORT_MAX_ROWS,
  type TabularExportFormat,
} from '../../common/utils/tabular-export.util';
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

  /** Date-only strings (YYYY-MM-DD) are treated as whole UTC days so `endDate` is inclusive. */
  private dayBound(value: string | undefined, edge: 'start' | 'end'): Date | undefined {
    if (!value?.trim()) return undefined;
    const raw = value.trim();
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? `${raw}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`
      : raw;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid ${edge === 'start' ? 'startDate' : 'endDate'}.`);
    }
    return d;
  }

  private buildListWhere(
    params: ListFinancialTransactionsQueryDto,
    user?: AuthPrincipal | { companyId?: string },
  ): Prisma.FinancialTransactionWhereInput {
    let companyIdFilter = params.companyId;
    if (user?.companyId) {
      // Client role strict isolation
      companyIdFilter = user.companyId;
    }
    const gte = this.dayBound(params.startDate, 'start');
    const lte = this.dayBound(params.endDate, 'end');

    return {
      ...(companyIdFilter ? { companyId: companyIdFilter } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.referenceType ? { referenceType: params.referenceType } : {}),
      ...(gte || lte
        ? { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } }
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
  }

  /** Export of the transaction log (same filters as the list, no paging; capped). */
  async exportTransactions(
    params: ListFinancialTransactionsQueryDto,
    format: TabularExportFormat,
    user?: AuthPrincipal | { companyId?: string },
  ) {
    const where = this.buildListWhere(params, user);
    const fetched = await this.prisma.financialTransaction.findMany({
      where,
      take: EXPORT_MAX_ROWS + 1,
      include: { company: { select: { name: true, tradeName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const truncated = fetched.length > EXPORT_MAX_ROWS;
    const items = truncated ? fetched.slice(0, EXPORT_MAX_ROWS) : fetched;

    const rows = items.map((t) => ({
      transactionNumber: t.transactionNumber,
      createdAt: t.createdAt,
      client: t.company?.name ?? t.companyId,
      type: t.type,
      category: t.category,
      amount: t.amount.toString(),
      currency: t.currency,
      status: t.status,
      referenceType: t.referenceType ?? '',
      referenceId: t.referenceId ?? '',
      description: t.description,
    }));
    let credits = new Prisma.Decimal(0);
    let debits = new Prisma.Decimal(0);
    for (const t of items) {
      if (t.type === 'credit') credits = credits.add(t.amount);
      else debits = debits.add(t.amount);
    }
    const clients = new Set(items.map((t) => t.companyId)).size;

    return buildTabularExport({
      format,
      baseName: 'financial-transactions',
      sheetName: 'Transactions',
      title: 'Financial Transactions Export',
      truncated,
      columns: [
        { header: 'Txn #', key: 'transactionNumber', width: 22 },
        { header: 'Date', key: 'createdAt', width: 20 },
        { header: 'Client', key: 'client', width: 24 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Amount', key: 'amount', width: 14 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Reference type', key: 'referenceType', width: 18 },
        { header: 'Reference ID', key: 'referenceId', width: 38 },
        { header: 'Description', key: 'description', width: 40 },
      ],
      rows,
      summary: [
        { label: 'Transactions', value: rows.length },
        { label: 'Total credits', value: credits.toFixed(2) },
        { label: 'Total debits', value: debits.toFixed(2) },
        { label: 'Clients', value: clients },
        ...(params.startDate || params.endDate
          ? [{ label: 'Date range', value: `${params.startDate ?? '…'} → ${params.endDate ?? '…'}` }]
          : []),
      ],
    });
  }

  async listTransactions(
    params: ListFinancialTransactionsQueryDto,
    user?: AuthPrincipal | { companyId?: string },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(params, user);

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
    // The account is USD only: a fee priced in SYP is converted before it is debited.
    const feeUsd = toAccountAmount(order.shippingFee, order.currency, await readManagedUsdToSypRate(this.prisma));
    if (!feeUsd) {
      throw new BadRequestException(
        'No USD/SYP exchange rate is available, so the shipping fee in SYP cannot be debited from the client account.',
      );
    }
    return this.postTransaction(
      {
        companyId: order.companyId,
        type: FinancialTransactionType.debit,
        category: FinancialTransactionCategory.shipping_fee,
        amount: feeUsd.amount,
        currency: 'USD',
        description: `Shipping fee for order ${order.orderNumber}`,
        referenceType: 'oms_order',
        referenceId: omsOrderId,
        idempotencyKey,
        debitAvailable: true,
        metadata: {
          omsOrderId,
          orderNumber: order.orderNumber,
          originalAmount: order.shippingFee.toString(),
          originalCurrency: order.currency ?? 'USD',
          fxRate: feeUsd.fxRate,
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
    const diffUsd = toAccountAmount(diff.abs(), order.currency, await readManagedUsdToSypRate(this.prisma));
    if (!diffUsd) {
      throw new BadRequestException(
        'No USD/SYP exchange rate is available, so the shipping fee change in SYP cannot be posted to the client account.',
      );
    }
    const amount = diffUsd.amount;

    return this.postTransaction(
      {
        companyId: order.companyId,
        type: isIncrease ? FinancialTransactionType.debit : FinancialTransactionType.credit,
        category: FinancialTransactionCategory.shipping_fee,
        amount,
        currency: 'USD',
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
