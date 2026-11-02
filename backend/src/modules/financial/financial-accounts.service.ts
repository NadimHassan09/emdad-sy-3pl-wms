import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FinancialAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAccount(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.clientFinancialAccount.findUnique({
      where: { companyId },
    });
    if (existing) return existing;

    return client.clientFinancialAccount.create({
      data: {
        companyId,
        currentBalance: new Prisma.Decimal(0),
        availableBalance: new Prisma.Decimal(0),
        pendingBalance: new Prisma.Decimal(0),
        payoutLocked: new Prisma.Decimal(0),
        totalCredits: new Prisma.Decimal(0),
        totalDebits: new Prisma.Decimal(0),
        currency: 'USD',
        status: 'active',
      },
    });
  }

  async getAccount(companyId: string, tx?: Prisma.TransactionClient) {
    const account = await this.ensureAccount(companyId, tx);
    const company = await (tx ?? this.prisma).company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, tradeName: true, status: true },
    });
    return {
      ...account,
      company,
    };
  }

  async updateBalances(
    companyId: string,
    deltas: {
      currentDelta?: Prisma.Decimal | number;
      availableDelta?: Prisma.Decimal | number;
      pendingDelta?: Prisma.Decimal | number;
      payoutLockedDelta?: Prisma.Decimal | number;
      creditDelta?: Prisma.Decimal | number;
      debitDelta?: Prisma.Decimal | number;
      lastTransactionAt?: Date;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    await this.ensureAccount(companyId, client);

    const cDelta = deltas.currentDelta ? new Prisma.Decimal(deltas.currentDelta) : new Prisma.Decimal(0);
    const aDelta = deltas.availableDelta ? new Prisma.Decimal(deltas.availableDelta) : new Prisma.Decimal(0);
    const pDelta = deltas.pendingDelta ? new Prisma.Decimal(deltas.pendingDelta) : new Prisma.Decimal(0);
    const lDelta = deltas.payoutLockedDelta ? new Prisma.Decimal(deltas.payoutLockedDelta) : new Prisma.Decimal(0);
    const crDelta = deltas.creditDelta ? new Prisma.Decimal(deltas.creditDelta) : new Prisma.Decimal(0);
    const dbDelta = deltas.debitDelta ? new Prisma.Decimal(deltas.debitDelta) : new Prisma.Decimal(0);

    return client.clientFinancialAccount.update({
      where: { companyId },
      data: {
        currentBalance: { increment: cDelta },
        availableBalance: { increment: aDelta },
        pendingBalance: { increment: pDelta },
        payoutLocked: { increment: lDelta },
        totalCredits: { increment: crDelta },
        totalDebits: { increment: dbDelta },
        ...(deltas.lastTransactionAt ? { lastTransactionAt: deltas.lastTransactionAt } : {}),
      },
    });
  }

  async listAccounts(params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.ClientFinancialAccountWhereInput = {
      ...(params.status ? { status: params.status as any } : {}),
      ...(params.search
        ? {
            company: {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { tradeName: { contains: params.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.clientFinancialAccount.count({ where }),
      this.prisma.clientFinancialAccount.findMany({
        where,
        skip,
        take: limit,
        include: {
          company: {
            select: { id: true, name: true, tradeName: true, status: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
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

  async getFinancialOverview() {
    const accounts = await this.prisma.clientFinancialAccount.findMany({
      select: {
        currentBalance: true,
        availableBalance: true,
        pendingBalance: true,
        payoutLocked: true,
        totalCredits: true,
        totalDebits: true,
      },
    });

    let totalClientBalances = new Prisma.Decimal(0);
    let totalAvailableBalances = new Prisma.Decimal(0);
    let totalPendingCod = new Prisma.Decimal(0);
    let totalPayoutLocked = new Prisma.Decimal(0);
    let totalCredits = new Prisma.Decimal(0);
    let totalDebits = new Prisma.Decimal(0);

    for (const acc of accounts) {
      totalClientBalances = totalClientBalances.add(acc.currentBalance);
      totalAvailableBalances = totalAvailableBalances.add(acc.availableBalance);
      totalPendingCod = totalPendingCod.add(acc.pendingBalance);
      totalPayoutLocked = totalPayoutLocked.add(acc.payoutLocked);
      totalCredits = totalCredits.add(acc.totalCredits);
      totalDebits = totalDebits.add(acc.totalDebits);
    }

    const [
      payoutsRequested,
      payoutsPaid,
      shippingCharges,
    ] = await Promise.all([
      this.prisma.clientPayoutRequest.aggregate({
        where: { status: { in: ['requested', 'approved'] } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.clientPayoutRequest.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: { category: 'shipping_fee', status: 'posted' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalClientBalances: totalClientBalances.toFixed(4),
      totalAvailableBalances: totalAvailableBalances.toFixed(4),
      totalPendingCod: totalPendingCod.toFixed(4),
      totalPayoutLocked: totalPayoutLocked.toFixed(4),
      totalCredits: totalCredits.toFixed(4),
      totalDebits: totalDebits.toFixed(4),
      payoutsPendingCount: payoutsRequested._count,
      totalPayoutsPending: (payoutsRequested._sum.amount ?? new Prisma.Decimal(0)).toFixed(4),
      payoutsCompletedCount: payoutsPaid._count,
      totalPayoutsCompleted: (payoutsPaid._sum.amount ?? new Prisma.Decimal(0)).toFixed(4),
      shippingChargesCount: shippingCharges._count,
      totalShippingCharges: (shippingCharges._sum.amount ?? new Prisma.Decimal(0)).toFixed(4),
    };
  }
}
