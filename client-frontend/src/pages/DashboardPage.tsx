import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Alert, EmptyState } from '@ds';

import { ClientRecentInvoicesCard } from '../components/ClientRecentInvoicesCard';
import { useAuth } from '../auth/AuthContext';
import { formatDecimal } from '../lib/billing-display';
import { isClientArabic } from '../lib/client-ui-language';
import { isClientAdmin } from '../lib/rbac';
import { fetchClientDashboardOverview } from '../services/clientDashboardService';

function roleLabel(role: string): string {
  if (role === 'client_staff') return 'Client staff';
  if (role === 'client_admin') return 'Client administrator';
  return role;
}

function dashboardLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Dashboard: 'لوحة التحكم',
    'Welcome back': 'مرحبًا بعودتك',
    Name: 'الاسم',
    Email: 'البريد',
    Role: 'الدور',
    Company: 'الشركة',
    'Storage Utilization': 'استخدام التخزين',
    'Stock Volume': 'حجم المخزون',
    'Reserved Volume': 'الحجم المحجوز',
    'Reserved Weight': 'الوزن المحجوز',
    'Products Count': 'عدد المنتجات',
    'Inbound Orders': 'طلبات الوارد',
    'Outbound Orders': 'طلبات الصادر',
    'Active Orders': 'الطلبات النشطة',
    'Expiring Products': 'منتجات تنتهي صلاحيتها',
    'Days Until Billing Expiration': 'أيام حتى انتهاء الفوترة',
    'Current Invoice Amount': 'مبلغ الفاتورة الحالية',
    'Recent invoices': 'الفواتير الأخيرة',
    'View all invoices': 'عرض كل الفواتير',
    'No recent invoices': 'لا توجد فواتير حديثة',
    'Invoices appear here after your billing cycle closes.':
      'تظهر الفواتير هنا بعد إغلاق دورة الفوترة.',
    'Loading…': 'جاري التحميل…',
    'Get started with your portal': 'ابدأ باستخدام البوابة',
    'Create an inbound order or add products to see activity here.':
      'أنشئ طلب وارد أو أضف منتجات لرؤية النشاط هنا.',
    'New inbound order': 'طلب وارد جديد',
    CBM: 'م³',
    kg: 'كغ',
    'Could not load dashboard': 'تعذر تحميل لوحة التحكم',
    'Loading dashboard…': 'جاري تحميل لوحة التحكم…',
    'No billing plan': 'لا توجد خطة فوترة',
    days: 'يوم',
  };
  return ar[label] ?? label;
}

const statCardClass =
  'rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-slate-200 hover:shadow-md sm:p-4';

function StatWidget({
  title,
  value,
  hint,
  to,
  iconClass,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  iconClass: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{title}</p>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
          aria-hidden="true"
        >
          <i className={`${iconClass} text-sm`} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${statCardClass} block no-underline text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}>
        {inner}
      </Link>
    );
  }

  return <div className={statCardClass}>{inner}</div>;
}

export function DashboardPage(): ReactElement {
  const { user } = useAuth();
  const isArabic = isClientArabic();
  const t = (label: string) => dashboardLabel(label, isArabic);
  const showBilling = isClientAdmin(user?.role);

  const overview = useQuery({
    queryKey: ['client', 'dashboard', 'overview'],
    queryFn: fetchClientDashboardOverview,
  });

  const displayName = user?.fullName?.trim() || user?.email || 'Client';
  const data = overview.data;

  const utilization = data?.storage.utilizationPercent;
  const usedVolume = data ? formatDecimal(data.storage.usedVolumeCbm, 2) : '—';
  const usedWeight = data ? formatDecimal(data.storage.usedWeightKg, 2) : '—';
  const reservedVolume = data?.storage.reservedVolumeCbm
    ? formatDecimal(data.storage.reservedVolumeCbm, 2)
    : '—';
  const reservedWeight = data?.storage.reservedWeightKg
    ? formatDecimal(data.storage.reservedWeightKg, 2)
    : '—';

  const isEmptyDashboard =
    !overview.isPending &&
    data != null &&
    data.activeOrders === 0 &&
    data.productsCount === 0 &&
    Number(data.storage.usedVolumeCbm) === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{t('Dashboard')}</h1>
          <p className="text-sm text-slate-500">
            {t('Welcome back')}, {displayName}
          </p>
        </div>
      </div>

      {overview.isError ? (
        <Alert
          variant="error"
          title={t('Could not load dashboard')}
          action={
            <Alert.Action variant="error" onClick={() => overview.refetch()}>
              Retry
            </Alert.Action>
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <section className="card card--narrow lg:max-w-sm">
          <h2 className="card__title">{displayName}</h2>
          {user ? (
            <dl className="details">
              <div className="details__row">
                <dt>{t('Name')}</dt>
                <dd>{user.fullName || '—'}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Email')}</dt>
                <dd>{user.email ?? '—'}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Role')}</dt>
                <dd>{roleLabel(user.role)}</dd>
              </div>
              <div className="details__row">
                <dt>{t('Company')}</dt>
                <dd>{user.companyName || '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">{t('Loading dashboard…')}</p>
          )}
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatWidget
            title={t('Storage Utilization')}
            value={utilization != null ? `${utilization}%` : '—'}
            hint={
              utilization != null ? (
                <span className="block">
                  <span
                    className="mt-1 block h-2 overflow-hidden rounded-full bg-slate-100"
                    role="presentation"
                  >
                    <span
                      className="block h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, utilization)}%` }}
                    />
                  </span>
                  <span className="mt-1 block text-[11px]">
                    {usedVolume} / {reservedVolume} {t('CBM')}
                  </span>
                </span>
              ) : (
                `${usedVolume} ${t('CBM')}`
              )
            }
            iconClass="fa-solid fa-chart-pie"
          />
          <StatWidget
            title={t('Stock Volume')}
            value={overview.isPending ? '…' : `${usedVolume} ${t('CBM')}`}
            hint={`${usedWeight} ${t('kg')}`}
            to="/stock"
            iconClass="fa-solid fa-warehouse"
          />
          <StatWidget
            title={t('Reserved Volume')}
            value={reservedVolume === '—' ? '—' : `${reservedVolume} ${t('CBM')}`}
            iconClass="fa-solid fa-cube"
          />
          <StatWidget
            title={t('Reserved Weight')}
            value={reservedWeight === '—' ? '—' : `${reservedWeight} ${t('kg')}`}
            iconClass="fa-solid fa-weight-hanging"
          />
          <StatWidget
            title={t('Products Count')}
            value={overview.isPending ? '…' : (data?.productsCount ?? 0).toLocaleString()}
            to={showBilling ? '/products' : '/stock'}
            iconClass="fa-solid fa-boxes-stacked"
          />
          <StatWidget
            title={t('Inbound Orders')}
            value={overview.isPending ? '…' : (data?.openInboundOrders ?? 0).toLocaleString()}
            to="/inbound-orders"
            iconClass="fa-solid fa-arrow-down"
          />
          <StatWidget
            title={t('Outbound Orders')}
            value={overview.isPending ? '…' : (data?.openOutboundOrders ?? 0).toLocaleString()}
            to="/outbound-orders"
            iconClass="fa-solid fa-arrow-up"
          />
          <StatWidget
            title={t('Active Orders')}
            value={overview.isPending ? '…' : (data?.activeOrders ?? 0).toLocaleString()}
            to="/inbound-orders"
            iconClass="fa-solid fa-clipboard-list"
          />
          <StatWidget
            title={t('Expiring Products')}
            value={overview.isPending ? '…' : (data?.expiringProductsCount ?? 0).toLocaleString()}
            to="/stock"
            iconClass="fa-solid fa-hourglass-half"
          />
          {showBilling ? (
            <>
              <StatWidget
                title={t('Days Until Billing Expiration')}
                value={
                  overview.isPending
                    ? '…'
                    : data?.billing?.daysUntilExpiration != null
                      ? `${Math.max(0, data.billing.daysUntilExpiration)} ${t('days')}`
                      : '—'
                }
                hint={data?.billing == null ? t('No billing plan') : undefined}
                to="/billing"
                iconClass="fa-solid fa-calendar-days"
              />
              <StatWidget
                title={t('Current Invoice Amount')}
                value={
                  overview.isPending
                    ? '…'
                    : data?.billing?.currentInvoiceAmount != null
                      ? formatDecimal(data.billing.currentInvoiceAmount)
                      : '—'
                }
                to="/billing"
                iconClass="fa-solid fa-file-invoice-dollar"
              />
            </>
          ) : null}
        </section>
      </div>

      {showBilling ? (
        <ClientRecentInvoicesCard
          rows={data?.recentInvoices ?? []}
          loading={overview.isPending}
          translateLabel={t}
        />
      ) : null}

      {isEmptyDashboard ? (
        <section className="card">
          <EmptyState
            icon={<i className="fa-solid fa-truck-ramp-box text-2xl" aria-hidden="true" />}
            title={t('Get started with your portal')}
            description={t('Create an inbound order or add products to see activity here.')}
            action={
              <Link to="/inbound-orders" className="btn btn--primary">
                {t('New inbound order')}
              </Link>
            }
          />
        </section>
      ) : null}
    </div>
  );
}
