import { Injectable } from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';

const INVOICE_WIDGET_SELECT = {
  id: true,
  companyId: true,
  invoiceNumber: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.InvoiceSelect;

@Injectable()
export class BillingDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private tenantFilter(user: AuthPrincipal): Prisma.CompanyWhereInput | undefined {
    if (user.tenantScope === 'restricted') {
      return { id: { in: user.authorizedCompanyIds } };
    }
    return undefined;
  }

  /** Clients with restricted company status (billing overdue / suspended). */
  async listOverdueClients(user: AuthPrincipal, limit = 5) {
    const take = Math.min(Math.max(limit, 1), 20);
    const tenant = this.tenantFilter(user);

    const companies = await this.prisma.company.findMany({
      where: {
        status: CompanyStatus.restricted,
        ...(tenant ? tenant : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        billingCycles: {
          where: { status: 'expired' },
          orderBy: { endsAt: 'desc' },
          take: 1,
          select: { id: true, endsAt: true },
        },
      },
    });

    return companies.map((c) => ({
      companyId: c.id,
      companyName: c.name,
      status: c.status,
      lastCycleEndedAt: c.billingCycles[0]?.endsAt?.toISOString() ?? null,
      restrictedSince: c.updatedAt.toISOString(),
    }));
  }

  /** Recently issued invoices (open/paid), newest first. */
  async listRecentInvoices(user: AuthPrincipal, limit = 5) {
    const take = Math.min(Math.max(limit, 1), 20);
    const where: Prisma.InvoiceWhereInput = {
      status: { in: ['open', 'paid'] },
    };
    if (user.tenantScope === 'restricted') {
      where.companyId = { in: user.authorizedCompanyIds };
    }

    const rows = await this.prisma.invoice.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      select: INVOICE_WIDGET_SELECT,
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      companyName: row.company.name,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      totalAmount: row.totalAmount.toString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Expiring clients grouped by reminder thresholds. */
  async listExpiringBuckets(user: AuthPrincipal) {
    const now = new Date();
    const thresholds = [30, 14, 7, 3] as const;
    const tenantCompanyIds =
      user.tenantScope === 'restricted' ? user.authorizedCompanyIds : undefined;

    const cycles = await this.prisma.billingCycle.findMany({
      where: {
        status: { in: ['active', 'renewed'] },
        endsAt: { gt: now },
        ...(tenantCompanyIds ? { companyId: { in: tenantCompanyIds } } : {}),
      },
      select: {
        id: true,
        companyId: true,
        endsAt: true,
        company: { select: { id: true, name: true, status: true } },
      },
    });

    const buckets: Record<string, Array<{ companyId: string; companyName: string; cycleId: string; daysRemaining: number; endsAt: string }>> = {
      expiring30: [],
      expiring14: [],
      expiring7: [],
      expiring3: [],
      expired: [],
      suspended: [],
    };

    for (const cycle of cycles) {
      const days = Math.max(0, Math.ceil((cycle.endsAt.getTime() - now.getTime()) / 86_400_000));
      const row = {
        companyId: cycle.companyId,
        companyName: cycle.company.name,
        cycleId: cycle.id,
        daysRemaining: days,
        endsAt: cycle.endsAt.toISOString(),
      };
      if (days <= 3) buckets.expiring3.push(row);
      else if (days <= 7) buckets.expiring7.push(row);
      else if (days <= 14) buckets.expiring14.push(row);
      else if (days <= 30) buckets.expiring30.push(row);
    }

    const restricted = await this.prisma.company.findMany({
      where: {
        status: CompanyStatus.restricted,
        ...(tenantCompanyIds ? { id: { in: tenantCompanyIds } } : {}),
      },
      select: { id: true, name: true, updatedAt: true },
    });
    buckets.suspended = restricted.map((c) => ({
      companyId: c.id,
      companyName: c.name,
      cycleId: '',
      daysRemaining: 0,
      endsAt: c.updatedAt.toISOString(),
    }));

    return buckets;
  }

  /** Billing KPI summary for admin dashboard. */
  async getSummary(user: AuthPrincipal) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const tenantCompanyIds =
      user.tenantScope === 'restricted' ? user.authorizedCompanyIds : undefined;

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      ...(tenantCompanyIds ? { companyId: { in: tenantCompanyIds } } : {}),
    };

    const [outstanding, monthRevenue, openCount, overdueCount, suspendedCount] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: { ...invoiceWhere, status: { in: ['open', 'overdue'] } },
          _sum: { totalAmount: true },
        }),
        this.prisma.invoice.aggregate({
          where: {
            ...invoiceWhere,
            status: 'paid',
            updatedAt: { gte: monthStart },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.invoice.count({
          where: { ...invoiceWhere, status: 'open' },
        }),
        this.prisma.invoice.count({
          where: { ...invoiceWhere, status: 'overdue' },
        }),
        this.prisma.company.count({
          where: {
            status: CompanyStatus.restricted,
            ...(tenantCompanyIds ? { id: { in: tenantCompanyIds } } : {}),
          },
        }),
      ]);

    return {
      outstandingAmount: (outstanding._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
      currentMonthRevenue: (monthRevenue._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
      openInvoiceCount: openCount,
      overdueInvoiceCount: overdueCount,
      suspendedAccountCount: suspendedCount,
    };
  }

  /** Companies currently restricted due to billing. */
  async listSuspendedAccounts(user: AuthPrincipal, limit = 5) {
    const take = Math.min(Math.max(limit, 1), 20);
    const tenant = this.tenantFilter(user);

    const companies = await this.prisma.company.findMany({
      where: {
        status: CompanyStatus.restricted,
        ...(tenant ? tenant : {}),
      },
      orderBy: { name: 'asc' },
      take,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    return companies.map((c) => ({
      companyId: c.id,
      companyName: c.name,
      status: c.status,
      suspendedSince: c.updatedAt.toISOString(),
    }));
  }
}
