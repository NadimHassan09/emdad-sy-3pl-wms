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
