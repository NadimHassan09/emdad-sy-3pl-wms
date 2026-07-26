import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OutboundService } from '../outbound/outbound.service';
import type { RunReportQueryDto } from './dto/run-report-query.dto';
import type { ReportRowDto } from './reports.service';

const SAMPLE_CAP = 2000;

function fmtQty(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
}

function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  return typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

function paginate<T>(rows: T[], limit: number, offset: number) {
  return {
    items: rows.slice(offset, offset + limit),
    total: rows.length,
  };
}

function daysUntilExpiry(expiryDate: string | Date | null | undefined): number | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.round((exp.getTime() - today.getTime()) / 86_400_000);
}

export function expiryAgingBucket(days: number | null): string {
  if (days === null) return 'No expiry';
  if (days < 0) return 'Expired';
  if (days <= 30) return '0–30 days';
  if (days <= 90) return '31–90 days';
  if (days <= 180) return '91–180 days';
  return '180+ days';
}

function daysSinceMovement(lastMovementAt: Date | null | undefined): number | null {
  if (!lastMovementAt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mov = new Date(lastMovementAt);
  mov.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - mov.getTime()) / 86_400_000);
}

export function stockMovementAgingBucket(days: number | null): string {
  if (days === null) return 'No movement';
  if (days <= 30) return '0–30 days';
  if (days <= 90) return '31–90 days';
  if (days <= 180) return '91–180 days';
  return '180+ days';
}

@Injectable()
export class InventoryIntelligenceReportsRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly outbound: OutboundService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  async run(
    user: AuthPrincipal,
    reportId: string,
    query: RunReportQueryDto,
  ): Promise<{ items: ReportRowDto[]; total: number }> {
    switch (reportId) {
      case 'stock-aging':
        return this.stockAging(user, query);
      case 'lot-expiry':
        return this.lotExpiry(user, query);
      case 'capacity-utilization':
        return this.capacityUtilization(user, query);
      case 'return-rate':
        return this.returnRate(user, query);
      default:
        return { items: [], total: 0 };
    }
  }

  private stockQuery(query: RunReportQueryDto) {
    return {
      warehouseId: query.warehouseId,
      companyId: query.companyId,
      sku: query.sku?.trim() || undefined,
      limit: SAMPLE_CAP,
      offset: 0,
    };
  }

  private async stockAging(user: AuthPrincipal, query: RunReportQueryDto) {
    const { items } = await this.inventory.stock(user, this.stockQuery(query));
    const statusFilter = query.status?.trim();

    const rows = items
      .map((row) => {
        const days = daysSinceMovement(row.lastMovementAt);
        const agingBucket = stockMovementAgingBucket(days);
        return {
          id: row.id,
          sku: row.product.sku,
          product: row.product.name,
          client: row.companyId,
          location: row.location.fullPath,
          lastMovement: fmtDate(row.lastMovementAt),
          daysSinceMovement: days === null ? '' : String(days),
          agingBucket,
          onHand: fmtQty(row.quantityOnHand),
          stagnant: agingBucket === '180+ days' || agingBucket === 'No movement' ? 'yes' : 'no',
        } satisfies ReportRowDto;
      })
      .filter((r) => !statusFilter || r.agingBucket === statusFilter)
      .sort((a, b) => Number(a.daysSinceMovement || 9999) - Number(b.daysSinceMovement || 9999));

    const companyIds = [...new Set(rows.map((r) => r.client).filter(Boolean))] as string[];
    const companies =
      companyIds.length > 0
        ? await this.prisma.company.findMany({
            where: { id: { in: companyIds } },
            select: { id: true, name: true },
          })
        : [];
    const companyNames = new Map(companies.map((c) => [c.id, c.name]));
    for (const row of rows) {
      row.client = companyNames.get(String(row.client)) ?? String(row.client ?? '');
    }

    return paginate(rows, query.limit, query.offset);
  }

  private async lotExpiry(user: AuthPrincipal, query: RunReportQueryDto) {
    const { items } = await this.inventory.stock(user, this.stockQuery(query));
    const statusFilter = query.status?.trim();

    const rows = items
      .filter((row) => row.lot)
      .map((row) => {
        const days = daysUntilExpiry(row.lot?.expiryDate);
        const agingBucket = expiryAgingBucket(days);
        return {
          id: row.id,
          sku: row.product.sku,
          product: row.product.name,
          lot: row.lot?.lotNumber ?? '',
          expiry: fmtDate(row.lot?.expiryDate),
          daysUntil: days === null ? '' : String(days),
          agingBucket,
          location: row.location.fullPath,
          quantity: fmtQty(row.quantityOnHand),
        } satisfies ReportRowDto;
      })
      .filter((r) => !statusFilter || r.agingBucket === statusFilter)
      .sort((a, b) => Number(a.daysUntil || 9999) - Number(b.daysUntil || 9999));

    return paginate(rows, query.limit, query.offset);
  }

  private async capacityUtilization(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, query.companyId);

    const stockWhere: Prisma.CurrentStockWhereInput = {
      quantityOnHand: { gt: 0 },
      ...(companyId ? { companyId } : {}),
      product: { status: { not: 'archived' } },
    };

    const stockRows = await this.prisma.currentStock.findMany({
      where: stockWhere,
      select: {
        companyId: true,
        quantityOnHand: true,
        product: { select: { volumeCbm: true } },
        company: { select: { id: true, name: true } },
      },
      take: SAMPLE_CAP,
    });

    const planWhere: Prisma.BillingPlanWhereInput = {
      active: true,
      ...(companyId ? { companyId } : {}),
    };
    const plans = await this.prisma.billingPlan.findMany({
      where: planWhere,
      select: { companyId: true, reservedVolume: true, company: { select: { name: true } } },
    });

    const usedByCompany = new Map<string, { name: string; used: number }>();
    for (const row of stockRows) {
      const cbm = Number(row.product.volumeCbm ?? 0);
      const qty = Math.max(0, Number(row.quantityOnHand));
      const cur = usedByCompany.get(row.companyId) ?? {
        name: row.company.name,
        used: 0,
      };
      cur.used += qty * (Number.isFinite(cbm) ? cbm : 0);
      usedByCompany.set(row.companyId, cur);
    }

    const reservedByCompany = new Map<string, { name: string; reserved: number }>();
    for (const plan of plans) {
      const cur = reservedByCompany.get(plan.companyId) ?? {
        name: plan.company.name,
        reserved: 0,
      };
      cur.reserved += Number(plan.reservedVolume);
      reservedByCompany.set(plan.companyId, cur);
    }

    const companyIds = new Set([...usedByCompany.keys(), ...reservedByCompany.keys()]);
    const items: ReportRowDto[] = [...companyIds]
      .map((id) => {
        const used = usedByCompany.get(id)?.used ?? 0;
        const reserved = reservedByCompany.get(id)?.reserved ?? 0;
        const name =
          usedByCompany.get(id)?.name ?? reservedByCompany.get(id)?.name ?? id;
        const remaining = Math.max(0, reserved - used);
        const pct = reserved > 0 ? Math.min(100, Math.round((used / reserved) * 1000) / 10) : 0;
        return {
          id,
          location: name,
          type: 'inventory_cbm',
          skuCount: fmtQty(used),
          totalQty: fmtQty(reserved),
          utilization: `${pct}% (remaining ${fmtQty(remaining)} CBM)`,
        } satisfies ReportRowDto;
      })
      .sort((a, b) => String(a.location).localeCompare(String(b.location)));

    return paginate(items, query.limit, query.offset);
  }

  private async returnRate(user: AuthPrincipal, query: RunReportQueryDto) {
    const warehouseId = query.warehouseId?.trim();
    if (!warehouseId) return { items: [], total: 0 };

    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, query.companyId);
    const listParams = {
      warehouseId,
      companyId,
      createdFrom: query.dateFrom,
      createdTo: query.dateTo,
      limit: SAMPLE_CAP,
      offset: 0,
    };

    const returnWhere: Prisma.ReturnOrderWhereInput = {
      ...(companyId ? { companyId } : {}),
      warehouseId,
    };
    if (query.dateFrom || query.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      returnWhere.createdAt = createdAt;
    }

    const [outboundPage, returnRows] = await Promise.all([
      this.outbound.list(user, listParams),
      this.prisma.returnOrder.findMany({
        where: returnWhere,
        select: {
          id: true,
          companyId: true,
          company: { select: { name: true } },
        },
        take: SAMPLE_CAP,
      }),
    ]);

    const outboundByCo = new Map<string, { name: string; count: number }>();
    for (const order of outboundPage.items) {
      const cur = outboundByCo.get(order.companyId) ?? {
        name: order.company?.name ?? order.companyId,
        count: 0,
      };
      cur.count += 1;
      outboundByCo.set(order.companyId, cur);
    }

    const returnsByCo = new Map<string, { name: string; count: number }>();
    for (const ret of returnRows) {
      const cur = returnsByCo.get(ret.companyId) ?? {
        name: ret.company.name,
        count: 0,
      };
      cur.count += 1;
      returnsByCo.set(ret.companyId, cur);
    }

    const allCompanyIds = new Set([...outboundByCo.keys(), ...returnsByCo.keys()]);
    const rows = [...allCompanyIds]
      .map((id) => {
        const outbound = outboundByCo.get(id)?.count ?? 0;
        const returns = returnsByCo.get(id)?.count ?? 0;
        const name = outboundByCo.get(id)?.name ?? returnsByCo.get(id)?.name ?? id;
        const rate = outbound > 0 ? (returns / outbound) * 100 : returns > 0 ? 100 : 0;
        return {
          id,
          client: name,
          outboundOrders: outbound,
          returnOrders: returns,
          returnRatePercent: fmtPct(rate),
        } satisfies ReportRowDto;
      })
      .filter((r) => Number(r.outboundOrders) > 0 || Number(r.returnOrders) > 0)
      .sort((a, b) => Number(b.returnOrders) - Number(a.returnOrders));

    return paginate(rows, query.limit, query.offset);
  }
}
