/**
 * DashboardOverviewPage — Phase 4.5 premiumization.
 *
 * Changes from Phase 3:
 *   - Alert component replaces raw error <p> tags
 *   - StatCard: shadow-sm (more elevation), richer icon containers
 *   - StatCard: consistent rounded-card radius via tailwind utility + inline style
 *   - Section headers: text-sm → text-xs font-bold uppercase tracking for premium hierarchy
 *   - Capacity bar: stronger green fill, better percentage label
 *   - Recent orders: uses Card-like containers with hover lift
 *   - Loading skeleton: uses Skeleton component from @ds
 *   - All animations use design system motion tokens
 */

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { DashboardApi } from '../api/dashboard';
import {
  OpenOrdersStageBarCard,
  OpenOrdersStageBarCardSkeleton,
} from '../components/dashboard/OpenOrdersStageBarCard';
import {
  OrderProgressGaugeCard,
  OrderProgressGaugeCardSkeleton,
} from '../components/dashboard/OrderProgressGaugeCard';
import {
  OpenTasksByTypeChartCard,
  OpenTasksByTypeChartCardSkeleton,
} from '../components/dashboard/OpenTasksByTypeChartCard';
import {
  WarehouseOverviewMetricCard,
  WarehouseOverviewMetricCardSkeleton,
} from '../components/dashboard/WarehouseOverviewMetricCard';
import { BillingExpiringClientsCard } from '../components/dashboard/BillingExpiringClientsCard';
import { BillingOverdueClientsCard } from '../components/dashboard/BillingOverdueClientsCard';
import { BillingRecentInvoicesCard } from '../components/dashboard/BillingRecentInvoicesCard';
import { BillingSuspendedAccountsCard } from '../components/dashboard/BillingSuspendedAccountsCard';
import { Alert, AppPageHeader } from '@ds';
import { QK } from '../constants/query-keys';

// ─────────────────────────────────────────────────────────────────────────────
// Localisation
// ─────────────────────────────────────────────────────────────────────────────

function dashboardLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Items in catalog': 'العناصر في الكتالوج',
    'Total customers': 'إجمالي العملاء',
    'Total customers (companies)': 'إجمالي العملاء (الشركات)',
    'Open inbound orders': 'طلبات الوارد المفتوحة',
    'Open outbound orders': 'طلبات الصادر المفتوحة',
    Receive: 'استلام',
    Putaway: 'تخزين',
    Pick: 'التقاط',
    Pack: 'تغليف',
    Delivery: 'تسليم',
    Internal: 'داخلي',
    'Open tasks': 'المهام المفتوحة',
    'Warehouse capacity consumption': 'استهلاك سعة المستودع',
    Available: 'متاح',
    Occupied: 'مشغول',
    'occupied of': 'مشغول من',
    'storage locations': 'مواقع تخزين',
    consumed: 'مستهلك',
    Capacity: 'السعة',
    'Soon expiry lots (next 6 months)': 'الدفعات القريبة من الانتهاء (خلال 6 أشهر)',
    'No lots expiring soon.': 'لا توجد دفعات تنتهي قريبًا.',
    'Not set': 'غير محدد',
    'Recent 5 open inbound orders': 'آخر 5 طلبات وارد مفتوحة',
    'Go to inbound orders': 'الانتقال إلى طلبات الوارد',
    'Recent 5 open outbound orders': 'آخر 5 طلبات صادر مفتوحة',
    'Go to outbound orders': 'الانتقال إلى طلبات الصادر',
    'No open orders': 'لا توجد طلبات مفتوحة',
    '1 open order': 'طلب واحد مفتوح',
    'open orders': 'طلبات مفتوحة',
    New: 'جديد',
    Picking: 'التقاط',
    Packing: 'تغليف',
    Shipping: 'الشحن',
    Overview: 'نظرة عامة',
    'Warehouse overview': 'نظرة عامة على المستودع',
    'Could not load dashboard': 'تعذر تحميل لوحة التحكم',
    'Active warehouse tasks': 'مهام مستودع نشطة',
    'Registered client companies': 'شركات عملاء مسجلة',
    'in progress': 'قيد التنفيذ',
    'not started': 'لم تبدأ',
    'No open tasks': 'لا توجد مهام مفتوحة',
    'Billing cycles expiring soon': 'دورات الفوترة التي تنتهي قريبًا',
    'View billing plans': 'عرض خطط الفوترة',
    'Loading…': 'جاري التحميل…',
    'No active billing cycles expiring soon.': 'لا توجد دورات فوترة نشطة تنتهي قريبًا.',
    Ends: 'تنتهي',
    'days remaining': 'يوم متبقٍ',
    renewed: 'مجدّد',
    Renew: 'تجديد',
    'Overdue clients': 'العملاء المتأخرون',
    'No overdue clients.': 'لا يوجد عملاء متأخرون.',
    'Cycle ended': 'انتهت الدورة',
    Restricted: 'مقيّد',
    'Recent invoices': 'الفواتير الأخيرة',
    'View all invoices': 'عرض كل الفواتير',
    'No recent invoices.': 'لا توجد فواتير حديثة.',
    'Suspended accounts': 'الحسابات المعلّقة',
    'View clients': 'عرض العملاء',
    'No suspended accounts.': 'لا توجد حسابات معلّقة.',
    'Suspended since': 'معلّق منذ',
    Billing: 'الفوترة',
  };
  return ar[label] ?? label;
}

function numberFmt(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function dateFmt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header — premium operational hierarchy
// ─────────────────────────────────────────────────────────────────────────────

const statCardClass =
  'rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4 ' +
  'transition-[box-shadow,border-color] duration-fast ease-standard';

const statCardInteractiveClass =
  'hover:border-slate-200 hover:shadow-md focus-visible:outline-none focus-visible:shadow-focus';

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
      {children}
    </h2>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardOverviewPage() {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl');
  const t = (label: string) => dashboardLabel(label, isArabic);

  const query = useQuery({
    queryKey: QK.dashboardOverview,
    queryFn: () => DashboardApi.overview(),
  });

  const data = query.data;

  function formatPercent(value: number): string {
    return Number.isFinite(value) ? value.toFixed(1) : '0.0';
  }

  return (
    <div className="space-y-4">
      <AppPageHeader title={t('Overview')} />

      {/* ── Loading skeleton ──────────────────────────────────────── */}
      {query.isPending && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <WarehouseOverviewMetricCardSkeleton />
            <WarehouseOverviewMetricCardSkeleton />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <OpenOrdersStageBarCardSkeleton title={t('Open inbound orders')} />
            <OpenOrdersStageBarCardSkeleton title={t('Open outbound orders')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <OpenTasksByTypeChartCardSkeleton title={t('Open tasks by type')} />
            <OrderProgressGaugeCardSkeleton
              title={t('Warehouse capacity consumption')}
              subtitlePlacement="footer"
            />
          </div>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────── */}
      {query.isError && (
        <Alert
          variant="error"
          title={t('Could not load dashboard')}
          description={query.error instanceof Error ? undefined : 'An unexpected error occurred. Try refreshing.'}
          action={
            <Alert.Action variant="error" onClick={() => query.refetch()}>
              Retry
            </Alert.Action>
          }
        />
      )}

      {data && (
        <>
          {/* ── Warehouse overview (reference metric cards) ───────── */}
          <section>
            <SectionHeading>{t('Warehouse overview')}</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <WarehouseOverviewMetricCard
                title={t('Items in catalog')}
                value={numberFmt(data.counters.itemsInCatalog)}
                to="/products"
                icon="fa-solid fa-boxes-stacked"
              />
              <WarehouseOverviewMetricCard
                title={t('Total customers')}
                value={numberFmt(data.counters.totalCustomers)}
                to="/clients"
                icon="fa-solid fa-building"
              />
            </div>
          </section>

          {/* ── Billing dashboard widgets ───────────────────────────── */}
          <section>
            <SectionHeading>{t('Billing')}</SectionHeading>
            <div className="grid gap-3 lg:grid-cols-2">
              <BillingExpiringClientsCard translateLabel={t} />
              <BillingOverdueClientsCard translateLabel={t} />
              <BillingRecentInvoicesCard translateLabel={t} />
              <BillingSuspendedAccountsCard translateLabel={t} />
            </div>
          </section>

          {/* ── Open orders (stage bar cards) ───────────────────────── */}
          <section>
            <SectionHeading>Open orders</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <OpenOrdersStageBarCard
                title={t('Open inbound orders')}
                openOrderCount={data.openOrders.inbound}
                to="/orders/inbound"
                isLoading={query.isPending}
              />
              <OpenOrdersStageBarCard
                title={t('Open outbound orders')}
                openOrderCount={data.openOrders.outbound}
                to="/orders/outbound"
                isLoading={query.isPending}
              />
            </div>
          </section>

          {/* ── Open tasks + Capacity (side by side) ─────────────────── */}
          <section>
            <div className="grid gap-3 sm:grid-cols-2">
              <OpenTasksByTypeChartCard
                title={t('Open tasks')}
                rows={data.openTasksByType}
                to="/tasks"
                translateLabel={t}
                formatPercent={formatPercent}
              />
              <OrderProgressGaugeCard
                title={t('Warehouse capacity consumption')}
                subtitlePlacement="footer"
                slices={[
                  {
                    key: 'available',
                    label: 'Available',
                    count: Math.max(
                      0,
                      data.capacity.totalStorageLocations - data.capacity.occupiedLocations,
                    ),
                  },
                  {
                    key: 'occupied',
                    label: 'Occupied',
                    count: data.capacity.occupiedLocations,
                  },
                ]}
                to="/locations"
                centerPercent={data.capacity.consumedPercent}
                translateLabel={t}
                openOrdersSubtitle={() =>
                  `${numberFmt(data.capacity.occupiedLocations)} ${t('occupied of')} ${numberFmt(data.capacity.totalStorageLocations)} ${t('storage locations')}`
                }
              />
            </div>
          </section>

          {/* ── Expiry lots table ──────────────────────────────────── */}
          <section>
            <SectionHeading>Expiry alerts</SectionHeading>
            <Link
              to="/inventory/ledger"
              className={`block ${statCardClass} ${statCardInteractiveClass}`}
            >
              <h3 className="mb-4 text-sm font-semibold text-slate-900">
                {t('Soon expiry lots (next 6 months)')}
              </h3>
              <div>
                {data.soonExpiryLots.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('No lots expiring soon.')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          {['Product', 'Lot', 'Expiry', 'Location', 'Qty'].map((h) => (
                            <th
                              key={h}
                              className={`bg-slate-100 px-6 py-4 text-sm font-medium uppercase tracking-wide text-slate-500 text-start ${h === 'Qty' ? 'text-end' : ''}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.soonExpiryLots.map((row) => (
                          <tr key={row.lotId} className="border-t border-slate-100 transition-colors hover:bg-emerald-50/50">
                            <td className="px-6 py-5 font-semibold text-slate-900">{row.productName}</td>
                            <td className="px-6 py-5 font-mono text-slate-600">
                              <span dir="ltr">{row.lotNumber}</span>
                            </td>
                            <td className="px-6 py-5 tabular-nums text-slate-600">
                              {row.expiryDate ? (
                                dateFmt(row.expiryDate)
                              ) : (
                                <span className="font-medium text-amber-700">{t('Not set')}</span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-slate-600">{row.locationName}</td>
                            <td className="px-6 py-5 text-end font-mono tabular-nums text-slate-800">
                              {numberFmt(row.lotQuantity)} / {numberFmt(row.productTotalQuantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Link>
          </section>

          {/* ── Recent orders ──────────────────────────────────────── */}
          <section>
            <SectionHeading>Recent activity</SectionHeading>
            <div className="grid gap-3 lg:grid-cols-2">
              {/* Inbound */}
              <div className={statCardClass}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('Recent 5 open inbound orders')}
                  </h3>
                  <Link
                    to="/orders/inbound"
                    className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2"
                  >
                    {t('Go to inbound orders')}
                  </Link>
                </div>
                <ul className="divide-y divide-slate-100">
                  {data.recentOrders.inbound.map((order) => (
                    <li key={order.id}>
                      <Link
                        to={`/orders/inbound/${order.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <span className="block font-mono text-xs font-semibold text-brand-700">
                            <span dir="ltr">{order.orderNumber}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {order.companyName} · {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          {dateFmt(order.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Outbound */}
              <div className={statCardClass}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('Recent 5 open outbound orders')}
                  </h3>
                  <Link
                    to="/orders/outbound"
                    className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2"
                  >
                    {t('Go to outbound orders')}
                  </Link>
                </div>
                <ul className="divide-y divide-slate-100">
                  {data.recentOrders.outbound.map((order) => (
                    <li key={order.id}>
                      <Link
                        to={`/orders/outbound/${order.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <span className="block font-mono text-xs font-semibold text-brand-700">
                            <span dir="ltr">{order.orderNumber}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {order.companyName} · {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          {dateFmt(order.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
