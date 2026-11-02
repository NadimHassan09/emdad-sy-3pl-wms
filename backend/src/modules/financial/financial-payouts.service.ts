import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientPayoutStatus,
  FinancialTransactionCategory,
  FinancialTransactionType,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialPoliciesService } from './financial-policies.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import {
  CreateClientPayoutRequestDto,
  ListPayoutsQueryDto,
  RecordPayoutPaidDto,
  ReviewPayoutDto,
} from './dto/financial.dto';

@Injectable()
export class FinancialPayoutsService {
  private readonly logger = new Logger(FinancialPayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: FinancialAccountsService,
    private readonly policies: FinancialPoliciesService,
    private readonly transactions: FinancialTransactionsService,
  ) {}

  generatePayoutNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `PAY-${dateStr}-${rand}`;
  }

  async requestPayout(
    companyId: string,
    dto: CreateClientPayoutRequestDto,
    userId?: string,
  ) {
    const minPayout = await this.policies.getMinimumPayoutAmount();
    if (dto.amount < minPayout) {
      throw new BadRequestException(
        `Requested payout amount ($${dto.amount}) is below the minimum allowed ($${minPayout})`,
      );
    }

    const decAmount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const account = await this.accounts.ensureAccount(companyId, tx);

      if (account.availableBalance.lt(decAmount)) {
        throw new BadRequestException(
          `Insufficient available balance ($${account.availableBalance.toFixed(2)}) for requested payout ($${decAmount.toFixed(2)})`,
        );
      }

      // Reserve funds: reduce available balance, increase payoutLocked
      await this.accounts.updateBalances(
        companyId,
        {
          availableDelta: decAmount.negated(),
          payoutLockedDelta: decAmount,
        },
        tx,
      );

      const payoutNumber = this.generatePayoutNumber();

      const payout = await tx.clientPayoutRequest.create({
        data: {
          payoutNumber,
          companyId,
          amount: decAmount,
          currency: 'USD',
          status: ClientPayoutStatus.requested,
          bankName: dto.bankName ?? null,
          accountHolder: dto.accountHolder ?? null,
          accountNumber: dto.accountNumber ?? null,
          iban: dto.iban ?? null,
          notes: dto.notes ?? null,
          requestedBy: userId ?? null,
        },
        include: {
          company: { select: { id: true, name: true, tradeName: true } },
        },
      });

      this.logger.log(`Created payout request ${payoutNumber} for company ${companyId}: $${dto.amount}`);
      return payout;
    });
  }

  async reviewPayout(
    payoutId: string,
    dto: ReviewPayoutDto,
    user: AuthPrincipal,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.clientPayoutRequest.findUnique({
        where: { id: payoutId },
      });
      if (!payout) throw new NotFoundException('Payout request not found');

      if (payout.status !== ClientPayoutStatus.requested) {
        throw new BadRequestException(
          `Cannot review payout with status ${payout.status}. Only 'requested' payouts can be reviewed.`,
        );
      }

      const now = new Date();

      if (dto.status === ClientPayoutStatus.rejected) {
        // Unlock reserved funds back to available balance
        await this.accounts.updateBalances(
          payout.companyId,
          {
            availableDelta: payout.amount,
            payoutLockedDelta: payout.amount.negated(),
          },
          tx,
        );

        return tx.clientPayoutRequest.update({
          where: { id: payoutId },
          data: {
            status: ClientPayoutStatus.rejected,
            rejectionReason: dto.rejectionReason ?? 'Rejected by administrator',
            reviewedBy: user.id,
            reviewedAt: now,
          },
        });
      }

      if (dto.status === ClientPayoutStatus.approved) {
        return tx.clientPayoutRequest.update({
          where: { id: payoutId },
          data: {
            status: ClientPayoutStatus.approved,
            reviewedBy: user.id,
            reviewedAt: now,
          },
        });
      }

      throw new BadRequestException('Status must be approved or rejected');
    });
  }

  async recordPayoutPaid(
    payoutId: string,
    dto: RecordPayoutPaidDto,
    user: AuthPrincipal,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.clientPayoutRequest.findUnique({
        where: { id: payoutId },
      });
      if (!payout) throw new NotFoundException('Payout request not found');

      if (
        payout.status !== ClientPayoutStatus.approved &&
        payout.status !== ClientPayoutStatus.requested
      ) {
        throw new BadRequestException(
          `Cannot record payout as paid with status ${payout.status}.`,
        );
      }

      const now = new Date();

      // 1. Post debit FinancialTransaction
      const txn = await this.transactions.postTransaction(
        {
          companyId: payout.companyId,
          type: FinancialTransactionType.debit,
          category: FinancialTransactionCategory.payout_disbursement,
          amount: payout.amount,
          currency: payout.currency,
          description: `Payout disbursement ${payout.payoutNumber}${dto.payoutReference ? ` Ref: ${dto.payoutReference}` : ''}`,
          referenceType: 'payout_request',
          referenceId: payout.id,
          idempotencyKey: `payout_paid_${payout.id}`,
          createdBy: user.id,
          creditAvailable: false,
          debitAvailable: false, // Available was already deducted upon request!
          metadata: {
            payoutId: payout.id,
            payoutNumber: payout.payoutNumber,
            bankName: payout.bankName,
            accountNumber: payout.accountNumber,
            payoutReference: dto.payoutReference,
          },
        },
        tx,
      );

      // 2. Release payoutLocked
      await this.accounts.updateBalances(
        payout.companyId,
        {
          payoutLockedDelta: payout.amount.negated(),
        },
        tx,
      );

      // 3. Mark payout paid
      const updated = await tx.clientPayoutRequest.update({
        where: { id: payoutId },
        data: {
          status: ClientPayoutStatus.paid,
          payoutReference: dto.payoutReference ?? null,
          paidAt: now,
          reviewedBy: payout.reviewedBy ?? user.id,
          reviewedAt: payout.reviewedAt ?? now,
          notes: dto.notes ? `${payout.notes ?? ''}\n[Payment]: ${dto.notes}`.trim() : payout.notes,
        },
        include: {
          company: { select: { id: true, name: true, tradeName: true } },
        },
      });

      return {
        payout: updated,
        transaction: txn,
      };
    });
  }

  async listPayouts(
    params: ListPayoutsQueryDto,
    user?: AuthPrincipal | { companyId?: string },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const skip = (page - 1) * limit;

    let companyIdFilter = params.companyId;
    if (user?.companyId) {
      companyIdFilter = user.companyId;
    }

    const where: Prisma.ClientPayoutRequestWhereInput = {
      ...(companyIdFilter ? { companyId: companyIdFilter } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.clientPayoutRequest.count({ where }),
      this.prisma.clientPayoutRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          company: { select: { id: true, name: true, tradeName: true } },
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
}
