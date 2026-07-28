import { useMemo, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Alert } from '@ds';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { formatDate, formatDecimal } from '../lib/billing-display';
import { buildBillingRestrictionCopy } from '../lib/client-billing-restriction';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientBillingSummary } from '../services/clientBillingService';
import { fetchClientDashboardOverview } from '../services/clientDashboardService';
import { fetchClientInboundOrders } from '../services/clientInboundOrdersService';
import { fetchClientOutboundOrders } from '../services/clientOutboundOrdersService';
import { fetchStockPage } from '../services/stockService';

const SALES_EMAIL = 'sales@emdadsy.com';
const CURRENCY = 'SYP';

const INCLUDED_FEATURES = [
  'OMS',
  'WMS',
  'Inventory Management',
  'Returns Management',
  'Client Portal',
  'Barcode Support',
  'Reporting',
  'Notifications',
] as const;

function tLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Billing: 'الفوترة',
    'Manage your subscription and resource usage': 'إدارة اشتراكك واستخدام الموارد',
    'Could not load billing': 'تعذر تحميل الفوترة',
    Retry: 'إعادة المحاولة',
    'No active billing plan on file.': 'لا توجد خطة فوترة نشطة.',
    'Contact your account manager to set up a subscription.':
      'تواصل مع مدير حسابك لإعداد الاشتراك.',
    'Important notices': 'تنبيهات مهمة',
    'Current subscription': 'الاشتراك الحالي',
    'Monthly Plan': 'الخطة الشهرية',
    'Quarterly Plan': 'الخطة الربع سنوية',
    'Yearly Plan': 'الخطة السنوية',
    'Warehouse Plan': 'خطة المستودع',
    'Includes reserved warehouse capacity and fulfillment services.':
      'تشمل سعة مستودع محجوزة وخدمات تنفيذ الطلبات.',
    Active: 'نشط',
    Expiring: 'ينتهي قريبًا',
    Suspended: 'موقوف',
    Monthly: 'شهري',
    Quarterly: 'ربع سنوي',
    Yearly: 'سنوي',
    days: 'يوم',
    'Next billing': 'الفوترة التالية',
    Price: 'السعر',
    'Billing cycle': 'دورة الفوترة',
    'Auto-renewal': 'التجديد التلقائي',
    Limit: 'الحد',
    Progress: 'التقدم',
    On: 'مفعّل',
    Off: 'متوقف',
    'Upgrade plan': 'ترقية الخطة',
    'Contact sales': 'تواصل مع المبيعات',
    'Current resource usage': 'استخدام الموارد الحالي',
    'Live utilization of your subscription': 'الاستخدام الحي لاشتراكك',
    Inventory: 'المخزون',
    'Total items': 'إجمالي الوحدات',
    'Total SKUs': 'إجمالي المنتجات',
    'Orders this billing cycle': 'طلبات دورة الفوترة الحالية',
    'Total orders': 'إجمالي الطلبات',
    Inbound: 'وارد',
    Outbound: 'صادر',
    'Warehouse capacity': 'سعة المستودع',
    Used: 'مستخدم',
    Remaining: 'متبقي',
    'Subscription limits': 'حدود الاشتراك',
    'Usage against your plan entitlements': 'الاستخدام مقابل استحقاقات خطتك',
    'Warehouse volume': 'حجم المستودع',
    Products: 'المنتجات',
    Users: 'المستخدمون',
    'Monthly orders': 'الطلبات الشهرية',
    'Current usage': 'الاستخدام الحالي',
    'Maximum limit': 'الحد الأقصى',
    Unlimited: 'غير محدود',
    'Next invoice preview': 'معاينة الفاتورة التالية',
    'Estimated amount': 'المبلغ التقديري',
    'Estimated billing date': 'تاريخ الفوترة التقديري',
    'Payment method': 'طريقة الدفع',
    'Manual settlement': 'تسوية يدوية',
    'View all invoices': 'عرض كل الفواتير',
    'Included features': 'الميزات المشمولة',
    'What your subscription unlocks': 'ما يتيحه اشتراكك',
    OMS: 'نظام الطلبات',
    WMS: 'نظام المستودع',
    'Inventory Management': 'إدارة المخزون',
    'Returns Management': 'إدارة المرتجعات',
    'Client Portal': 'بوابة العميل',
    'Barcode Support': 'دعم الباركود',
    Reporting: 'التقارير',
    Notifications: 'الإشعارات',
    'm³': 'م³',
  };
  return ar[label] ?? label;
}

function accountBadgeStatus(status: string): string {
  if (status === 'restricted') return 'suspended';
  if (status === 'expiring') return 'pending';
  return 'active';
}

function subscriptionStatusLabel(accountStatus: string, t: (s: string) => string): string {
  if (accountStatus === 'restricted') return t('Suspended');
  if (accountStatus === 'expiring') return t('Expiring');
  return t('Active');
}

function cycleCadence(days: number | undefined, t: (s: string) => string): string {
  if (days == null) return '—';
  if (days === 30 || days === 31) return t('Monthly');
  if (days === 90) return t('Quarterly');
  if (days === 365 || days === 366) return t('Yearly');
  return `${days} ${t('days')}`;
}

function planDisplayName(days: number | undefined, t: (s: string) => string): string {
  if (days === 30 || days === 31) return t('Monthly Plan');
  if (days === 90) return t('Quarterly Plan');
  if (days === 365 || days === 366) return t('Yearly Plan');
  return t('Warehouse Plan');
}

function inCycle(iso: string, start?: string | null, end?: string | null): boolean {
  if (!start || !end) return true;
  const t = new Date(iso).getTime();
  return t >= new Date(start).getTime() && t <= new Date(end).getTime();
}

function pctUsed(used: number, max: number | null): number | null {
  if (max == null || !Number.isFinite(max) || max <= 0) return null;
  if (!Number.isFinite(used)) return 0;
  return Math.min(100, Math.round((used / max) * 1000) / 10);
}

function ProgressBar({
  percent,
  tone = 'emerald',
}: {
  percent: number | null;
  tone?: 'emerald' | 'amber' | 'rose' | 'sky';
}): ReactElement {
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const bar =
    tone === 'amber'
      ? 'bg-amber-500'
      : tone === 'rose'
        ? 'bg-rose-500'
        : tone === 'sky'
          ? 'bg-sky-500'
          : 'bg-emerald-500';
  const level = percent == null ? 'emerald' : percent >= 90 ? 'rose' : percent >= 70 ? 'amber' : tone;
  const fill =
    level === 'rose' ? 'bg-rose-500' : level === 'amber' ? 'bg-amber-500' : bar;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{ width: `${p}%` }} />
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }): ReactElement {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
    </div>
  );
}

function StatCard({
  icon,
  iconTone,
  label,
  children,
}: {
  icon: string;
  iconTone: string;
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className="p-5" hover>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconTone}`}>
          <i className={`fa-solid ${icon} text-xs`} />
        </div>
        {label}
      </div>
      {children}
    </Card>
  );
}

export function BillingPage(): ReactElement {
  const isArabic = isClientArabic();
  const t = (label: string) => tLabel(label, isArabic);

  const summaryQuery = useQuery({
    queryKey: ['client', 'billing', 'summary'],
    queryFn: fetchClientBillingSummary,
  });

  const overviewQuery = useQuery({
    queryKey: ['client', 'dashboard', 'overview'],
    queryFn: fetchClientDashboardOverview,
  });

  const stockQuery = useQuery({
    queryKey: ['client', 'billing', 'stock-usage'],
    queryFn: () => fetchStockPage({ limit: 200, offset: 0 }),
  });

  const summary = summaryQuery.data;
  const plan = summary?.plan ?? null;
  const cycle = summary?.currentCycle ?? null;
  const storage = overviewQuery.data?.storage;
  const cycleStart = cycle?.startsAt;
  const cycleEnd = cycle?.endsAt;

  const inboundQuery = useQuery({
    queryKey: ['client', 'billing', 'inbound-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientInboundOrders({ limit: 200, offset: 0 }),
    enabled: !!plan,
  });

  const outboundQuery = useQuery({
    queryKey: ['client', 'billing', 'outbound-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientOutboundOrders({ limit: 200, offset: 0 }),
    enabled: !!plan,
  });

  const notice =
    summary != null
      ? buildBillingRestrictionCopy(
          summary.accountStatus === 'restricted'
            ? 'restricted'
            : summary.accountStatus === 'expiring'
              ? 'expiring'
              : plan
                ? 'active'
                : 'no_plan',
          summary.daysRemaining,
          isArabic,
        )
      : null;

  const usedVolume = Number(storage?.usedVolumeCbm ?? 0);
  const totalVolume = Number(
    storage?.reservedVolumeCbm ?? summary?.reservedVolume ?? plan?.reservedVolume ?? 0,
  );
  const volumePct = pctUsed(usedVolume, totalVolume > 0 ? totalVolume : null);
  const remainingVolume =
    storage?.remainingVolumeCbm != null
      ? Number(storage.remainingVolumeCbm)
      : totalVolume > 0
        ? Math.max(0, totalVolume - usedVolume)
        : null;

  const skuCount = stockQuery.data?.total ?? overviewQuery.data?.productsCount ?? 0;
  const totalItems = useMemo(() => {
    const rows = stockQuery.data?.items ?? [];
    return rows.reduce((sum, row) => sum + (Number(row.onHand) || 0), 0);
  }, [stockQuery.data]);

  const inboundCycle = useMemo(() => {
    const rows = inboundQuery.data?.items ?? [];
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length;
  }, [inboundQuery.data, cycleStart, cycleEnd]);

  const outboundCycle = useMemo(() => {
    const rows = outboundQuery.data?.items ?? [];
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length;
  }, [outboundQuery.data, cycleStart, cycleEnd]);

  const ordersTotal = inboundCycle + outboundCycle;

  const orderChartData = [
    { name: t('Inbound'), count: inboundCycle, fill: '#10B981' },
    { name: t('Outbound'), count: outboundCycle, fill: '#0EA5E9' },
  ];

  const capacityDonut = [
    { name: t('Used'), value: Math.max(0, usedVolume), fill: '#10B981' },
    {
      name: t('Remaining'),
      value: Math.max(0, remainingVolume ?? Math.max(0, totalVolume - usedVolume)),
      fill: '#E2E8F0',
    },
  ];

  const productsCount = overviewQuery.data?.productsCount ?? skuCount;
  const productsPct = null; // no product cap from API
  const ordersPct = null; // no monthly order cap from API

  const autoRenewOn = cycle?.status === 'active' || cycle?.status === 'renewed';
  const estimatedAmount =
    summary?.currentInvoice?.grandTotal ??
    summary?.currentInvoice?.totalAmount ??
    plan?.fixedSubscriptionFee ??
    null;
  const estimatedDate = cycle?.endsAt ?? null;

  const upgradeHref = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Upgrade plan request')}`;
  const salesHref = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Sales inquiry')}`;

  const limits = [
    {
      key: 'volume',
      label: t('Warehouse volume'),
      usage: `${formatDecimal(usedVolume, 2)} ${t('m³')}`,
      max:
        totalVolume > 0 ? `${formatDecimal(totalVolume, 2)} ${t('m³')}` : t('Unlimited'),
      percent: volumePct,
    },
    {
      key: 'products',
      label: t('Products'),
      usage: String(productsCount),
      max: t('Unlimited'),
      percent: productsPct,
    },
    {
      key: 'users',
      label: t('Users'),
      usage: '—',
      max: t('Unlimited'),
      percent: null as number | null,
    },
    {
      key: 'orders',
      label: t('Monthly orders'),
      usage: String(ordersTotal),
      max: t('Unlimited'),
      percent: ordersPct,
    },
  ];

  return (
    <div className="space-y-5 animate-enter">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <i className="fa-solid fa-file-invoice-dollar text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('Billing')}</h1>
          <p className="text-xs text-slate-500">{t('Manage your subscription and resource usage')}</p>
        </div>
      </div>

      {summaryQuery.isError ? (
        <Alert
          variant="error"
          title={t('Could not load billing')}
          action={
            <Alert.Action variant="error" onClick={() => summaryQuery.refetch()}>
              {t('Retry')}
            </Alert.Action>
          }
        />
      ) : null}

      {notice?.showBanner ? (
        <Card
          className={[
            'p-4 border-l-[3px]',
            notice.variant === 'error'
              ? 'border-l-rose-500 bg-rose-50/40'
              : notice.variant === 'warning'
                ? 'border-l-amber-500 bg-amber-50/40'
                : 'border-l-sky-500 bg-sky-50/40',
          ].join(' ')}
        >
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            {t('Important notices')}
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{notice.title}</h3>
          <p className="text-sm text-slate-600 mt-1">{notice.description}</p>
        </Card>
      ) : null}

      {!summaryQuery.isPending && !plan ? (
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-file-invoice-dollar text-2xl text-slate-300" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">{t('No active billing plan on file.')}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {t('Contact your account manager to set up a subscription.')}
          </p>
          <a
            href={salesHref}
            className="inline-flex mt-4 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            {t('Contact sales')}
          </a>
        </Card>
      ) : (
        <>
          {/* Section 1 — Current Subscription */}
          <Card className="p-6 border-l-[3px] border-l-emerald-500" hover>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  {t('Current subscription')}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {plan ? planDisplayName(plan.cycleLengthDays, t) : '…'}
                  </h2>
                  {summary ? (
                    <Badge status={accountBadgeStatus(summary.accountStatus)}>
                      {subscriptionStatusLabel(summary.accountStatus, t)}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500 mt-2 max-w-xl">
                  {t('Includes reserved warehouse capacity and fulfillment services.')}
                  {totalVolume > 0
                    ? ` ${formatDecimal(totalVolume, 2)} ${t('m³')}.`
                    : ''}
                </p>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">{t('Price')}</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {plan ? formatDecimal(plan.fixedSubscriptionFee) : '—'}{' '}
                      <span className="text-sm font-normal text-slate-400">{CURRENCY}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{t('Billing cycle')}</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">
                      {cycleCadence(plan?.cycleLengthDays, t)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{t('Next billing')}</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">
                      {formatDate(estimatedDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{t('Auto-renewal')}</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">
                      {cycle ? (autoRenewOn ? t('On') : t('Off')) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                <a
                  href={upgradeHref}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  <i className="fa-solid fa-arrow-up-right-dots text-xs" />
                  {t('Upgrade plan')}
                </a>
                <a
                  href={salesHref}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <i className="fa-solid fa-headset text-xs" />
                  {t('Contact sales')}
                </a>
              </div>
            </div>
          </Card>

          {/* Section 2 — Current Resource Usage */}
          <div>
            <SectionHeader
              title={t('Current resource usage')}
              subtitle={t('Live utilization of your subscription')}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                icon="fa-boxes-stacked"
                iconTone="bg-sky-50 text-sky-600"
                label={t('Inventory')}
              >
                <div className="text-2xl font-bold text-slate-900">{formatDecimal(totalItems, 0)}</div>
                <div className="text-xs text-slate-500 mt-1">{t('Total items')}</div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm">
                  <span className="text-slate-500">{t('Total SKUs')}</span>
                  <span className="font-semibold text-slate-900">{skuCount}</span>
                </div>
              </StatCard>

              <StatCard
                icon="fa-truck-fast"
                iconTone="bg-amber-50 text-amber-600"
                label={t('Orders this billing cycle')}
              >
                <div className="text-2xl font-bold text-slate-900">{ordersTotal}</div>
                <div className="text-xs text-slate-500 mt-1">{t('Total orders')}</div>
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('Inbound')}</span>
                    <span className="font-semibold text-slate-900">{inboundCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('Outbound')}</span>
                    <span className="font-semibold text-slate-900">{outboundCycle}</span>
                  </div>
                </div>
              </StatCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('Warehouse capacity')}</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={capacityDonut}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {capacityDonut.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `${formatDecimal(Number(value), 2)} ${t('m³')}`}
                        contentStyle={{
                          borderRadius: 10,
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-xs text-slate-500 -mt-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {t('Used')}: {formatDecimal(usedVolume, 2)} {t('m³')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-200" />
                    {t('Remaining')}:{' '}
                    {remainingVolume != null ? formatDecimal(remainingVolume, 2) : '—'} {t('m³')}
                  </span>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  {t('Orders this billing cycle')}
                </h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orderChartData} barSize={36}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)',
                        }}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {orderChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>

          {/* Section 3 — Subscription Limits */}
          <div>
            <SectionHeader
              title={t('Subscription limits')}
              subtitle={t('Usage against your plan entitlements')}
            />
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
                    <tr>
                      <th className="px-5 py-3 text-left">{t('Limit')}</th>
                      <th className="px-5 py-3 text-left">{t('Current usage')}</th>
                      <th className="px-5 py-3 text-left">{t('Maximum limit')}</th>
                      <th className="px-5 py-3 text-left min-w-[140px]">{t('Progress')}</th>
                      <th className="px-5 py-3 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {limits.map((row) => (
                      <tr key={row.key}>
                        <td className="px-5 py-3.5 font-medium text-slate-900">{row.label}</td>
                        <td className="px-5 py-3.5 text-slate-700 tabular-nums">{row.usage}</td>
                        <td className="px-5 py-3.5 text-slate-600">{row.max}</td>
                        <td className="px-5 py-3.5">
                          <ProgressBar percent={row.percent} />
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-500 tabular-nums">
                          {row.percent != null ? `${row.percent}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Section 4 — Next Invoice Preview */}
          <div>
            <SectionHeader title={t('Next invoice preview')} />
            <Card className="p-6" hover>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 flex-1">
                  <div>
                    <div className="text-xs text-slate-500">{t('Estimated amount')}</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {estimatedAmount != null ? formatDecimal(estimatedAmount) : '—'}{' '}
                      <span className="text-sm font-normal text-slate-400">{CURRENCY}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{t('Estimated billing date')}</div>
                    <div className="text-sm font-semibold text-slate-900 mt-2">
                      {formatDate(estimatedDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{t('Payment method')}</div>
                    <div className="text-sm font-semibold text-slate-900 mt-2">
                      {t('Manual settlement')}
                    </div>
                  </div>
                </div>
                <Link
                  to="/invoices"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors shrink-0"
                >
                  <i className="fa-solid fa-file-invoice text-xs" />
                  {t('View all invoices')}
                </Link>
              </div>
            </Card>
          </div>

          {/* Section 5 — Included Features */}
          <div>
            <SectionHeader
              title={t('Included features')}
              subtitle={t('What your subscription unlocks')}
            />
            <Card className="p-5">
              <div className="flex flex-wrap gap-2">
                {INCLUDED_FEATURES.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100"
                  >
                    <i className="fa-solid fa-check text-[10px]" />
                    {t(feature)}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
