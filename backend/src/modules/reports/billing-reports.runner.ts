import { Injectable } from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ReportRowDto } from './reports.service';

@Injectable()
export class BillingReportsRunner {
  constructor(private readonly prisma: PrismaService) {}

  private tenantCompanyIds(user: AuthPrincipal): string[] | undefined {
    return user.tenantScope === 'restricted' ? user.authorizedCompanyIds : undefined;
  }

  async run(
    user: AuthPrincipal,
    reportId: string,
    query: { limit: number; offset: number; companyId?: string },
  ): Promise<{ items: ReportRowDto[]; total: number }> {
    switch (reportId) {
      case 'billing-revenue':
        return this.revenueByClient(user, query);
      case 'billing-outstanding':
        return this.outstandingInvoices(user, query);
      case 'billing-expiring':
        return this.expiringClients(user, query);
      case 'billing-suspended':
        return this.suspendedClients(user, query);
      case 'billing-capacity':
        return this.capacityUtilization(user, query);
      default:
        return { items: [], total: 0 };
    }
  }

  private async revenueByClient(
    user: AuthPrincipal,
    query: { limit: number; offset: number; companyId?: string },
  ) {
    const tenantIds = this.tenantCompanyIds(user);
    const where: Prisma.InvoiceWhereInput = {
      status: { in: ['open', 'paid', 'overdue'] },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
    };

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

    const all = grouped.map((g) => ({
      id: g.companyId,
      client: nameById.get(g.companyId) ?? g.companyId,
      invoiceCount: g._count.id,
      revenue: g._sum.totalAmount?.toString() ?? '0',
    }));

    return {
      items: all.slice(query.offset, query.offset + query.limit),
      total: all.length,
    };
  }

  private async outstandingInvoices(
    user: AuthPrincipal,
    query: { limit: number; offset: number; companyId?: string },
  ) {
    const tenantIds = this.tenantCompanyIds(user);
    const where: Prisma.InvoiceWhereInput = {
      status: { in: ['open', 'overdue'] },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          issuedAt: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        client: row.company.name,
        status: row.status,
        amount: row.totalAmount.toString(),
        issuedAt: row.issuedAt?.toISOString() ?? '',
      })),
      total,
    };
  }

  private async expiringClients(
    user: AuthPrincipal,
    query: { limit: number; offset: number },
  ) {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setUTCDate(horizon.getUTCDate() + 30);
    const tenantIds = this.tenantCompanyIds(user);

    const where: Prisma.BillingCycleWhereInput = {
      status: { in: ['active', 'renewed'] },
      endsAt: { gt: now, lte: horizon },
      ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
    };

    const [cycles, total] = await Promise.all([
      this.prisma.billingCycle.findMany({
        where,
        orderBy: { endsAt: 'asc' },
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          endsAt: true,
          company: { select: { id: true, name: true } },
        },
      }),
      this.prisma.billingCycle.count({ where }),
    ]);

    return {
      items: cycles.map((c) => ({
        id: c.id,
        client: c.company.name,
        daysRemaining: Math.max(
          0,
          Math.ceil((c.endsAt.getTime() - now.getTime()) / 86_400_000),
        ),
        cycleEnd: c.endsAt.toISOString().slice(0, 10),
      })),
      total,
    };
  }

  private async suspendedClients(
    user: AuthPrincipal,
    query: { limit: number; offset: number },
  ) {
    const tenantIds = this.tenantCompanyIds(user);
    const where: Prisma.CompanyWhereInput = {
      status: CompanyStatus.restricted,
      ...(tenantIds ? { id: { in: tenantIds } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        select: { id: true, name: true, updatedAt: true },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        client: c.name,
        suspendedSince: c.updatedAt.toISOString().slice(0, 10),
      })),
      total,
    };
  }

  private async capacityUtilization(
    user: AuthPrincipal,
    query: { limit: number; offset: number },
  ) {
    const tenantIds = this.tenantCompanyIds(user);
    const where: Prisma.BillingPlanWhereInput = {
      active: true,
      ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
    };

    const [plans, total] = await Promise.all([
      this.prisma.billingPlan.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          reservedVolume: true,
          reservedWeight: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.billingPlan.count({ where }),
    ]);

    return {
      items: plans.map((p) => ({
        id: p.id,
        client: p.company.name,
        allocatedVolumeCbm: p.reservedVolume.toString(),
        allocatedWeightKg: p.reservedWeight.toString(),
      })),
      total,
    };
  }
}
