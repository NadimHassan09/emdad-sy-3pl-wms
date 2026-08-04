import { useMemo, type ReactElement, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { Alert } from '@ds';

import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { formatDate, formatDecimal } from '../lib/billing-display';
import { buildBillingRestrictionCopy } from '../lib/client-billing-restriction';
import { isClientArabic } from '../lib/client-ui-language';
import { CopyEmailButton } from '../components/CopyEmailButton';
import { fetchClientBillingSummary } from '../services/clientBillingService';
import { fetchClientDashboardOverview } from '../services/clientDashboardService';
import { fetchClientInboundOrders } from '../services/clientInboundOrdersService';
import { fetchClientOmsOrders } from '../services/clientOmsOrdersService';
import { fetchClientOutboundOrders } from '../services/clientOutboundOrdersService';
import { fetchClientReturns } from '../services/clientReturnsService';
import { fetchStockPage } from '../services/stockService';

const SALES_EMAIL = 'sales@emdadsy.com';
const CURRENCY = 'SYP';

const INCLUDED_FEATURES = ['OMS', 'WMS'] as const;

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
    Capacity: 'السعة',
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
    'OMS orders this billing cycle': 'طلبات إلكترونية في دورة الفوترة',
    'Total OMS orders': 'إجمالي الطلبات الإلكترونية',
    'Returns this billing cycle': 'مرتجعات دورة الفوترة الحالية',
    'Total returns': 'إجمالي المرتجعات',
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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }): ReactElement {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-text-strong">{title}</h2>
      {subtitle ? <p className="text-xs text-text-muted mt-0.5">{subtitle}</p> : null}
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
      <div className="flex items-center gap-2 text-sm font-medium text-text-muted mb-3">
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

  const omsQuery = useQuery({
    queryKey: ['client', 'billing', 'oms-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientOmsOrders({ limit: 200, offset: 0 }),
    enabled: !!plan,
  });

  const returnsQuery = useQuery({
    queryKey: ['client', 'billing', 'returns-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientReturns({ limit: 200, offset: 0 }),
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

  const omsCycle = useMemo(() => {
    const rows = omsQuery.data?.items ?? [];
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length;
  }, [omsQuery.data, cycleStart, cycleEnd]);

  const returnsCycle = useMemo(() => {
    const rows = returnsQuery.data?.items ?? [];
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length;
  }, [returnsQuery.data, cycleStart, cycleEnd]);

  const ordersTotal = inboundCycle + outboundCycle;

  const capacityDonut = [
    { name: t('Used'), value: Math.max(0, usedVolume), fill: 'var(--color-brand-500)' },
    {
      name: t('Remaining'),
      value: Math.max(0, remainingVolume ?? Math.max(0, totalVolume - usedVolume)),
      fill: 'var(--border-strong)',
    },
  ];

  const estimatedDate = cycle?.endsAt ?? null;
  // Avoid `mailto:` so browsers don't prompt to open other apps on the user's device.
  const salesCopyText = SALES_EMAIL;

  return (
    <div className="space-y-5 animate-enter">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-white/5 flex items-center justify-center">
          <i className="fa-solid fa-file-invoice-dollar text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-strong">{t('Billing')}</h1>
          <p className="text-xs text-text-muted">{t('Manage your subscription and resource usage')}</p>
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
              ? 'border-l-status-danger-fg bg-status-danger-bg'
              : notice.variant === 'warning'
                ? 'border-l-status-warning-fg bg-status-warning-bg'
                : 'border-l-status-info-fg bg-status-info-bg',
          ].join(' ')}
        >
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
            {t('Important notices')}
            </div>
          <h3 className="text-sm font-semibold text-text-strong">{notice.title}</h3>
          <p className="text-sm text-text-body mt-1">{notice.description}</p>
        </Card>
            ) : null}

      {!summaryQuery.isPending && !plan ? (
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-sunken flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-file-invoice-dollar text-2xl text-text-faint" />
          </div>
          <h3 className="text-base font-semibold text-text-strong">{t('No active billing plan on file.')}</h3>
          <p className="text-sm text-text-muted mt-1">
            {t('Contact your account manager to set up a subscription.')}
          </p>
          <CopyEmailButton
            copyText={salesCopyText}
            copiedLabel={t('Copied')}
            className="inline-flex mt-4 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-on-brand bg-cta hover:bg-cta-hover transition-colors cursor-pointer"
          >
            {t('Contact sales')}
          </CopyEmailButton>
        </Card>
      ) : (
        <>
          {/* Section 1 — Current Subscription */}
          <Card className="p-6 border-l-[3px] border-l-brand-500" hover>
            <div className="min-w-0">
              <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                {t('Current subscription')}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-text-strong">
                  {plan ? planDisplayName(plan.cycleLengthDays, t) : '…'}
                </h2>
                {summary ? (
                  <Badge status={accountBadgeStatus(summary.accountStatus)}>
                    {subscriptionStatusLabel(summary.accountStatus, t)}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-text-muted">{t('Price')}</div>
                  <div className="text-lg font-bold text-text-strong mt-0.5">
                    {plan ? formatDecimal(plan.fixedSubscriptionFee) : '—'}{' '}
                    <span className="text-sm font-normal text-text-faint">{CURRENCY}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">{t('Billing cycle')}</div>
                  <div className="text-sm font-semibold text-text-strong mt-1">
                    {cycleCadence(plan?.cycleLengthDays, t)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">{t('Next billing')}</div>
                  <div className="text-sm font-semibold text-text-strong mt-1">
                    {formatDate(estimatedDate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">{t('Capacity')}</div>
                  <div className="text-sm font-semibold text-text-strong mt-1">
                    {totalVolume > 0
                      ? `${formatDecimal(totalVolume, 2)} ${t('m³')}`
                      : '—'}
                  </div>
                </div>
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
                iconTone="bg-status-info-bg text-status-info-fg"
                label={t('Inventory')}
              >
                <div className="text-2xl font-bold text-text-strong">{formatDecimal(totalItems, 0)}</div>
                <div className="text-xs text-text-muted mt-1">{t('Total items')}</div>
                <div className="mt-3 pt-3 border-t border-border-subtle flex justify-between text-sm">
                  <span className="text-text-muted">{t('Total SKUs')}</span>
                  <span className="font-semibold text-text-strong">{skuCount}</span>
                </div>
              </StatCard>

              <StatCard
                icon="fa-truck-fast"
                iconTone="bg-status-warning-bg text-status-warning-fg"
                label={t('Orders this billing cycle')}
              >
                <div className="text-2xl font-bold text-text-strong">{ordersTotal}</div>
                <div className="text-xs text-text-muted mt-1">{t('Total orders')}</div>
                <div className="mt-3 pt-3 border-t border-border-subtle space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('Inbound')}</span>
                    <span className="font-semibold text-text-strong">{inboundCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('Outbound')}</span>
                    <span className="font-semibold text-text-strong">{outboundCycle}</span>
                  </div>
                </div>
              </StatCard>

              <StatCard
                icon="fa-cart-shopping"
                iconTone="bg-brand-50 text-brand-700 dark:bg-white/5 dark:text-brand-400"
                label={t('OMS orders this billing cycle')}
              >
                <div className="text-2xl font-bold text-text-strong">{omsCycle}</div>
                <div className="text-xs text-text-muted mt-1">{t('Total OMS orders')}</div>
              </StatCard>

              <StatCard
                icon="fa-rotate-left"
                iconTone="bg-status-danger-bg text-status-danger-fg"
                label={t('Returns this billing cycle')}
              >
                <div className="text-2xl font-bold text-text-strong">{returnsCycle}</div>
                <div className="text-xs text-text-muted mt-1">{t('Total returns')}</div>
              </StatCard>
            </div>

            <div className="mt-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-text-strong mb-4">{t('Warehouse capacity')}</h3>
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
                          border: '1px solid var(--border-default)',
                          background: 'var(--surface-panel)',
                          color: 'var(--text-strong)',
                          boxShadow: 'var(--shadow-md)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-xs text-text-muted -mt-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                    {t('Used')}: {formatDecimal(usedVolume, 2)} {t('m³')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-border-strong" />
                    {t('Remaining')}:{' '}
                    {remainingVolume != null ? formatDecimal(remainingVolume, 2) : '—'} {t('m³')}
                  </span>
                </div>
              </Card>
            </div>
          </div>

          {/* Section 3 — Included Features */}
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-white/5 text-brand-800 dark:text-brand-400 border border-brand-100 dark:border-white/10"
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
