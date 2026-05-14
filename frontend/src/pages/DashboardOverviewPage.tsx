import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { DashboardApi } from '../api/dashboard';
import { PageHeader } from '../components/PageHeader';
import { QK } from '../constants/query-keys';

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
    'Recent 5 open inbound orders': 'آخر 5 طلبات وارد مفتوحة',
    'Go to inbound orders': 'الانتقال إلى طلبات الوارد',
    'Recent 5 open outbound orders': 'آخر 5 طلبات صادر مفتوحة',
    'Go to outbound orders': 'الانتقال إلى طلبات الصادر',
    Overview: 'نظرة عامة',
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

function StatCard({
  value,
  title,
  icon,
  iconBgClass,
  iconColorClass,
  to,
}: {
  value: string;
  title: string;
  icon: ReactNode;
  iconBgClass: string;
  iconColorClass: string;
  /** When set, the whole card navigates (keyboard-accessible link). */
  to?: string;
}) {
  const baseClass =
    'rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300';
  const interactiveClass =
    'hover:border-[#1a7a44]/40 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#1a7a44] focus-visible:ring-offset-2';

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${iconBgClass}`}>
          <span className={`h-5 w-5 ${iconColorClass}`}>{icon}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{title}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${baseClass} ${interactiveClass} block`}>
        {body}
      </Link>
    );
  }

  return <div className={baseClass}>{body}</div>;
}

export function DashboardOverviewPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => dashboardLabel(label, isArabic);

  const query = useQuery({
    queryKey: QK.dashboardOverview,
    queryFn: () => DashboardApi.overview(),
  });

  const err = query.error instanceof Error ? query.error.message : null;
  const data = query.data;

  return (
    <div className="space-y-6">
      <PageHeader title={t('Overview')} />

      {query.isPending ? <p className="text-sm text-slate-500">Loading dashboard overview...</p> : null}
      {query.isError ? (
        <p className="text-sm text-rose-600">{err ?? 'Could not load dashboard overview.'}</p>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              value={numberFmt(data.counters.totalItemsInStock)}
              title={t('Total items in stock')}
              to="/inventory/stock"
              iconBgClass="bg-sky-100"
              iconColorClass="text-sky-700"
              icon={
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6.5 10 3l7 3.5-7 3.5L3 6.5Z" />
                  <path d="M3 10.5 10 14l7-3.5" />
                  <path d="M3 14 10 17l7-3" />
                </svg>
              }
            />
            <StatCard
              value={numberFmt(data.counters.itemsInCatalog)}
              title={t('Items in catalog')}
              to="/products"
              iconBgClass="bg-emerald-100"
              iconColorClass="text-emerald-700"
              icon={
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 5h12v11H4z" />
                  <path d="M7 8h6M7 11h6M7 14h4" />
                </svg>
              }
            />
            <StatCard
              value={numberFmt(data.counters.totalCustomers)}
              title={t('Total customers (companies)')}
              to="/clients"
              iconBgClass="bg-violet-100"
              iconColorClass="text-violet-700"
              icon={
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M4 17a6 6 0 0 1 12 0" />
                </svg>
              }
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <StatCard
              value={numberFmt(data.openOrders.inbound)}
              title={t('Open inbound orders')}
              to="/orders/inbound"
              iconBgClass="bg-amber-100"
              iconColorClass="text-amber-700"
              icon={
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 10h10" />
                  <path d="m9 6 4 4-4 4" />
                  <path d="M3 4h14v12H3z" />
                </svg>
              }
            />
            <StatCard
              value={numberFmt(data.openOrders.outbound)}
              title={t('Open outbound orders')}
              to="/orders/outbound"
              iconBgClass="bg-fuchsia-100"
              iconColorClass="text-fuchsia-700"
              icon={
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17 10H7" />
                  <path d="m11 6-4 4 4 4" />
                  <path d="M3 4h14v12H3z" />
                </svg>
              }
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t('Open tasks by type')}</h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {data.openTasksByType.map((task) => (
                <StatCard
                  key={task.key}
                  value={numberFmt(task.count)}
                  title={t(task.label)}
                  to={`/tasks?taskType=${encodeURIComponent(task.key)}`}
                  iconBgClass="bg-slate-100"
                  iconColorClass="text-slate-700"
                  icon={
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 6h12M4 10h12M4 14h8" />
                    </svg>
                  }
                />
              ))}
            </div>
          </section>

          <Link
            to="/locations"
            className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#1a7a44]/40 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#1a7a44] focus-visible:ring-offset-2"
          >
            <h2 className="text-sm font-semibold text-slate-900">{t('Warehouse capacity consumption')}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {data.capacity.occupiedLocations} {t('occupied of')} {data.capacity.totalStorageLocations} {t('storage locations')}
            </p>
            <div className="mt-4 h-3 w-full rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-[#1a7a44]"
                style={{ width: `${Math.min(100, Math.max(0, data.capacity.consumedPercent))}%` }}
              />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {data.capacity.consumedPercent}% {t('consumed')}
            </p>
          </Link>

          <Link
            to="/inventory/ledger"
            className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#1a7a44]/40 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#1a7a44] focus-visible:ring-offset-2"
          >
            <h2 className="text-sm font-semibold text-slate-900">{t('Soon expiry lots (next 6 months)')}</h2>
            {data.soonExpiryLots.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t('No lots expiring soon.')}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Lot</th>
                      <th className="px-3 py-2">Expiry</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Qty (lot / product)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.soonExpiryLots.map((row) => (
                      <tr key={row.lotId} className="border-t border-slate-200">
                        <td className="px-3 py-2">{row.productName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.lotNumber}</td>
                        <td className="px-3 py-2">{row.expiryDate ? dateFmt(row.expiryDate) : '—'}</td>
                        <td className="px-3 py-2">{row.locationName}</td>
                        <td className="px-3 py-2">
                          {numberFmt(row.lotQuantity)} / {numberFmt(row.productTotalQuantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Link>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t('Recent 5 open inbound orders')}</h2>
                <Link to="/orders/inbound" className="text-xs font-medium text-[#1a7a44] hover:underline">
                  {t('Go to inbound orders')}
                </Link>
              </div>
              <ul className="space-y-2">
                {data.recentOrders.inbound.map((order) => (
                  <li key={order.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/orders/inbound/${order.id}`}
                        className="font-medium text-[#1a7a44] hover:underline"
                        title="Open inbound order"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="text-xs text-slate-500">{dateFmt(order.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {order.companyName} - {order.status}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t('Recent 5 open outbound orders')}</h2>
                <Link to="/orders/outbound" className="text-xs font-medium text-[#1a7a44] hover:underline">
                  {t('Go to outbound orders')}
                </Link>
              </div>
              <ul className="space-y-2">
                {data.recentOrders.outbound.map((order) => (
                  <li key={order.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/orders/outbound/${order.id}`}
                        className="font-medium text-[#1a7a44] hover:underline"
                        title="Open outbound order"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="text-xs text-slate-500">{dateFmt(order.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {order.companyName} - {order.status}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
