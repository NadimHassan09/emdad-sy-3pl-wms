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
import { Alert, AppPageHeader, Skeleton } from '@ds';
import { QK } from '../constants/query-keys';

// ─────────────────────────────────────────────────────────────────────────────
// Localisation
// ─────────────────────────────────────────────────────────────────────────────

function dashboardLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Items in catalog': 'العناصر في الكتالوج',
    'Total items in stock': 'إجمالي العناصر في المخزون',
    'Total customers (companies)': 'إجمالي العملاء (الشركات)',
    'Open inbound orders': 'طلبات الوارد المفتوحة',
    'Open outbound orders': 'طلبات الصادر المفتوحة',
    Receive: 'استلام',
    Putaway: 'تخزين',
    Pick: 'التقاط',
    Pack: 'تغليف',
    Delivery: 'تسليم',
    Internal: 'داخلي',
    'Open tasks by type': 'المهام المفتوحة حسب النوع',
    'Warehouse capacity consumption': 'استهلاك سعة المستودع',
    'occupied of': 'مشغول من',
    'storage locations': 'مواقع تخزين',
    consumed: 'مستهلك',
    'Soon expiry lots (next 6 months)': 'الدفعات القريبة من الانتهاء (خلال 6 أشهر)',
    'No lots expiring soon.': 'لا توجد دفعات تنتهي قريبًا.',
    'Not set': 'غير محدد',
    'Recent 5 open inbound orders': 'آخر 5 طلبات وارد مفتوحة',
    'Go to inbound orders': 'الانتقال إلى طلبات الوارد',
    'Recent 5 open outbound orders': 'آخر 5 طلبات صادر مفتوحة',
    'Go to outbound orders': 'الانتقال إلى طلبات الصادر',
    Overview: 'نظرة عامة',
    'Warehouse overview': 'نظرة عامة على المستودع',
    'Could not load dashboard': 'تعذر تحميل لوحة التحكم',
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
// StatCard — reference-style KPI card (label above, bold value below)
// ─────────────────────────────────────────────────────────────────────────────

const statCardClass =
  'rounded-3xl border border-slate-100 bg-white p-6 shadow-sm ' +
  'transition-[box-shadow,border-color] duration-fast ease-standard';

const statCardInteractiveClass =
  'hover:border-slate-200 hover:shadow-md focus-visible:outline-none focus-visible:shadow-focus';

function StatCard({
  value,
  title,
  to,
}: {
  value: string;
  title: string;
  to?: string;
}) {
  const body = (
    <>
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
        {value}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`${statCardClass} ${statCardInteractiveClass} block`}
      >
        {body}
      </Link>
    );
  }

  return <div className={statCardClass}>{body}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header — premium operational hierarchy
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
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

  return (
    <div className="space-y-6">
      <AppPageHeader title={t('Overview')} />

      {/* ── Loading skeleton ──────────────────────────────────────── */}
      {query.isPending && (
        <div className="space-y-5">
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <Skeleton height={14} width="55%" className="mb-3" />
                <Skeleton height={32} width="35%" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <Skeleton height={14} width="50%" className="mb-3" />
                <Skeleton height={32} width="30%" />
              </div>
            ))}
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
          {/* ── Counters ──────────────────────────────────────────── */}
          <section>
            <SectionHeading>{t('Warehouse overview')}</SectionHeading>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              <StatCard
                value={numberFmt(data.counters.totalItemsInStock)}
                title={t('Total items in stock')}
                to="/inventory/stock"
              />
              <StatCard
                value={numberFmt(data.counters.itemsInCatalog)}
                title={t('Items in catalog')}
                to="/products"
              />
              <StatCard
                value={numberFmt(data.counters.totalCustomers)}
                title={t('Total customers (companies)')}
                to="/clients"
              />
            </div>
          </section>

          {/* ── Open orders ────────────────────────────────────────── */}
          <section>
            <SectionHeading>Open orders</SectionHeading>
            <div className="grid gap-6 sm:grid-cols-2">
              <StatCard
                value={numberFmt(data.openOrders.inbound)}
                title={t('Open inbound orders')}
                to="/orders/inbound"
              />
              <StatCard
                value={numberFmt(data.openOrders.outbound)}
                title={t('Open outbound orders')}
                to="/orders/outbound"
              />
            </div>
          </section>

          {/* ── Open tasks by type ─────────────────────────────────── */}
          <section>
            <SectionHeading>{t('Open tasks by type')}</SectionHeading>
            <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {data.openTasksByType.map((task) => (
                <StatCard
                  key={task.key}
                  value={numberFmt(task.count)}
                  title={t(task.label)}
                  to={`/tasks?taskType=${encodeURIComponent(task.key)}`}
                />
              ))}
            </div>
          </section>

          {/* ── Capacity bar ───────────────────────────────────────── */}
          <section>
            <SectionHeading>Capacity</SectionHeading>
            <Link
              to="/locations"
              className={`block ${statCardClass} ${statCardInteractiveClass}`}
            >
              <div className="text-sm text-slate-500">{t('Warehouse capacity consumption')}</div>
              <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                {data.capacity.consumedPercent}
                <span className="text-lg font-normal text-slate-400">%</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {data.capacity.occupiedLocations} {t('occupied of')}{' '}
                {data.capacity.totalStorageLocations} {t('storage locations')}
              </p>
              <div className="mt-3.5 h-2 w-full overflow-hidden rounded-pill bg-neutral-100">
                <div
                  className="h-2 rounded-pill bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-slow ease-standard"
                  style={{ width: `${Math.min(100, Math.max(0, data.capacity.consumedPercent))}%` }}
                />
              </div>
            </Link>
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
            <div className="grid gap-6 lg:grid-cols-2">
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
