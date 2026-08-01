import { useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Alert, Button, ListPageHeader, Skeleton } from '@ds';

import { useAuth } from '../auth/AuthContext';
import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import {
  clientNotificationHref,
  fetchClientNotifications,
} from '../services/clientNotificationsService';
import {
  fetchClientCodReport,
  fetchClientOmsOrders,
  type ClientOmsOrderStatus,
} from '../services/clientOmsOrdersService';
import { fetchClientProducts } from '../services/clientProductsService';
import { fetchClientReturns } from '../services/clientReturnsService';
import { fetchStockPage } from '../services/stockService';

const SUPPORT_EMAIL = 'support@emdadsy.com';

/** Status buckets matching the approved Emdad Order Summary row. */
const UNPROCESSED = new Set<ClientOmsOrderStatus>(['draft', 'pending_approval', 'approved', 'confirmed']);
const PROCESSING = new Set<ClientOmsOrderStatus>(['processing', 'allocated', 'picking', 'packing', 'ready_to_ship']);
const OUT_FOR_DELIVERY = new Set<ClientOmsOrderStatus>(['out_for_delivery', 'shipped']);
const DELIVERED = new Set<ClientOmsOrderStatus>(['delivered', 'completed']);
/** True returns only — do not mix cancelled / rejected / failed_delivery into “Returned”. */
const RETURNED = new Set<ClientOmsOrderStatus>(['returned']);
const CANCELLED_OR_FAILED = new Set<ClientOmsOrderStatus>(['cancelled', 'rejected', 'failed_delivery']);
/** Orders that need merchant/ops attention (not a vanity “latest 8”). */
const NEEDS_ATTENTION = new Set<ClientOmsOrderStatus>([
  ...UNPROCESSED,
  'failed_delivery',
]);

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function sumAmounts(items: Array<{ codAmount: string | null }>): number {
  return items.reduce((acc, row) => acc + (Number(row.codAmount) || 0), 0);
}

function formatMoney(amount: number, currency: string | null | undefined, locale: string): string {
  const cur = currency?.trim() || '';
  const n = amount.toLocaleString(locale, { maximumFractionDigits: 0 });
  return cur ? `${n} ${cur}` : n;
}

function inventoryStatus(available: number, threshold: number): 'available' | 'low' | 'out' {
  if (available <= 0) return 'out';
  const lowAt = threshold > 0 ? threshold : 5;
  if (available <= lowAt) return 'low';
  return 'available';
}

function tr(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Dashboard: 'لوحة التحكم',
    'Welcome back': 'مرحبًا بعودتك',
    'New order': 'طلب جديد',
    'View COD': 'عرض التحصيل',
    'Needs attention': 'تحتاج متابعة',
    'Stuck or awaiting action': 'عالق أو بانتظار إجراء',
    'Sellable stock': 'المخزون القابل للبيع',
    'Units available to sell': 'وحدات متاحة للبيع',
    'Low-stock SKUs': 'أصناف منخفضة المخزون',
    'Cash on delivery': 'الدفع عند الاستلام',
    'Ready vs pending': 'جاهز مقابل معلّق',
    'Pending collection': 'بانتظار التحصيل',
    'View cash on delivery': 'عرض الدفع عند الاستلام',
    'Order movement': 'حركة الطلبات',
    'Last 7 days': 'آخر 7 أيام',
    'Order summary': 'ملخص الطلبات',
    'Where are my orders?': 'أين طلباتي؟',
    Unprocessed: 'غير معالج',
    Processing: 'قيد المعالجة',
    'Out for delivery': 'خارج للتسليم',
    Delivered: 'تم التسليم',
    Returned: 'مرتجع',
    'Cancelled / failed': 'ملغي / فشل',
    'This month': 'هذا الشهر',
    'Last month': 'الشهر الماضي',
    All: 'الكل',
    'Sales channel': 'قناة البيع',
    'Live inventory': 'المخزون الحالي',
    'What inventory do I have?': 'ما المخزون المتاح لدي؟',
    Product: 'المنتج',
    SKU: 'رمز SKU',
    Available: 'المتاح',
    Reserved: 'المحجوز',
    Status: 'الحالة',
    'In stock': 'متوفر',
    'Low stock': 'مخزون منخفض',
    'Out of stock': 'نفد المخزون',
    'View all': 'عرض الكل',
    'Orders needing attention': 'طلبات تحتاج متابعة',
    'Unprocessed, failed delivery, and similar exceptions':
      'غير معالج، فشل التسليم، واستثناءات مشابهة',
    Recipient: 'المستلم',
    Channel: 'القناة',
    Total: 'الإجمالي',
    'No orders yet': 'لا توجد طلبات بعد',
    'No orders need attention': 'لا توجد طلبات تحتاج متابعة',
    'No inventory rows': 'لا توجد صفوف مخزون',
    'Ready for payout': 'جاهز للتحويل',
    'Available to withdraw': 'متاح للسحب',
    'Request payout': 'طلب تحويل',
    'Still with carriers': 'ما زال لدى شركات الشحن',
    'Total COD': 'إجمالي الدفع عند الاستلام',
    'COD collected this period': 'المحصّل في هذه الفترة',
    Remitted: 'تم التحويل',
    'Already paid out': 'تم تحويله إليك',
    'Recent activity': 'النشاط الأخير',
    'What changed today?': 'ما الذي تغيّر اليوم؟',
    'No recent activity': 'لا يوجد نشاط حديث',
    'Could not load dashboard': 'تعذر تحميل لوحة التحكم',
    Retry: 'إعادة المحاولة',
    Order: 'طلب',
    Return: 'مرتجع',
    Payment: 'دفعة',
    'No data': 'لا توجد بيانات',
    'Total orders': 'إجمالي الطلبات',
  };
  return ar[label] ?? label;
}

function TopKpi({
  label,
  value,
  hint,
  icon,
  tone,
  loading,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: 'emerald' | 'amber' | 'slate';
  loading: boolean;
  to: string;
}): ReactElement {
  const tones = {
    emerald: {
      card: 'border-border',
      bg: 'bg-brand-50 dark:bg-white/5',
      text: 'text-brand-600 dark:text-brand-400',
      value: 'text-brand-700 dark:text-brand-400',
    },
    amber: {
      card: 'border-status-danger-border bg-status-danger-bg/40',
      bg: 'bg-status-danger-bg',
      text: 'text-status-danger-fg',
      value: 'text-status-danger-fg',
    },
    slate: {
      card: 'border-border',
      bg: 'bg-surface-sunken',
      text: 'text-text-muted',
      value: 'text-text-strong',
    },
  }[tone];

  return (
    <Link to={to} className="no-underline block h-full">
      <Card className={`p-5 h-full border ${tones.card}`} hover>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${tones.bg} flex items-center justify-center shrink-0`}>
            <i className={`fa-solid ${icon} ${tones.text} text-lg`} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text-muted">{label}</div>
            <div className={`text-3xl font-bold tabular-nums mt-1 ${tones.value}`}>
              {loading ? <Skeleton height={32} width={56} className="mt-1" /> : value}
            </div>
            <div className="text-[11px] text-text-faint mt-1">{hint}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function StatusCell({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}): ReactElement {
  return (
    <div className="flex-1 min-w-[6.5rem] text-center px-2 py-3">
      <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>{count.toLocaleString()}</div>
      <div className="text-[11px] font-semibold text-text-muted mt-1">{label}</div>
      <div className="text-[10px] text-text-faint mt-0.5">{pct(count, total)}</div>
    </div>
  );
}

function FinanceCard({
  label,
  value,
  hint,
  icon,
  iconBg,
  iconText,
  emphasize,
  action,
  loading,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
  iconBg: string;
  iconText: string;
  emphasize?: boolean;
  action?: ReactElement;
  loading: boolean;
  to?: string;
}): ReactElement {
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${emphasize ? 'bg-cta shadow-md shadow-brand-600/30' : iconBg} flex items-center justify-center shrink-0`}>
          <i className={`fa-solid ${icon} ${emphasize ? 'text-on-brand' : iconText}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-semibold uppercase tracking-wide ${emphasize ? 'text-brand-800 dark:text-brand-300' : 'text-text-muted'}`}>
            {label}
          </div>
          <div className={`text-xl font-bold tabular-nums mt-0.5 ${emphasize ? 'text-brand-900 dark:text-brand-100' : 'text-text-strong'}`}>
            {loading ? <Skeleton height={24} width={72} className="mt-0.5" /> : value}
          </div>
          <div className={`text-[10px] mt-0.5 ${emphasize ? 'text-brand-700/80 dark:text-brand-300/80' : 'text-text-faint'}`}>{hint}</div>
        </div>
      </div>
    </>
  );

    return (
    <Card
      className={`p-4 ${emphasize ? 'border-2 border-brand-500 bg-gradient-to-br from-brand-50/90 to-transparent dark:from-white/[0.04] shadow-lg shadow-brand-600/10' : ''}`}
      hover
    >
      {to ? (
        <Link to={to} className="no-underline block">
        {inner}
      </Link>
      ) : (
        inner
      )}
      {action}
    </Card>
    );
}

export function DashboardPage(): ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const t = (label: string) => tr(label, isArabic);
  const locale = isArabic ? 'ar' : 'en-US';
  const billingAccess = useClientOperationalAccess(isArabic);
  const displayName = user?.fullName?.trim() || user?.email || 'Client';

  const now = new Date();
  const [monthPreset, setMonthPreset] = useState<'this' | 'last'>('this');
  const [dateFrom, setDateFrom] = useState(toYmd(startOfMonth(now)));
  const [dateTo, setDateTo] = useState(toYmd(endOfMonth(now)));
  const [storeChannel, setStoreChannel] = useState('');

  const applyMonth = (preset: 'this' | 'last') => {
    setMonthPreset(preset);
    const base = preset === 'this' ? now : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    setDateFrom(toYmd(startOfMonth(base)));
    setDateTo(toYmd(endOfMonth(base)));
  };

  const orderFilters = useMemo(
    () => ({
      createdFrom: dateFrom,
      createdTo: dateTo,
      storeChannel: storeChannel.trim() || undefined,
    }),
    [dateFrom, dateTo, storeChannel],
  );

  const last7From = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6);
    return toYmd(d);
  }, []);
  const last7To = toYmd(now);

  const ordersQuery = useQuery({
    queryKey: ['client', 'dashboard', 'oms', orderFilters],
    queryFn: () => fetchClientOmsOrders({ ...orderFilters, limit: 500, offset: 0 }),
  });

  const movementQuery = useQuery({
    queryKey: ['client', 'dashboard', 'oms-7d', last7From, last7To, storeChannel],
    queryFn: () =>
      fetchClientOmsOrders({
        createdFrom: last7From,
        createdTo: last7To,
        storeChannel: storeChannel.trim() || undefined,
        limit: 500,
        offset: 0,
      }),
  });

  const productsQuery = useQuery({
    queryKey: ['client', 'dashboard', 'products'],
    queryFn: () => fetchClientProducts({ limit: 100, offset: 0 }),
  });

  const stockQuery = useQuery({
    queryKey: ['client', 'dashboard', 'stock'],
    queryFn: () => fetchStockPage({ limit: 200, offset: 0 }),
  });

  const codParams = useMemo(() => ({ dateFrom, dateTo }), [dateFrom, dateTo]);
  const codPendingQuery = useQuery({
    queryKey: ['client', 'dashboard', 'cod-pending', codParams],
    queryFn: () => fetchClientCodReport({ ...codParams, codStatus: 'pending', limit: 500, offset: 0 }),
  });
  const codCollectedQuery = useQuery({
    queryKey: ['client', 'dashboard', 'cod-collected', codParams],
    queryFn: () => fetchClientCodReport({ ...codParams, codStatus: 'collected', limit: 500, offset: 0 }),
  });
  const codRemittedQuery = useQuery({
    queryKey: ['client', 'dashboard', 'cod-remitted', codParams],
    queryFn: () => fetchClientCodReport({ ...codParams, codStatus: 'remitted', limit: 500, offset: 0 }),
  });
  const codSettledQuery = useQuery({
    queryKey: ['client', 'dashboard', 'cod-settled', codParams],
    queryFn: () => fetchClientCodReport({ ...codParams, codStatus: 'settled', limit: 500, offset: 0 }),
  });

  const returnsQuery = useQuery({
    queryKey: ['client', 'dashboard', 'returns'],
    queryFn: () => fetchClientReturns({ limit: 6, offset: 0 }),
  });
  const notificationsQuery = useQuery({
    queryKey: ['client', 'dashboard', 'notifications'],
    queryFn: () => fetchClientNotifications({ limit: 8, offset: 0 }),
  });

  const orders = ordersQuery.data?.items ?? [];
  const attentionOrders = useMemo(
    () =>
      orders
        .filter((o) => NEEDS_ATTENTION.has(o.status))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [orders],
  );
  const attentionCount = useMemo(
    () => orders.filter((o) => NEEDS_ATTENTION.has(o.status)).length,
    [orders],
  );

  const statusCounts = useMemo(() => {
    const counts = {
      unprocessed: 0,
      processing: 0,
      out: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    };
    for (const o of orders) {
      if (UNPROCESSED.has(o.status)) counts.unprocessed += 1;
      else if (PROCESSING.has(o.status)) counts.processing += 1;
      else if (OUT_FOR_DELIVERY.has(o.status)) counts.out += 1;
      else if (DELIVERED.has(o.status)) counts.delivered += 1;
      else if (RETURNED.has(o.status)) counts.returned += 1;
      else if (CANCELLED_OR_FAILED.has(o.status)) counts.cancelled += 1;
    }
    return counts;
  }, [orders]);

  const pieData = useMemo(() => {
    const counts = {
      unprocessed: 0,
      processing: 0,
      out: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    };
    for (const o of movementQuery.data?.items ?? []) {
      if (UNPROCESSED.has(o.status)) counts.unprocessed += 1;
      else if (PROCESSING.has(o.status)) counts.processing += 1;
      else if (OUT_FOR_DELIVERY.has(o.status)) counts.out += 1;
      else if (DELIVERED.has(o.status)) counts.delivered += 1;
      else if (RETURNED.has(o.status)) counts.returned += 1;
      else if (CANCELLED_OR_FAILED.has(o.status)) counts.cancelled += 1;
    }
    return [
      { name: t('Unprocessed'), value: counts.unprocessed, fill: '#F59E0B' },
      { name: t('Processing'), value: counts.processing, fill: '#3B82F6' },
      { name: t('Out for delivery'), value: counts.out, fill: '#8B5CF6' },
      { name: t('Delivered'), value: counts.delivered, fill: '#059669' },
      { name: t('Returned'), value: counts.returned, fill: '#EF4444' },
      { name: t('Cancelled / failed'), value: counts.cancelled, fill: '#94A3B8' },
    ].filter((d) => d.value > 0);
  }, [movementQuery.data, isArabic]);

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      if (o.storeChannel?.trim()) set.add(o.storeChannel.trim());
    }
    return [{ value: '', label: t('All') }, ...[...set].sort().map((v) => ({ value: v, label: v }))];
  }, [orders, isArabic]);

  const inventoryRows = useMemo(() => {
    const thresholdBySku = new Map<string, number>();
    for (const p of productsQuery.data?.items ?? []) {
      thresholdBySku.set(p.sku, Number(p.minStockThreshold) || 0);
    }
    const rows = (stockQuery.data?.items ?? []).map((s) => {
      const available = Number(s.available) || 0;
      const reserved = Number(s.reserved) || 0;
      const status = inventoryStatus(available, thresholdBySku.get(s.sku) ?? 0);
      return { productId: s.productId, name: s.productName, sku: s.sku, available, reserved, status };
    });
    rows.sort((a, b) => {
      const rank = { out: 0, low: 1, available: 2 };
      return rank[a.status] - rank[b.status] || b.available - a.available;
    });
    return rows.slice(0, 8);
  }, [stockQuery.data, productsQuery.data]);

  const sellableTotal = useMemo(
    () => (stockQuery.data?.items ?? []).reduce((acc, s) => acc + (Number(s.available) || 0), 0),
    [stockQuery.data],
  );
  const lowStockCount = useMemo(() => {
    const thresholdBySku = new Map<string, number>();
    for (const p of productsQuery.data?.items ?? []) {
      thresholdBySku.set(p.sku, Number(p.minStockThreshold) || 0);
    }
    let n = 0;
    for (const s of stockQuery.data?.items ?? []) {
      const st = inventoryStatus(Number(s.available) || 0, thresholdBySku.get(s.sku) ?? 0);
      if (st === 'low' || st === 'out') n += 1;
    }
    return n;
  }, [stockQuery.data, productsQuery.data]);

  const totalOrders = orders.length;

  const codCurrency =
    codCollectedQuery.data?.items.find((i) => i.currency)?.currency ||
    codPendingQuery.data?.items.find((i) => i.currency)?.currency ||
    'SYP';

  const pendingCod = sumAmounts(codPendingQuery.data?.items ?? []);
  const collectedCod = sumAmounts(codCollectedQuery.data?.items ?? []);
  const remittedCod =
    sumAmounts(codRemittedQuery.data?.items ?? []) + sumAmounts(codSettledQuery.data?.items ?? []);
  const totalCod = pendingCod + collectedCod + remittedCod;

  const payoutMailto = useMemo(() => {
    const subject = encodeURIComponent('Request COD Payout — Emdad Client Portal');
    const body = encodeURIComponent(
      `Hello Emdad,\n\nI would like to request a COD payout.\n\nReady for payout: ${formatMoney(collectedCod, codCurrency, locale)}\nPeriod: ${dateFrom} → ${dateTo}\nAccount: ${displayName}\n\nThank you.`,
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [collectedCod, codCurrency, locale, dateFrom, dateTo, displayName]);

  const activityItems = useMemo(() => {
    const items: Array<{
      id: string;
      kind: string;
      title: string;
      subtitle: string;
      at: string;
      href?: string;
      status?: string;
    }> = [];
    for (const o of orders.slice(0, 5)) {
      items.push({
        id: `o-${o.id}`,
        kind: t('Order'),
        title: o.orderNumber,
        subtitle: `${o.recipientName || '—'} · ${o.storeChannel || '—'}`,
        at: o.updatedAt,
        href: `/ecommerce-orders/${o.id}`,
        status: o.status,
      });
    }
    for (const r of returnsQuery.data?.items ?? []) {
      items.push({
        id: `r-${r.id}`,
        kind: t('Return'),
        title: r.orderNumber,
        subtitle: r.status,
        at: r.createdAt,
        href: `/returns/${r.id}`,
        status: r.status,
      });
    }
    for (const n of notificationsQuery.data?.items ?? []) {
      items.push({
        id: `n-${n.id}`,
        kind: n.type.includes('cod') || n.type.includes('payment') ? t('Payment') : t('Order'),
        title: n.title,
        subtitle: n.body,
        at: n.createdAt,
        href: clientNotificationHref(n),
      });
    }
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items.slice(0, 8);
  }, [orders, returnsQuery.data, notificationsQuery.data, isArabic]);

  const loading = ordersQuery.isPending || productsQuery.isPending;
  const loadingCod =
    codPendingQuery.isPending || codCollectedQuery.isPending || codRemittedQuery.isPending;

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-chart-line"
        title={t('Dashboard')}
        subtitle={
          <>
            {t('Welcome back')}, <span className="font-medium text-text-body">{displayName}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              disabled={!billingAccess.operationalAllowed}
              onClick={() => navigate('/ecommerce-orders')}
              startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
            >
              {t('New order')}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/my-profits')}
              startIcon={
                <i className="fa-solid fa-money-bill-wave text-brand-600 dark:text-brand-400 text-xs" aria-hidden="true" />
              }
            >
              {t('View cash on delivery')}
            </Button>
        </div>
        }
      />

      {ordersQuery.isError ? (
        <Alert
          variant="error"
          title={t('Could not load dashboard')}
          action={
            <Alert.Action variant="error" onClick={() => void ordersQuery.refetch()}>
              {t('Retry')}
            </Alert.Action>
          }
        />
      ) : null}

      {/* Exception-first KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TopKpi
          label={t('Needs attention')}
          value={attentionCount.toLocaleString(locale)}
          hint={t('Stuck or awaiting action')}
          icon="fa-triangle-exclamation"
          tone="amber"
          loading={loading}
          to="/ecommerce-orders"
        />
        <TopKpi
          label={t('Sellable stock')}
          value={sellableTotal.toLocaleString(locale)}
          hint={
            lowStockCount > 0
              ? `${lowStockCount.toLocaleString(locale)} ${t('Low-stock SKUs')}`
              : t('Units available to sell')
          }
          icon="fa-boxes-stacked"
          tone="emerald"
          loading={loading || stockQuery.isPending}
          to="/products"
        />
        <TopKpi
          label={t('Cash on delivery')}
          value={formatMoney(collectedCod, codCurrency, locale)}
          hint={`${t('Pending collection')}: ${formatMoney(pendingCod, codCurrency, locale)}`}
          icon="fa-money-bill-wave"
          tone="slate"
          loading={loadingCod}
          to="/my-profits"
        />
              </div>

      {/* ✓ KEEP — Order movement pie + Order summary status row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-4 p-5">
          <div className="mb-3">
            <h2 className="text-base font-bold text-text-strong">{t('Order movement')}</h2>
            <p className="text-xs text-text-muted mt-0.5">{t('Last 7 days')}</p>
              </div>
          <div className="h-52">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-text-faint">{t('No data')}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={74}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid var(--border-default)',
                      background: 'var(--surface-panel)',
                      color: 'var(--text-strong)',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {pieData.map((row) => (
              <li key={row.name} className="flex justify-between text-xs text-text-body">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: row.fill }} />
                  {row.name}
                </span>
                <span className="font-semibold tabular-nums">{row.value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-8 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-text-strong">{t('Order summary')}</h2>
              <p className="text-xs text-text-muted mt-0.5">{t('Where are my orders?')}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <select
                value={monthPreset}
                onChange={(e) => applyMonth(e.target.value as 'this' | 'last')}
                className="h-9 rounded-lg border border-border-strong bg-surface-panel px-3 text-sm text-text-body"
              >
                <option value="this">{t('This month')}</option>
                <option value="last">{t('Last month')}</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-lg border border-border-strong bg-surface-panel px-2 text-sm text-text-body"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-lg border border-border-strong bg-surface-panel px-2 text-sm text-text-body"
              />
              <select
                value={storeChannel}
                onChange={(e) => setStoreChannel(e.target.value)}
                className="h-9 rounded-lg border border-border-strong bg-surface-panel px-3 text-sm text-text-body min-w-[9rem]"
                aria-label={t('Sales channel')}
              >
                {channelOptions.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap divide-x divide-border-subtle rtl:divide-x-reverse rounded-xl border border-border-subtle bg-surface-card-muted">
            <StatusCell label={t('Total orders')} count={totalOrders} total={totalOrders || 1} colorClass="text-text-strong" />
            <StatusCell label={t('Unprocessed')} count={statusCounts.unprocessed} total={totalOrders || 1} colorClass="text-amber-600 dark:text-amber-400" />
            <StatusCell label={t('Processing')} count={statusCounts.processing} total={totalOrders || 1} colorClass="text-blue-600 dark:text-blue-400" />
            <StatusCell label={t('Out for delivery')} count={statusCounts.out} total={totalOrders || 1} colorClass="text-violet-600 dark:text-violet-400" />
            <StatusCell label={t('Delivered')} count={statusCounts.delivered} total={totalOrders || 1} colorClass="text-brand-600 dark:text-brand-400" />
            <StatusCell label={t('Returned')} count={statusCounts.returned} total={totalOrders || 1} colorClass="text-rose-600 dark:text-rose-400" />
            <StatusCell label={t('Cancelled / failed')} count={statusCounts.cancelled} total={totalOrders || 1} colorClass="text-text-muted" />
          </div>
        </Card>
      </div>

      {/* ✕ REPLACE — was Client Order Performance table → Live inventory (OMS / merchant) */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-border-subtle flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-text-strong">{t('Live inventory')}</h2>
            <p className="text-xs text-text-muted mt-0.5">{t('What inventory do I have?')}</p>
          </div>
          <Link to="/products" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 no-underline">
            {t('View all')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-card-muted text-[11px] uppercase text-text-muted font-semibold">
              <tr>
                <th className="px-5 py-3 text-start">{t('Product')}</th>
                <th className="px-5 py-3 text-start">{t('SKU')}</th>
                <th className="px-5 py-3 text-end">{t('Available')}</th>
                <th className="px-5 py-3 text-end">{t('Reserved')}</th>
                <th className="px-5 py-3 text-end">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {stockQuery.isPending ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`inv-sk-${i}`} className="animate-pulse">
                    <td className="px-5 py-3" colSpan={5}>
                      <Skeleton height={16} width="100%" />
                    </td>
                  </tr>
                ))
              ) : inventoryRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-text-faint">
                    {t('No inventory rows')}
                  </td>
                </tr>
              ) : (
                inventoryRows.map((row) => {
                  const badge =
                    row.status === 'out'
                      ? { label: t('Out of stock'), cls: 'bg-status-danger-bg text-status-danger-fg border-status-danger-border' }
                      : row.status === 'low'
                        ? { label: t('Low stock'), cls: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border' }
                        : { label: t('In stock'), cls: 'bg-status-success-bg text-status-success-fg border-status-success-border' };
                  const initial = row.name.trim().charAt(0).toUpperCase() || '?';
                  return (
                    <tr
                      key={row.productId}
                      className="hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => navigate(`/products/${row.productId}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-white/10 text-brand-800 dark:text-brand-300 flex items-center justify-center text-sm font-bold shrink-0">
                            {initial}
                          </div>
                          <span className="font-medium text-text-strong truncate">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-text-muted font-mono text-xs">{row.sku}</td>
                      <td className="px-5 py-3 text-end font-semibold tabular-nums text-text-strong">
                        {row.available.toLocaleString(locale)}
                      </td>
                      <td className="px-5 py-3 text-end tabular-nums text-text-muted">
                        {row.reserved.toLocaleString(locale)}
                      </td>
                      <td className="px-5 py-3 text-end">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ✕ REPLACE bottom chart | ✓ KEEP financial cards — OMS latest orders + finance stack */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-8 overflow-hidden">
          <div className="p-5 border-b border-border-subtle flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-text-strong">{t('Orders needing attention')}</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {t('Unprocessed, failed delivery, and similar exceptions')}
              </p>
            </div>
            <Link to="/ecommerce-orders" className="text-xs font-semibold text-brand-600 dark:text-brand-400 no-underline">
              {t('View all')}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-card-muted text-[11px] uppercase text-text-muted font-semibold">
                <tr>
                  <th className="px-5 py-3 text-start">{t('Order')}</th>
                  <th className="px-5 py-3 text-start">{t('Recipient')}</th>
                  <th className="px-5 py-3 text-start">{t('Channel')}</th>
                  <th className="px-5 py-3 text-start">{t('Status')}</th>
                  <th className="px-5 py-3 text-end">{t('Total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {attentionOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-text-faint">
                      {t('No orders need attention')}
                    </td>
                  </tr>
                ) : (
                  attentionOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => navigate(`/ecommerce-orders/${o.id}`)}
                    >
                      <td className="px-5 py-3 font-semibold text-text-strong">{o.orderNumber}</td>
                      <td className="px-5 py-3 text-text-body">{o.recipientName || '—'}</td>
                      <td className="px-5 py-3 text-text-muted text-xs">{o.storeChannel || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge status={o.status} />
                      </td>
                      <td className="px-5 py-3 text-end font-semibold tabular-nums text-text-strong">
                        {o.total != null ? `${o.total} ${o.currency || ''}`.trim() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ✓ KEEP — Financial KPI stack (merchant COD lifecycle) */}
        <div className="xl:col-span-4 flex flex-col gap-3">
          <FinanceCard
            label={t('Ready for payout')}
            value={formatMoney(collectedCod, codCurrency, locale)}
            hint={t('Available to withdraw')}
            icon="fa-sack-dollar"
            iconBg="bg-brand-50 dark:bg-white/5"
            iconText="text-brand-700 dark:text-brand-400"
            emphasize
            loading={loadingCod}
            to="/my-profits"
            action={
              <a
                href={payoutMailto}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cta px-3 py-2 text-xs font-bold text-white hover:bg-cta-hover no-underline"
              >
                {t('Request payout')}
              </a>
            }
          />
          <FinanceCard
            label={t('Total COD')}
            value={formatMoney(totalCod, codCurrency, locale)}
            hint={t('COD collected this period')}
            icon="fa-money-bill-wave"
            iconBg="bg-brand-50 dark:bg-white/5"
            iconText="text-brand-700 dark:text-brand-400"
            loading={loadingCod}
            to="/my-profits"
          />
          <FinanceCard
            label={t('Pending collection')}
            value={formatMoney(pendingCod, codCurrency, locale)}
            hint={t('Still with carriers')}
            icon="fa-truck"
            iconBg="bg-surface-sunken"
            iconText="text-text-muted"
            loading={loadingCod}
            to="/my-profits"
          />
          <FinanceCard
            label={t('Remitted')}
            value={formatMoney(remittedCod, codCurrency, locale)}
            hint={t('Already paid out')}
            icon="fa-building-columns"
            iconBg="bg-surface-sunken"
            iconText="text-text-muted"
            loading={loadingCod}
            to="/my-profits"
          />
        </div>
      </div>

      {/* OMS merchant activity feed */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-border-subtle">
          <h2 className="font-bold text-text-strong">{t('Recent activity')}</h2>
          <p className="text-xs text-text-muted mt-0.5">{t('What changed today?')}</p>
        </div>
        <div className="divide-y divide-border-subtle max-h-80 overflow-y-auto">
          {activityItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-faint">{t('No recent activity')}</div>
          ) : (
            activityItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.href && navigate(item.href)}
                className={`w-full text-start p-4 hover:bg-surface-hover transition-colors ${item.href ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-white/5 px-1.5 py-0.5 rounded">
                        {item.kind}
                </span>
                      {item.status ? <Badge status={item.status} /> : null}
                    </div>
                    <div className="text-sm font-semibold text-text-strong truncate">{item.title}</div>
                    <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.subtitle}</div>
                  </div>
                  <div className="text-[10px] text-text-faint shrink-0 whitespace-nowrap">
                    {new Date(item.at).toLocaleDateString(locale)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
