import { Injectable } from '@nestjs/common';
import { BillingInvoiceStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RunReportQueryDto } from './dto/run-report-query.dto';
import type { ReportRowDto } from './reports.service';

const SAMPLE_CAP = 2000;
const REVENUE_STATUSES: BillingInvoiceStatus[] = ['open', 'paid', 'overdue'];
const RECEIVABLE_STATUSES: BillingInvoiceStatus[] = ['open', 'overdue'];

function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  return typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
}

function paginate<T>(rows: T[], limit: number, offset: number) {
  return {
    items: rows.slice(offset, offset + limit),
    total: rows.length,
  };
}

function computeDueDate(issuedAt: Date, paymentTermsDays: number): Date {
  const due = new Date(issuedAt);
  due.setUTCDate(due.getUTCDate() + paymentTermsDays);
  return due;
}

export function daysPastDue(dueAt: Date, now = new Date()): number {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const due = new Date(dueAt);
  due.setUTCHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

export function receivablesAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'Current';
  if (daysOverdue <= 30) return '1–30 days';
  if (daysOverdue <= 60) return '31–60 days';
  if (daysOverdue <= 90) return '61–90 days';
  return '90+ days';
}

@Injectable()
export class FinanceReportsRunner {
  constructor(private readonly prisma: PrismaService) {}

  async run(
    user: AuthPrincipal,
    reportId: string,
    query: RunReportQueryDto,
  ): Promise<{ items: ReportRowDto[]; total: number }> {
    switch (reportId) {
      case 'revenue-by-client':
        return this.revenueByClient(user, query);
      case 'receivables-aging':
        return this.receivablesAging(user, query);
      default:
        return { items: [], total: 0 };
    }
  }

  private tenantCompanyIds(user: AuthPrincipal): string[] | undefined {
    return user.tenantScope === 'restricted' ? user.authorizedCompanyIds : undefined;
  }

  private invoiceDateFilter(query: RunReportQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.dateFrom && !query.dateTo) return undefined;
    const issuedAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom) issuedAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (query.dateTo) issuedAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
    return issuedAt;
  }

  private async revenueByClient(user: AuthPrincipal, query: RunReportQueryDto) {
    const tenantIds = this.tenantCompanyIds(user);
    const statusFilter = query.status?.trim() as BillingInvoiceStatus | undefined;
    const statuses =
      statusFilter && REVENUE_STATUSES.includes(statusFilter)
        ? [statusFilter]
        : REVENUE_STATUSES;

    const where: Prisma.InvoiceWhereInput = {
      status: { in: statuses },
      issuedAt: { not: null },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
    };
    const dateFilter = this.invoiceDateFilter(query);
    if (dateFilter) where.issuedAt = { ...dateFilter, not: null };

    const grouped = await this.prisma.invoice.groupBy({
      by: ['companyId'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const companyIds = grouped.map((g) => g.companyId);
    const companies = await this.prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(companies.map((c) => [c.id, c.name]));

    const rows = grouped.map((g) => ({
      id: g.companyId,
      client: nameById.get(g.companyId) ?? g.companyId,
      invoiceCount: g._count.id,
      revenue: g._sum.totalAmount?.toString() ?? '0',
    }));

    return paginate(rows, query.limit, query.offset);
  }

  private async receivablesAging(user: AuthPrincipal, query: RunReportQueryDto) {
    const tenantIds = this.tenantCompanyIds(user);
    const bucketFilter = query.status?.trim();

    const where: Prisma.InvoiceWhereInput = {
      status: { in: RECEIVABLE_STATUSES },
      issuedAt: { not: null },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: 'asc' },
      take: SAMPLE_CAP,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        issuedAt: true,
        company: { select: { name: true, paymentTermsDays: true } },
      },
    });

    const now = new Date();
    const rows = invoices
      .map((inv) => {
        const issuedAt = inv.issuedAt!;
        const dueAt = computeDueDate(issuedAt, inv.company.paymentTermsDays ?? 30);
        const overdueDays = daysPastDue(dueAt, now);
        const agingBucket = receivablesAgingBucket(overdueDays);
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          client: inv.company.name,
          status: inv.status,
          amount: inv.totalAmount.toString(),
          issuedAt: fmtDate(issuedAt),
          dueDate: fmtDate(dueAt),
          daysPastDue: String(Math.max(0, overdueDays)),
          agingBucket,
        } satisfies ReportRowDto;
      })
      .filter((r) => !bucketFilter || r.agingBucket === bucketFilter)
      .sort((a, b) => Number(b.daysPastDue) - Number(a.daysPastDue));

    return paginate(rows, query.limit, query.offset);
  }
}
