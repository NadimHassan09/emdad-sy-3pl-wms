import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Banknote, Boxes, Landmark, Plus, Receipt, ShoppingCart, Truck, Wallet } from 'lucide-react'
import { formatDate, formatNumber, useUiPreferences } from '@emdad/core'
import {
  DonutChart,
  DataTable,
  ErrorState,
  KpiCard,
  KpiStrip,
  LegendList,
  PageHeader,
  ResetFiltersButton,
  StatusBadge,
  Widget,
  WidgetEmpty,
  WidgetLink,
  cn,
  toneClasses,
  type Tone,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { useAuth } from '@/auth/AuthContext'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { clientOmsCommercialStatusLabel } from '@/lib/client-oms-commercial-status'
import { clientOmsStatusTone } from '@/lib/oms-tone'
import { fetchClientInvoicesPage } from '@/services/clientBillingService'
import { clientNotificationHref, fetchClientNotifications } from '@/services/clientNotificationsService'
import {
  fetchClientCodReport,
  fetchClientOmsOrders,
  fetchClientOmsStatusSummary,
  type ClientOmsOrderListItem,
  type ClientOmsOrderStatus,
  type ClientOmsStatusSummary,
} from '@/services/clientOmsOrdersService'
import { fetchClientOmsReturns } from '@/services/clientOmsReturnsService'
import { fetchClientProducts } from '@/services/clientProductsService'
import { fetchStockPage } from '@/services/stockService'

/* ---------- status buckets (same grouping as the classic dashboard) ---------- */
const WAITING = new Set<ClientOmsOrderStatus>(['draft', 'waiting_for_confirmation', 'confirmed_waiting_for_admin_approval', 'pending_approval'])
const PENDING_FULFILLMENT = new Set<ClientOmsOrderStatus>(['pending', 'approved', 'confirmed', 'processing', 'allocated', 'picking', 'packing', 'ready_to_ship', 'failed_delivery'])
const OUT_FOR_DELIVERY = new Set<ClientOmsOrderStatus>(['shipped', 'out_for_delivery'])
const DELIVERED = new Set<ClientOmsOrderStatus>(['delivered', 'completed'])
const RETURNED = new Set<ClientOmsOrderStatus>(['returned'])
const CANCELLED_OR_FAILED = new Set<ClientOmsOrderStatus>(['cancelled', 'rejected'])
const OPEN_OMS = new Set<ClientOmsOrderStatus>([...WAITING, ...PENDING_FULFILLMENT, ...OUT_FOR_DELIVERY])
const NEEDS_ATTENTION = new Set<ClientOmsOrderStatus>(['waiting_for_confirmation', 'confirmed_waiting_for_admin_approval', 'pending_approval'])

function sumStatuses(byStatus: Partial<Record<ClientOmsOrderStatus, number>> | undefined, bucket: Set<ClientOmsOrderStatus>) {
  let n = 0
  for (const s of bucket) n += byStatus?.[s] ?? 0
  return n
}

function bucketCounts(summary: ClientOmsStatusSummary | undefined) {
  const by = summary?.byStatus
  return {
    waiting: sumStatuses(by, WAITING),
    processing: sumStatuses(by, PENDING_FULFILLMENT),
    out: sumStatuses(by, OUT_FOR_DELIVERY),
    delivered: sumStatuses(by, DELIVERED),
    returned: sumStatuses(by, RETURNED),
    cancelled: sumStatuses(by, CANCELLED_OR_FAILED),
  }
}

/* ---------- dates / money ---------- */
const toYmd = (d: Date) => d.toISOString().slice(0, 10)
const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
const sumAmounts = (items: Array<{ codAmount: string | null }>) => items.reduce((a, r) => a + (Number(r.codAmount) || 0), 0)

function money(amount: number, currency: string | null | undefined, locale: string) {
  const n = formatNumber(amount, locale, { maximumFractionDigits: 0 })
  const cur = currency?.trim()
  return cur ? `${n} ${cur}` : n
}

type StockLevel = 'available' | 'low' | 'out'
function stockLevel(available: number, threshold: number): StockLevel {
  if (available <= 0) return 'out'
  return available <= (threshold > 0 ? threshold : 5) ? 'low' : 'available'
}

const ALL = '__all__'

type OrderFilters = { monthPreset: 'this' | 'last'; dateFrom: string; dateTo: string; storeChannel: string }

function monthRange(preset: 'this' | 'last'): Pick<OrderFilters, 'dateFrom' | 'dateTo'> {
  const now = new Date()
  const base = preset === 'this' ? now : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return { dateFrom: toYmd(startOfMonth(base)), dateTo: toYmd(endOfMonth(base)) }
}
const defaultFilters = (): OrderFilters => ({ monthPreset: 'this', ...monthRange('this'), storeChannel: '' })

/* ---------- small presentational pieces ---------- */
function SummaryTile({ label, count, total, tone, locale, className }: { label: string; count: number; total: number; tone: Tone | null; locale: string; className?: string }) {
  const t = tone ? toneClasses[tone] : null
  return (
    <div className={cn('min-w-0 rounded-xl border px-3 py-3', t ? [t.bg, t.border] : 'bg-card', className)}>
      <p className={cn('tabular text-2xl font-semibold leading-8', t ? t.text : 'text-foreground')}>{formatNumber(count, locale)}</p>
      <p className={cn('text-sm font-medium leading-5', t ? t.text : 'text-muted-foreground')}>{label}</p>
      <p className={cn('tabular text-xs', t ? t.text : 'text-muted-foreground')}>{total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%'}</p>
    </div>
  )
}

function FinanceRow({
  label, hint, value, icon: Icon, loading, emphasize,
}: { label: string; hint: string; value: string; icon: typeof Wallet; loading: boolean; emphasize?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-4', emphasize ? 'border-primary/40 bg-brand-50' : 'bg-card')}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', emphasize ? 'bg-primary text-primary-foreground' : 'bg-brand-100 text-brand-800')}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-6 w-24" /> : <p className="tabular truncate text-xl font-semibold">{value}</p>}
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

type InventoryRow = { productId: string; name: string; sku: string; available: number; reserved: number; level: StockLevel }
type ActivityItem = { id: string; kind: string; title: string; subtitle: string; at: string; href?: string; tone?: Tone; statusLabel?: string }

const RETURN_TONE: Record<string, Tone> = { requested: 'pending', approved: 'ready', in_progress: 'progress', completed: 'success', rejected: 'danger', cancelled: 'neutral' }
const RETURN_LABEL: Record<string, [string, string]> = {
  requested: ['Requested', 'مطلوب'],
  approved: ['Approved', 'تمت الموافقة'],
  in_progress: ['In progress', 'قيد التنفيذ'],
  completed: ['Completed', 'مكتمل'],
  rejected: ['Rejected', 'مرفوض'],
  cancelled: ['Cancelled', 'ملغي'],
}

export function ClientDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const access = useClientOperationalAccess(isArabic)
  const displayName = user?.fullName?.trim() || user?.email || t('there', 'بك')

  const [draft, setDraft] = useState<OrderFilters>(defaultFilters)
  const [applied, setApplied] = useState<OrderFilters>(defaultFilters)
  const isDefault = JSON.stringify(applied) === JSON.stringify(defaultFilters()) && JSON.stringify(draft) === JSON.stringify(defaultFilters())
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)

  const { dateFrom, dateTo, storeChannel } = applied
  const channel = storeChannel.trim() || undefined
  const orderFilters = useMemo(() => ({ createdFrom: dateFrom, createdTo: dateTo, storeChannel: channel }), [dateFrom, dateTo, channel])

  const last7From = useMemo(() => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 6)
    return toYmd(d)
  }, [])
  const last7To = toYmd(new Date())

  const ordersQuery = useQuery({ queryKey: ['client', 'dashboard', 'oms', orderFilters], queryFn: () => fetchClientOmsOrders({ ...orderFilters, limit: 50, offset: 0 }) })
  const statusSummaryQuery = useQuery({ queryKey: ['client', 'dashboard', 'oms-status-summary', orderFilters], queryFn: () => fetchClientOmsStatusSummary(orderFilters) })
  const openOmsSummaryQuery = useQuery({ queryKey: ['client', 'dashboard', 'oms-open-summary', channel], queryFn: () => fetchClientOmsStatusSummary({ storeChannel: channel }) })
  const movementQuery = useQuery({ queryKey: ['client', 'dashboard', 'oms-7d-summary', last7From, last7To, channel], queryFn: () => fetchClientOmsStatusSummary({ createdFrom: last7From, createdTo: last7To, storeChannel: channel }) })
  const productsQuery = useQuery({ queryKey: ['client', 'dashboard', 'products'], queryFn: () => fetchClientProducts({ limit: 100, offset: 0 }) })
  const stockQuery = useQuery({ queryKey: ['client', 'dashboard', 'stock'], queryFn: () => fetchStockPage({ limit: 200, offset: 0 }) })
  const codParams = useMemo(() => ({ dateFrom, dateTo }), [dateFrom, dateTo])
  const codPendingQuery = useQuery({ queryKey: ['client', 'dashboard', 'cod-pending', codParams], queryFn: () => fetchClientCodReport({ ...codParams, codStatus: 'pending', limit: 500, offset: 0 }) })
  const codCollectedQuery = useQuery({ queryKey: ['client', 'dashboard', 'cod-collected', codParams], queryFn: () => fetchClientCodReport({ ...codParams, codStatus: 'collected', limit: 500, offset: 0 }) })
  const codRemittedQuery = useQuery({ queryKey: ['client', 'dashboard', 'cod-remitted', codParams], queryFn: () => fetchClientCodReport({ ...codParams, codStatus: 'remitted', limit: 500, offset: 0 }) })
  const returnsQuery = useQuery({ queryKey: ['client', 'dashboard', 'returns'], queryFn: () => fetchClientOmsReturns({ limit: 6, offset: 0 }) })
  const notificationsQuery = useQuery({ queryKey: ['client', 'dashboard', 'notifications'], queryFn: () => fetchClientNotifications({ limit: 8, offset: 0 }) })
  const invoicesQuery = useQuery({ queryKey: ['client', 'dashboard', 'invoices-obligation'], queryFn: () => fetchClientInvoicesPage({ limit: 200, offset: 0 }) })

  const orders = ordersQuery.data?.items
  const openOmsCount = useMemo(() => sumStatuses(openOmsSummaryQuery.data?.byStatus, OPEN_OMS), [openOmsSummaryQuery.data])

  const obligationInvoices = useMemo(
    () => (invoicesQuery.data?.items ?? []).filter((i) => i.status === 'unpaid' || i.status === 'open' || i.status === 'overdue'),
    [invoicesQuery.data],
  )
  const obligationAmount = useMemo(
    () => obligationInvoices.reduce((s, i) => { const n = Number(i.grandTotal ?? i.totalAmount); return s + (Number.isFinite(n) ? n : 0) }, 0),
    [obligationInvoices],
  )

  const attentionOrders = useMemo(
    () => (orders ?? []).filter((o) => NEEDS_ATTENTION.has(o.status)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8),
    [orders],
  )

  const statusCounts = useMemo(() => bucketCounts(statusSummaryQuery.data), [statusSummaryQuery.data])
  const totalOrders = statusSummaryQuery.data?.total ?? 0

  const movement = useMemo(() => {
    const c = bucketCounts(movementQuery.data)
    return [
      { key: 'waiting', label: t('Waiting', 'بانتظار الموافقة'), value: c.waiting, tone: 'pending' as Tone },
      { key: 'processing', label: t('Processing', 'قيد المعالجة'), value: c.processing, tone: 'progress' as Tone },
      { key: 'out', label: t('Out for delivery', 'خارج للتسليم'), value: c.out, tone: 'transit' as Tone },
      { key: 'delivered', label: t('Delivered', 'تم التسليم'), value: c.delivered, tone: 'success' as Tone },
      { key: 'returned', label: t('Returned', 'مرتجع'), value: c.returned, tone: 'returned' as Tone },
      { key: 'cancelled', label: t('Cancelled / failed', 'ملغي / فشل'), value: c.cancelled, tone: 'neutral' as Tone },
    ].map((d) => ({ ...d, color: `var(--tone-${d.tone}-dot)` }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementQuery.data, isArabic])
  const movementTotal = movement.reduce((a, d) => a + d.value, 0)

  const thresholdBySku = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of productsQuery.data?.items ?? []) m.set(p.sku, Number(p.minStockThreshold) || 0)
    return m
  }, [productsQuery.data])

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    const rows = (stockQuery.data?.items ?? []).map((s) => {
      const available = Number(s.available) || 0
      return { productId: s.productId, name: s.productName, sku: s.sku, available, reserved: Number(s.reserved) || 0, level: stockLevel(available, thresholdBySku.get(s.sku) ?? 0) }
    })
    const rank = { out: 0, low: 1, available: 2 }
    rows.sort((a, b) => rank[a.level] - rank[b.level] || b.available - a.available)
    return rows.slice(0, 8)
  }, [stockQuery.data, thresholdBySku])

  const sellableTotal = useMemo(() => (stockQuery.data?.items ?? []).reduce((a, s) => a + (Number(s.available) || 0), 0), [stockQuery.data])
  const lowStockCount = useMemo(
    () => (stockQuery.data?.items ?? []).filter((s) => stockLevel(Number(s.available) || 0, thresholdBySku.get(s.sku) ?? 0) !== 'available').length,
    [stockQuery.data, thresholdBySku],
  )

  const codCurrency = codCollectedQuery.data?.items.find((i) => i.currency)?.currency || codPendingQuery.data?.items.find((i) => i.currency)?.currency || 'USD'
  const pendingCod = sumAmounts(codPendingQuery.data?.items ?? [])
  const collectedCod = sumAmounts(codCollectedQuery.data?.items ?? [])
  const remittedCod = sumAmounts(codRemittedQuery.data?.items ?? []) // remitted === settled: do not add both
  const totalCod = pendingCod + collectedCod + remittedCod
  const loadingCod = codPendingQuery.isPending || codCollectedQuery.isPending || codRemittedQuery.isPending

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []
    for (const o of (orders ?? []).slice(0, 5)) {
      items.push({
        id: `o-${o.id}`, kind: t('Order', 'طلب'), title: o.orderNumber, subtitle: `${o.recipientName || '—'} · ${o.storeChannel || '—'}`,
        at: o.updatedAt, href: `/ecommerce-orders/${o.id}`, tone: clientOmsStatusTone(o.status), statusLabel: clientOmsCommercialStatusLabel(o.status, isArabic),
      })
    }
    for (const r of returnsQuery.data?.items ?? []) {
      items.push({ id: `r-${r.id}`, kind: t('Return', 'مرتجع'), title: r.returnNumber, subtitle: r.omsOrder?.orderNumber ?? '', at: r.createdAt, href: `/ecommerce-orders/returns/${r.id}`, tone: RETURN_TONE[r.status] ?? 'neutral', statusLabel: RETURN_LABEL[r.status] ? RETURN_LABEL[r.status][isArabic ? 1 : 0] : r.status.replace(/_/g, ' ') })
    }
    for (const n of notificationsQuery.data?.items ?? []) {
      items.push({ id: `n-${n.id}`, kind: n.type.includes('cod') || n.type.includes('payment') ? t('Payment', 'دفعة') : t('Order', 'طلب'), title: n.title, subtitle: n.body, at: n.createdAt, href: clientNotificationHref(n) })
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, returnsQuery.data, notificationsQuery.data, isArabic])

  const channelOptions = statusSummaryQuery.data?.storeChannels ?? []
  const loadErrored = ordersQuery.isError || statusSummaryQuery.isError

  const fmt = (n: number) => formatNumber(n, locale)

  /* ---------- tables ---------- */
  const inventoryColumns = useMemo<ColumnDef<InventoryRow>[]>(() => [
    {
      id: 'name', header: t('Product', 'المنتج'),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-100 text-sm font-semibold text-brand-800">{row.original.name.trim().charAt(0).toUpperCase() || '?'}</span>
          <span className="truncate font-medium">{row.original.name}</span>
        </div>
      ),
      meta: { priority: 1, className: 'min-w-48' },
    },
    { id: 'sku', header: t('SKU', 'رمز SKU'), cell: ({ row }) => <span dir="ltr" className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>, meta: { priority: 2, className: 'w-36 min-w-32' } },
    { id: 'available', header: t('Available', 'المتاح'), cell: ({ row }) => <span className="tabular font-semibold">{fmt(row.original.available)}</span>, meta: { priority: 1, align: 'end', className: 'w-28 min-w-24' } },
    { id: 'reserved', header: t('Reserved', 'المحجوز'), cell: ({ row }) => <span className="tabular text-muted-foreground">{fmt(row.original.reserved)}</span>, meta: { priority: 2, align: 'end', className: 'w-28 min-w-24' } },
    {
      id: 'status', header: t('Status', 'الحالة'),
      cell: ({ row }) => {
        const l = row.original.level
        return <StatusBadge tone={l === 'out' ? 'danger' : l === 'low' ? 'warning' : 'success'}>{l === 'out' ? t('Out of stock', 'نفد المخزون') : l === 'low' ? t('Low stock', 'مخزون منخفض') : t('In stock', 'متوفر')}</StatusBadge>
      },
      meta: { priority: 1, align: 'end', className: 'w-40 min-w-36' },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isArabic, locale])

  const attentionColumns = useMemo<ColumnDef<ClientOmsOrderListItem>[]>(() => [
    { id: 'order', header: t('Order', 'طلب'), cell: ({ row }) => <span className="font-semibold">{row.original.orderNumber}</span>, meta: { priority: 1, className: 'min-w-32' } },
    { id: 'recipient', header: t('Recipient', 'المستلم'), cell: ({ row }) => row.original.recipientName || '—', meta: { priority: 1, className: 'min-w-36' } },
    { id: 'channel', header: t('Channel', 'القناة'), cell: ({ row }) => <span className="text-muted-foreground">{row.original.storeChannel || '—'}</span>, meta: { priority: 2, className: 'w-32 min-w-28' } },
    { id: 'status', header: t('Status', 'الحالة'), cell: ({ row }) => <StatusBadge tone={clientOmsStatusTone(row.original.status)}>{clientOmsCommercialStatusLabel(row.original.status, isArabic)}</StatusBadge>, meta: { priority: 1, className: 'min-w-44' } },
    { id: 'total', header: t('Total', 'الإجمالي'), cell: ({ row }) => <span className="tabular font-semibold">{row.original.total != null ? `${row.original.total} ${row.original.currency || ''}`.trim() : '—'}</span>, meta: { priority: 2, align: 'end', className: 'w-32 min-w-28' } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isArabic])

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('Dashboard', 'لوحة التحكم')}
        description={<>{t('Welcome back', 'مرحبًا بعودتك')}{isArabic ? '،' : ','} <span className="font-medium text-foreground">{displayName}</span></>}
        actions={
          <>
            <Button disabled={!access.operationalAllowed} onClick={() => navigate('/ecommerce-orders')}>
              <Plus aria-hidden />
              {t('New order', 'طلب جديد')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/my-profits')}>
              <Banknote aria-hidden />
              {t('View cash on delivery', 'عرض الدفع عند الاستلام')}
            </Button>
          </>
        }
      />

      {loadErrored ? (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={t('Could not load dashboard', 'تعذر تحميل لوحة التحكم')}
            retryLabel={t('Retry', 'إعادة المحاولة')}
            onRetry={() => { void ordersQuery.refetch(); void statusSummaryQuery.refetch() }}
          />
        </div>
      ) : null}

      <KpiStrip>
        <KpiCard
          title={t('Open OMS orders', 'الطلبات الإلكترونية المفتوحة')} icon={ShoppingCart} href="/ecommerce-orders"
          value={fmt(openOmsCount)} loading={openOmsSummaryQuery.isPending}
          footer={t('Not yet delivered or closed', 'لم تُسلَّم أو تُغلق بعد')}
        />
        <KpiCard
          title={t('Current obligation', 'الالتزام الحالي')} icon={Receipt} href="/invoices"
          value={money(obligationAmount, 'USD', locale)} loading={invoicesQuery.isPending}
          footer={obligationInvoices.length > 0
            ? <span className={cn('font-medium', toneClasses.warning.text)}>{fmt(obligationInvoices.length)} · {t('Awaiting payment', 'بانتظار الدفع')}</span>
            : t('No outstanding invoices', 'لا توجد فواتير مستحقة')}
        />
        <KpiCard
          title={t('Sellable stock', 'المخزون القابل للبيع')} icon={Boxes} href="/products"
          value={fmt(sellableTotal)} loading={stockQuery.isPending}
          footer={lowStockCount > 0
            ? <span className={cn('font-medium', toneClasses.warning.text)}>{fmt(lowStockCount)} {t('Low-stock SKUs', 'أصناف منخفضة المخزون')}</span>
            : t('Units available to sell', 'وحدات متاحة للبيع')}
        />
        <KpiCard
          title={t('Cash on delivery', 'الدفع عند الاستلام')} icon={Banknote} href="/my-profits"
          value={money(collectedCod, codCurrency, locale)} loading={loadingCod}
          footer={`${t('Pending collection', 'بانتظار التحصيل')}: ${money(pendingCod, codCurrency, locale)}`}
        />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-12">
        <Widget className="xl:col-span-4" title={t('Order movement', 'حركة الطلبات')} action={<span className="text-sm text-muted-foreground">{t('Last 7 days', 'آخر 7 أيام')}</span>}>
          {movementQuery.isPending ? (
            <Skeleton className="mx-auto size-44 rounded-full" />
          ) : movementTotal === 0 ? (
            <WidgetEmpty>{t('No data', 'لا توجد بيانات')}</WidgetEmpty>
          ) : (
            <div className="space-y-4">
              <DonutChart data={movement.filter((d) => d.value > 0)} size={176} centerValue={fmt(movementTotal)} centerLabel={t('Orders', 'طلبات')} />
              <LegendList items={movement.filter((d) => d.value > 0).map((d) => ({ key: d.key, label: d.label, value: fmt(d.value), color: d.color }))} />
            </div>
          )}
        </Widget>

        <Widget className="xl:col-span-8" title={t('Order summary', 'ملخص الطلبات')} action={<span className="text-sm text-muted-foreground">{t('Where are my orders?', 'أين طلباتي؟')}</span>} contentClassName="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="dash-month" className="text-sm text-muted-foreground">{t('Period', 'الفترة')}</Label>
              <Select value={draft.monthPreset} onValueChange={(v) => setDraft((d) => ({ ...d, monthPreset: v as 'this' | 'last', ...monthRange(v as 'this' | 'last') }))}>
                <SelectTrigger id="dash-month" className="h-10 w-40 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="this">{t('This month', 'هذا الشهر')}</SelectItem>
                  <SelectItem value="last">{t('Last month', 'الشهر الماضي')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dash-from" className="text-sm text-muted-foreground">{t('From date', 'من تاريخ')}</Label>
              <Input id="dash-from" type="date" value={draft.dateFrom} onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))} className="h-10 w-40 bg-card" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dash-to" className="text-sm text-muted-foreground">{t('To date', 'إلى تاريخ')}</Label>
              <Input id="dash-to" type="date" value={draft.dateTo} onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))} className="h-10 w-40 bg-card" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dash-channel" className="text-sm text-muted-foreground">{t('Sales channel', 'قناة البيع')}</Label>
              <Select value={draft.storeChannel || ALL} onValueChange={(v) => setDraft((d) => ({ ...d, storeChannel: v === ALL ? '' : v }))}>
                <SelectTrigger id="dash-channel" className="h-10 w-44 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('All', 'الكل')}</SelectItem>
                  {channelOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" disabled={!dirty} onClick={() => setApplied({ ...draft })}>{t('Apply', 'تطبيق')}</Button>
            <ResetFiltersButton
              label={t('Reset', 'إعادة تعيين')}
              disabled={isDefault}
              onClick={() => { setDraft(defaultFilters()); setApplied(defaultFilters()) }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryTile className="col-span-full" label={t('Total orders', 'إجمالي الطلبات')} count={totalOrders} total={totalOrders} tone={null} locale={locale} />
            <SummaryTile label={t('Waiting', 'بانتظار الموافقة')} count={statusCounts.waiting} total={totalOrders} tone="pending" locale={locale} />
            <SummaryTile label={t('Processing', 'قيد المعالجة')} count={statusCounts.processing} total={totalOrders} tone="progress" locale={locale} />
            <SummaryTile label={t('Out for delivery', 'خارج للتسليم')} count={statusCounts.out} total={totalOrders} tone="transit" locale={locale} />
            <SummaryTile label={t('Delivered', 'تم التسليم')} count={statusCounts.delivered} total={totalOrders} tone="success" locale={locale} />
            <SummaryTile label={t('Returned', 'مرتجع')} count={statusCounts.returned} total={totalOrders} tone="returned" locale={locale} />
            <SummaryTile label={t('Cancelled / failed', 'ملغي / فشل')} count={statusCounts.cancelled} total={totalOrders} tone="neutral" locale={locale} />
          </div>
        </Widget>
      </div>

      <Widget
        title={t('Live inventory', 'المخزون الحالي')}
        action={<WidgetLink to="/products">{t('View all', 'عرض الكل')}</WidgetLink>}
      >
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t('What inventory do I have?', 'ما المخزون المتاح لدي؟')}</p>
        <DataTable
          columns={inventoryColumns}
          data={inventoryRows}
          getRowId={(r) => r.productId}
          loading={stockQuery.isPending}
          skeletonRows={4}
          empty={t('No inventory rows', 'لا توجد صفوف مخزون')}
          onRowClick={(r) => navigate(`/products/${r.productId}`)}
          labels={{ noResults: t('No inventory rows', 'لا توجد صفوف مخزون') }}
        />
      </Widget>

      <div className="grid gap-4 xl:grid-cols-12">
        <Widget
          className="xl:col-span-8"
          title={t('Orders needing attention', 'طلبات تحتاج متابعة')}
          action={<WidgetLink to="/ecommerce-orders">{t('View all', 'عرض الكل')}</WidgetLink>}
        >
          <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t('Waiting for your confirmation or for approval', 'بانتظار تأكيدك أو موافقة الإدارة')}</p>
          <DataTable
            columns={attentionColumns}
            data={attentionOrders}
            getRowId={(r) => r.id}
            loading={ordersQuery.isPending}
            skeletonRows={4}
            empty={t('No orders need attention', 'لا توجد طلبات تحتاج متابعة')}
            onRowClick={(r) => navigate(`/ecommerce-orders/${r.id}`)}
            labels={{ noResults: t('No orders need attention', 'لا توجد طلبات تحتاج متابعة') }}
          />
        </Widget>

        <div className="flex flex-col gap-3 xl:col-span-4">
          <FinanceRow emphasize icon={Wallet} label={t('Ready for payout', 'جاهز للتحويل')} hint={t('Available to withdraw', 'متاح للسحب')} value={money(collectedCod, codCurrency, locale)} loading={loadingCod} />
          <FinanceRow icon={Banknote} label={t('Total COD', 'إجمالي الدفع عند الاستلام')} hint={t('COD collected this period', 'المحصّل في هذه الفترة')} value={money(totalCod, codCurrency, locale)} loading={loadingCod} />
          <FinanceRow icon={Truck} label={t('Pending collection', 'بانتظار التحصيل')} hint={t('Still with carriers', 'ما زال لدى شركات الشحن')} value={money(pendingCod, codCurrency, locale)} loading={loadingCod} />
          <FinanceRow icon={Landmark} label={t('Remitted', 'تم التحويل')} hint={t('Already paid out', 'تم تحويله إليك')} value={money(remittedCod, codCurrency, locale)} loading={loadingCod} />
        </div>
      </div>

      <Widget title={t('Recent activity', 'النشاط الأخير')} contentClassName="px-0">
        <p className="-mt-2 mb-2 px-5 text-sm text-muted-foreground">{t('What changed today?', 'ما الذي تغيّر اليوم؟')}</p>
        {activity.length === 0 ? (
          <WidgetEmpty>{t('No recent activity', 'لا يوجد نشاط حديث')}</WidgetEmpty>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto border-t">
            {activity.map((item) => {
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-800">{item.kind}</span>
                      {item.tone && item.statusLabel ? <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge> : null}
                    </span>
                    <span className="block truncate text-sm font-semibold">{item.title}</span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.at, locale)}</span>
                </>
              )
              return (
                <li key={item.id}>
                  {item.href ? (
                    <button type="button" onClick={() => navigate(item.href!)} className="flex w-full items-start justify-between gap-3 px-5 py-3 text-start hover:bg-muted/60">{body}</button>
                  ) : (
                    <div className="flex items-start justify-between gap-3 px-5 py-3">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Widget>
    </div>
  )
}
