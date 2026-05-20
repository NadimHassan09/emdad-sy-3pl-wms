import { DashboardApi } from '../../api/dashboard';
import { InboundApi } from '../../api/inbound';
import { OutboundApi } from '../../api/outbound';
import { reportFmtQty } from './format';
import type { ReportFilterValues, ReportRow, ReportRunContext, WarehouseKpi } from './types';

function warehouseId(filters: ReportFilterValues, ctx: ReportRunContext): string {
  return filters.warehouseId.trim() || ctx.defaultWarehouseId;
}

function isoWeekKey(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekLabel(key: string): string {
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return key;
  return `W${m[2]} ${m[1]}`;
}

function daysBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return (b - a) / 86_400_000;
}

/** 3PL operational KPIs — no Tasks API (requires tenant companyId on JWT). */
export async function loadWarehouseKpis(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<WarehouseKpi[]> {
  const wid = warehouseId(filters, ctx);
  const companyId = filters.companyId || undefined;
  const listParams = {
    warehouseId: wid,
    companyId,
    createdFrom: filters.dateFrom || undefined,
    createdTo: filters.dateTo || undefined,
    limit: 500 as const,
  };

  const [overview, inbound, outbound] = await Promise.all([
    DashboardApi.overview(),
    InboundApi.list(listParams),
    OutboundApi.list(listParams),
  ]);

  const openInbound = inbound.items.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;
  const openOutbound = outbound.items.filter((o) => o.status !== 'shipped' && o.status !== 'cancelled').length;
  const openTasks = overview.openTasksByType.reduce((sum, row) => sum + row.count, 0);
  const cap = overview.capacity;

  const receiptCycles = inbound.items
    .map((o) => daysBetween(o.confirmedAt ?? o.createdAt, o.completedAt))
    .filter((d): d is number => d != null);
  const deliveryCycles = outbound.items
    .map((o) => daysBetween(o.confirmedAt ?? o.createdAt, o.shippedAt))
    .filter((d): d is number => d != null);

  const avgReceipt =
    receiptCycles.length > 0
      ? (receiptCycles.reduce((a, b) => a + b, 0) / receiptCycles.length).toFixed(2)
      : '—';
  const avgDelivery =
    deliveryCycles.length > 0
      ? (deliveryCycles.reduce((a, b) => a + b, 0) / deliveryCycles.length).toFixed(2)
      : '—';

  return [
    {
      id: 'receipt-cycle',
      label: 'Receipts cycle time',
      labelAr: 'دورة الاستلام',
      value: `${avgReceipt} days`,
      hint: 'Confirmed → completed (inbound)',
      hintAr: 'تأكيد → اكتمال الوارد',
    },
    {
      id: 'delivery-cycle',
      label: 'Deliveries cycle time',
      labelAr: 'دورة التسليم',
      value: `${avgDelivery} days`,
      hint: 'Confirmed → shipped (outbound)',
      hintAr: 'تأكيد → شحن الصادر',
    },
    {
      id: 'open-inbound',
      label: 'Open inbound',
      labelAr: 'وارد مفتوح',
      value: String(openInbound),
      hint: 'Orders not yet received',
      hintAr: 'طلبات لم تُستلم بعد',
    },
    {
      id: 'open-outbound',
      label: 'Open outbound',
      labelAr: 'صادر مفتوح',
      value: String(openOutbound),
      hint: 'Orders awaiting fulfillment',
      hintAr: 'طلبات بانتظار التنفيذ',
    },
    {
      id: 'units-on-hand',
      label: 'Units on hand',
      labelAr: 'وحدات في المخزون',
      value: reportFmtQty(overview.counters.totalItemsInStock),
      hint: 'Client-owned stock (all warehouses)',
      hintAr: 'مخزون العملاء',
    },
    {
      id: 'open-tasks',
      label: 'Open tasks',
      labelAr: 'مهام مفتوحة',
      value: String(openTasks),
      hint: 'Active warehouse tasks',
      hintAr: 'مهام المستودع النشطة',
    },
    {
      id: 'capacity',
      label: 'Storage capacity',
      labelAr: 'سعة التخزين',
      value: `${cap.consumedPercent}%`,
      hint: `${cap.occupiedLocations} / ${cap.totalStorageLocations} locations`,
      hintAr: `${cap.occupiedLocations} / ${cap.totalStorageLocations} موقع`,
    },
    {
      id: 'clients',
      label: 'Active clients',
      labelAr: 'عملاء نشطون',
      value: String(overview.counters.totalCustomers),
      hint: 'Companies with WMS access',
      hintAr: 'شركات لديها وصول للنظام',
    },
  ];
}

/** Weekly inbound + outbound throughput for chart / table views. */
export async function runWarehouseAnalysisChart(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const companyId = filters.companyId || undefined;
  const listParams = {
    warehouseId: wid,
    companyId,
    createdFrom: filters.dateFrom || undefined,
    createdTo: filters.dateTo || undefined,
    limit: 2000 as const,
  };

  const [inbound, outbound] = await Promise.all([
    InboundApi.list(listParams),
    OutboundApi.list(listParams),
  ]);

  const byWeek = new Map<string, { inbound: number; outbound: number }>();

  for (const o of inbound.items) {
    const key = isoWeekKey(o.createdAt);
    const cur = byWeek.get(key) ?? { inbound: 0, outbound: 0 };
    cur.inbound += 1;
    byWeek.set(key, cur);
  }
  for (const o of outbound.items) {
    const key = isoWeekKey(o.createdAt);
    const cur = byWeek.get(key) ?? { inbound: 0, outbound: 0 };
    cur.outbound += 1;
    byWeek.set(key, cur);
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, counts]) => ({
      id: key,
      week: weekLabel(key),
      inboundCount: counts.inbound,
      outboundCount: counts.outbound,
      totalCount: counts.inbound + counts.outbound,
    }));
}
