import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingCyclesService } from '../../billing/billing-cycles.service';
import { BillingInvoicesService } from '../../billing/billing-invoices.service';
import { BillingPlansService } from '../../billing/billing-plans.service';

const MS_PER_DAY = 86_400_000;

export type ClientAccountStatus = 'active' | 'expiring' | 'restricted';

type BillingCycleRow = Awaited<ReturnType<BillingCyclesService['list']>>[number];

function pickCurrentCycle(cycles: BillingCycleRow[], asOf = new Date()): BillingCycleRow | null {
  const current = cycles.filter(
    (c) =>
      (c.status === 'active' || c.status === 'renewed') &&
      c.startsAt <= asOf &&
      c.endsAt > asOf,
  );
  if (!current.length) return null;
  return current.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0]!;
}

function daysRemainingFromEnd(endsAt: Date, asOf = new Date()): number {
  return Math.ceil((endsAt.getTime() - asOf.getTime()) / MS_PER_DAY);
}

function deriveAccountStatus(
  companyStatus: string,
  currentCycle: BillingCycleRow | null,
): ClientAccountStatus {
  if (companyStatus === 'restricted') return 'restricted';
  if (currentCycle) {
    const days = daysRemainingFromEnd(currentCycle.endsAt);
    if (days <= 7) return 'expiring';
  }
  return 'active';
}

@Injectable()
export class ClientBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: BillingPlansService,
    private readonly cycles: BillingCyclesService,
    private readonly invoices: BillingInvoicesService,
  ) {}

  private assertBillingAccess(client: ClientPrincipal): void {
    if (client.role !== UserRole.client_admin) {
      throw new ForbiddenException('Only client administrators can access billing.');
    }
  }

  async getSummary(client: ClientPrincipal) {
    this.assertBillingAccess(client);
    const user = clientAuthPrincipal(client);
    const companyId = client.companyId;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, status: true },
    });

    const [planRows, cycleRows, invoiceRows] = await Promise.all([
      this.plans.list(user, companyId),
      this.cycles.list(user, companyId),
      this.invoices.list(user, companyId),
    ]);

    const plan = planRows.find((p) => p.active) ?? planRows[0] ?? null;
    const currentCycle = pickCurrentCycle(cycleRows);
    const daysRemaining = currentCycle ? daysRemainingFromEnd(currentCycle.endsAt) : null;
    const accountStatus = deriveAccountStatus(company?.status ?? 'active', currentCycle);

    const currentInvoice = currentCycle
      ? invoiceRows.find((inv) => inv.billingCycleId === currentCycle.id) ?? null
      : null;

    return {
      accountStatus,
      company: company ?? { id: companyId, name: '', status: 'active' },
      plan,
      currentCycle,
      daysRemaining,
      reservedVolume: plan?.reservedVolume ?? null,
      reservedWeight: plan?.reservedWeight ?? null,
      currentInvoice,
    };
  }

  async listInvoicesPage(
    client: ClientPrincipal,
    params: { limit: number; offset: number },
  ) {
    this.assertBillingAccess(client);
    const companyId = client.companyId;
    const limit = Math.min(Math.max(params.limit, 1), 200);
    const offset = Math.max(params.offset, 0);

    const where = { companyId };
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          companyId: true,
          billingCycleId: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          issuedAt: true,
          createdAt: true,
          updatedAt: true,
          billingCycle: {
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              status: true,
              rateSnapshot: true,
              billingPlanId: true,
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async listInvoices(client: ClientPrincipal) {
    this.assertBillingAccess(client);
    const user = clientAuthPrincipal(client);
    return this.invoices.list(user, client.companyId);
  }

  async getInvoice(client: ClientPrincipal, id: string) {
    this.assertBillingAccess(client);
    const user = clientAuthPrincipal(client);
    return this.invoices.findById(user, id);
  }
}
