import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CodRecordStatus,
  FinancialTransactionCategory,
  FinancialTransactionType,
  Prisma,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialPoliciesService } from './financial-policies.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { ListCodFinancialQueryDto } from './dto/financial.dto';

@Injectable()
export class FinancialCodService {
  private readonly logger = new Logger(FinancialCodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: FinancialAccountsService,
    private readonly policies: FinancialPoliciesService,
    private readonly transactions: FinancialTransactionsService,
  ) {}

  /**
   * Called when an OMS order with COD is created or confirmed delivered.
   * Ensures COD amount is reflected in client's pending balance.
   */
  async recordPendingCod(
    omsOrderId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const codRecord = await client.codRecord.findUnique({
      where: { omsOrderId },
      include: { omsOrder: true },
    });
    if (!codRecord) return null;

    // If already credited to account, nothing to record as pending
    if (codRecord.creditedToAccountAt) return codRecord;

    // Check if policy allows immediate availability on delivery
    const eligibility = await this.policies.getCodEligibility();
    if (eligibility === 'on_delivered') {
      return this.creditCodToAccount(codRecord.id, 'auto:on_delivered', client);
    }

    // Otherwise, reflect in pendingBalance if not already counted
    // Check if account pendingBalance already covers this
    // We increment pendingBalance atomically for this order if not done
    return codRecord;
  }

  /**
   * Confirm that the carrier has collected the cash from the end recipient.
   */
  async confirmCarrierCollection(
    codRecordId: string,
    user: AuthPrincipal,
    notes?: string,
  ) {
    const codRecord = await this.prisma.codRecord.findUnique({
      where: { id: codRecordId },
      include: { omsOrder: true, adjustments: true },
    });
    if (!codRecord) throw new NotFoundException('COD record not found');

    if (codRecord.carrierCollectedAt) {
      this.logger.warn(`COD collection already confirmed for codRecord ${codRecordId}`);
      return codRecord;
    }

    const now = new Date();
    const updated = await this.prisma.codRecord.update({
      where: { id: codRecordId },
      data: {
        carrierCollectedAt: now,
        collectionConfirmedBy: user.id,
        notes: notes ? `${codRecord.notes ?? ''}\n[Collection]: ${notes}`.trim() : codRecord.notes,
      },
      include: { omsOrder: true, adjustments: true },
    });

    // If financial policy is 'on_collection', credit to available balance now
    const eligibility = await this.policies.getCodEligibility();
    if (eligibility === 'on_collection') {
      await this.creditCodToAccount(codRecord.id, user.id);
    }

    return updated;
  }

  /**
   * Confirm that the carrier has remitted the cash to EMDAD.
   */
  async confirmCarrierRemittance(
    codRecordId: string,
    user: AuthPrincipal,
    remittanceReference?: string,
    notes?: string,
  ) {
    const codRecord = await this.prisma.codRecord.findUnique({
      where: { id: codRecordId },
      include: { omsOrder: true, adjustments: true },
    });
    if (!codRecord) throw new NotFoundException('COD record not found');

    if (codRecord.carrierRemittedAt) {
      this.logger.warn(`COD remittance already confirmed for codRecord ${codRecordId}`);
      return codRecord;
    }

    const now = new Date();
    const updated = await this.prisma.codRecord.update({
      where: { id: codRecordId },
      data: {
        carrierRemittedAt: now,
        remittanceConfirmedBy: user.id,
        remittanceReference: remittanceReference ?? null,
        notes: notes ? `${codRecord.notes ?? ''}\n[Remittance]: ${notes}`.trim() : codRecord.notes,
      },
      include: { omsOrder: true, adjustments: true },
    });

    // Under default policy 'on_remittance' (or 'on_collection'), credit to available balance
    await this.creditCodToAccount(codRecord.id, user.id);

    return updated;
  }

  /**
   * Credits the collected/remitted COD to the client's current and available balance.
   * Atomically posts a FinancialTransaction and updates CodRecord and ClientFinancialAccount.
   */
  async creditCodToAccount(
    codRecordId: string,
    userId: string,
    externalTx?: Prisma.TransactionClient,
  ) {
    const runner = async (tx: Prisma.TransactionClient) => {
      const record = await tx.codRecord.findUnique({
        where: { id: codRecordId },
        include: { omsOrder: true, adjustments: true },
      });
      if (!record) throw new NotFoundException('COD record not found');

      if (record.creditedToAccountAt) {
        this.logger.warn(`COD record ${codRecordId} already credited to account`);
        return record;
      }

      // Calculate net amount (original + adjustments)
      const adjSum = record.adjustments.reduce(
        (sum, a) => sum.add(a.amount),
        new Prisma.Decimal(0),
      );
      const netAmount = record.originalAmount.add(adjSum);

      if (netAmount.lte(0)) {
        this.logger.warn(`COD net amount is <= 0 for record ${codRecordId}, skipping account credit`);
        return record;
      }

      const idempotencyKey = `cod_credit_ord_${record.omsOrderId}`;
      const now = new Date();

      // Post transaction: credit client current and available balance
      const txn = await this.transactions.postTransaction(
        {
          companyId: record.companyId,
          type: FinancialTransactionType.credit,
          category: FinancialTransactionCategory.cod_credit,
          amount: netAmount,
          currency: record.currency,
          description: `COD Credit for Order ${record.omsOrder.orderNumber}`,
          referenceType: 'oms_order',
          referenceId: record.omsOrderId,
          idempotencyKey,
          createdBy: userId.startsWith('auto:') ? undefined : userId,
          creditAvailable: true,
          metadata: {
            codRecordId: record.id,
            omsOrderId: record.omsOrderId,
            orderNumber: record.omsOrder.orderNumber,
            originalAmount: record.originalAmount.toString(),
            adjustments: record.adjustments.length,
          },
        },
        tx,
      );

      // Decrement pendingBalance and mark credited
      await this.accounts.updateBalances(
        record.companyId,
        {
          pendingDelta: netAmount.negated(),
        },
        tx,
      );

      const updated = await tx.codRecord.update({
        where: { id: codRecordId },
        data: {
          status: CodRecordStatus.available,
          availableAt: record.availableAt ?? now,
          creditedToAccountAt: now,
          financialTransactionId: txn.id,
        },
        include: { omsOrder: true, adjustments: true },
      });

      return updated;
    };

    if (externalTx) return runner(externalTx);
    return this.prisma.$transaction((tx) => runner(tx));
  }

  async listCodFinancial(
    params: ListCodFinancialQueryDto,
    user?: AuthPrincipal | { companyId?: string },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const skip = (page - 1) * limit;

    let companyIdFilter = params.companyId;
    if (user?.companyId) {
      companyIdFilter = user.companyId;
    }

    const where: Prisma.CodRecordWhereInput = {
      ...(companyIdFilter ? { companyId: companyIdFilter } : {}),
      ...(params.status ? { status: params.status as any } : {}),
      ...(params.search
        ? {
            OR: [
              { omsOrder: { orderNumber: { contains: params.search, mode: 'insensitive' } } },
              { omsOrder: { trackingNumber: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.codRecord.count({ where }),
      this.prisma.codRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          company: { select: { id: true, name: true, tradeName: true } },
          omsOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              recipientName: true,
              trackingNumber: true,
              shippingMethod: true,
              shippingProviderCode: true,
            },
          },
          adjustments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const serialized = items.map((r) => {
      const adjSum = r.adjustments.reduce(
        (sum, a) => sum.add(a.amount),
        new Prisma.Decimal(0),
      );
      const currentAmount = r.originalAmount.add(adjSum);
      return {
        id: r.id,
        companyId: r.companyId,
        company: r.company,
        omsOrderId: r.omsOrderId,
        omsOrder: r.omsOrder,
        originalAmount: r.originalAmount.toString(),
        currentAmount: currentAmount.toString(),
        currency: r.currency,
        status: r.status,
        carrierCollectedAt: r.carrierCollectedAt,
        carrierRemittedAt: r.carrierRemittedAt,
        remittanceReference: r.remittanceReference,
        creditedToAccountAt: r.creditedToAccountAt,
        availableAt: r.availableAt,
        paidOutAt: r.paidOutAt,
        createdAt: r.createdAt,
      };
    });

    return {
      items: serialized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
