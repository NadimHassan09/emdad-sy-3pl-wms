import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, CircleAlert, FileText, MoreHorizontal, PackageOpen, Receipt, Truck, Users, ArrowDownToLine, ArrowUpFromLine, UserX, ListChecks, type LucideIcon } from 'lucide-react'
import {
  AreaSeriesChart,
  DonutChart,
  LegendList,
  StatusBadge,
  Widget,
  WidgetEmpty,
  WidgetError,
  WidgetLink,
  cn,
  toneClasses,
  type Tone,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Progress } from '@emdad/ui/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@emdad/ui/ui/dropdown-menu'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@emdad/ui/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@emdad/ui/ui/toggle-group'
import type { BillingExpiringCycleRow, BillingOverdueClientRow, BillingRecentInvoiceRow } from '@/api/billing'
import type { Warehouse } from '@/api/warehouses'
import { formatDate, humanizeInvoiceStatus } from '@/lib/billing-invoice-display'
import { dashboardLabel } from './dashboard-i18n'
import { cbmNumber, numberFmt, percentFmt, relativeTime, type PeriodKey } from './dashboard-utils'

type A = { isArabic: boolean }
const useT = (isArabic: boolean) => (s: string) => dashboardLabel(s, isArabic)

/* ───────────────────────── Operations overview ───────────────────────── */
export type OpsPoint = { date: string; label: string; inbound?: number; outbound?: number; tasks?: number }
type OpsTab = 'orders' | 'tasks' | 'inbound' | 'outbound'
const TAB_LABEL: Record<OpsTab, string> = { orders: 'Orders', tasks: 'Tasks', inbound: 'Inbound', outbound: 'Outbound' }

export function OperationsOverviewWidget({
  data, taskData, period, onPeriodChange, isArabic, isLoading, isError, onRetry,
}: A & { data: OpsPoint[]; taskData?: OpsPoint[]; period: PeriodKey; onPeriodChange: (p: PeriodKey) => void; isLoading?: boolean; isError?: boolean; onRetry?: () => void }) {
  const t = useT(isArabic)
  const [tab, setTab] = useState<OpsTab>('orders')
  const series = useMemo(() => {
    if (tab === 'inbound') return [{ key: 'inbound', label: t('Inbound Orders'), color: 'var(--chart-2)' }]
    if (tab === 'outbound') return [{ key: 'outbound', label: t('Outbound Orders'), color: 'var(--chart-4)' }]
    if (tab === 'tasks') return [{ key: 'tasks', label: t('Tasks'), color: 'var(--chart-5)' }]
    return [
      { key: 'inbound', label: t('Inbound Orders'), color: 'var(--chart-2)' },
      { key: 'outbound', label: t('Outbound Orders'), color: 'var(--chart-4)' },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isArabic])
  const chartData = tab === 'tasks' && taskData && taskData.length > 0 ? taskData : data
  const hasData = chartData.some((d) => series.some((s) => Number(d[s.key as keyof OpsPoint] ?? 0) > 0))

  return (
    <Widget title={t('Operations Overview')} action={<WidgetLink to="/reports">{t('View full report')}</WidgetLink>}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as OpsTab)}>
          <TabsList className="h-10">
            {(Object.keys(TAB_LABEL) as OpsTab[]).map((id) => (
              <TabsTrigger key={id} value={id} className="px-3">{t(TAB_LABEL[id])}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ToggleGroup type="single" variant="outline" value={period} onValueChange={(v) => v && onPeriodChange(v as PeriodKey)} aria-label={t('Period')}>
          {(['7', '30', '90'] as PeriodKey[]).map((p) => (
            <ToggleGroupItem key={p} value={p} className="tabular px-3">{p}{isArabic ? ' ي' : 'D'}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {isError ? (
        <WidgetError message={t('Unable to load this data.')} retryLabel={t('Try again')} onRetry={onRetry ?? (() => undefined)} />
      ) : isLoading ? (
        <Skeleton className="h-60 rounded-xl" />
      ) : !hasData ? (
        <WidgetEmpty>{t('No chart data for this period.')}</WidgetEmpty>
      ) : (
        <AreaSeriesChart data={chartData as unknown as Record<string, string | number | null>[]} xKey="label" series={series} height={250} />
      )}
    </Widget>
  )
}

/* ───────────────────────── Needs attention ───────────────────────── */
export type AttentionItem = { id: string; severity: 'critical' | 'warning'; title: string; description: string; actionLabel: string; to?: string; onAction?: () => void }

export function NeedsAttentionWidget({ items, isArabic, busy }: A & { items: AttentionItem[]; busy?: boolean }) {
  const t = useT(isArabic)
  return (
    <Widget title={t('Needs Attention')} action={<WidgetLink to="/notifications">{t('View all alerts')}</WidgetLink>}>
      {items.length === 0 ? (
        <WidgetEmpty>{t('No items need attention.')}</WidgetEmpty>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const critical = item.severity === 'critical'
            const Icon = critical ? CircleAlert : AlertTriangle
            const tone = toneClasses[critical ? 'danger' : 'warning']
            return (
              <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', tone.bg, tone.text)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
                {item.onAction ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={item.onAction}>{item.actionLabel}</Button>
                ) : item.to ? (
                  <Button variant="outline" size="sm" asChild><Link to={item.to}>{item.actionLabel}</Link></Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}

/* ───────────────────────── Quick actions ───────────────────────── */
export function QuickActionsWidget({ isArabic, canClients, canBilling, canProducts, canWarehouses }: A & { canClients: boolean; canBilling: boolean; canProducts: boolean; canWarehouses: boolean }) {
  const t = useT(isArabic)
  type Act = { key: string; label: string; icon: LucideIcon; to: string; tone: Tone }
  const primary = [
    canClients ? { key: 'client', label: t('New Client'), icon: Users, to: '/clients?create=1', tone: 'progress' as Tone } : null,
    { key: 'inbound', label: t('New Inbound'), icon: PackageOpen, to: '/orders/inbound/new', tone: 'success' as Tone },
    { key: 'outbound', label: t('New Outbound'), icon: Truck, to: '/orders/outbound/new', tone: 'pending' as Tone },
    canBilling ? { key: 'invoice', label: t('Create Invoice'), icon: Receipt, to: '/billing/invoices', tone: 'transit' as Tone } : null,
    { key: 'contract', label: t('New Contract'), icon: FileText, to: '/contracts/grn', tone: 'ready' as Tone },
  ].filter(Boolean) as Act[]
  const more = [
    canProducts ? { label: t('Products'), to: '/products' } : null,
    canWarehouses ? { label: t('Warehouses'), to: '/warehouses' } : null,
    canBilling ? { label: t('Billing'), to: '/billing/plans' } : null,
    { label: t('Reports'), to: '/reports' },
    { label: t('Inventory'), to: '/inventory/stock' },
  ].filter(Boolean) as { label: string; to: string }[]

  const tile = 'flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-transparent bg-muted/60 px-2 py-3 text-center text-sm font-medium transition-colors hover:border-border hover:bg-card'
  return (
    <Widget title={t('Quick Actions')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
        {primary.map((a) => (
          <Link key={a.key} to={a.to} className={tile}>
            <span className={cn('grid size-9 place-items-center rounded-lg', toneClasses[a.tone].bg, toneClasses[a.tone].text)}>
              <a.icon className="size-[1.125rem]" aria-hidden />
            </span>
            <span className="leading-tight">{a.label}</span>
          </Link>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={tile}>
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground"><MoreHorizontal className="size-[1.125rem]" aria-hidden /></span>
              <span className="leading-tight">{t('More Actions')}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {more.map((m) => (
              <DropdownMenuItem key={m.to} asChild><Link to={m.to}>{m.label}</Link></DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Widget>
  )
}

/* ───────────────────────── Outbound pipeline ───────────────────────── */
export type PipelineStage = { key: string; label: string; count: number; to: string; tone: Tone }

export function OutboundPipelineWidget({ stages, isArabic }: A & { stages: PipelineStage[] }) {
  const t = useT(isArabic)
  const total = stages.reduce((s, x) => s + x.count, 0)
  return (
    <Widget title={t('Outbound Pipeline')} action={<WidgetLink to="/orders/outbound">{t('View all')}</WidgetLink>}>
      {total === 0 ? (
        <WidgetEmpty>{t('No open orders')}</WidgetEmpty>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {stages.map((s) => {
            const tc = toneClasses[s.tone]
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
            return (
              <Link key={s.key} to={s.to} className={cn('flex flex-col gap-1 rounded-xl border p-3 transition hover:brightness-[0.98]', tc.bg, tc.border, tc.text)}>
                <span className="text-xs font-medium">{t(s.label)}</span>
                <span className="tabular text-2xl font-semibold leading-8">{numberFmt(s.count)}</span>
                <span className="tabular text-xs opacity-90">{pct}%</span>
              </Link>
            )
          })}
        </div>
      )}
    </Widget>
  )
}

/* ───────────────────────── Warehouse tasks ───────────────────────── */
type TaskRow = { key: string; label: string; openCount: number; inProgressCount: number }

export function WarehouseTasksWidget({ rows, isArabic, canOpenTasks }: A & { rows: TaskRow[]; canOpenTasks: boolean }) {
  const t = useT(isArabic)
  const pending = rows.reduce((s, r) => s + Math.max(0, r.openCount - r.inProgressCount), 0)
  return (
    <Widget title={t('Warehouse Tasks')} action={canOpenTasks ? <WidgetLink to="/tasks">{t('View task board')}</WidgetLink> : null}>
      {rows.length === 0 ? (
        <WidgetEmpty>{t('No open tasks')}</WidgetEmpty>
      ) : (
        <>
          <ul className="space-y-3.5">
            {rows.map((row) => {
              const pct = row.openCount > 0 ? (row.inProgressCount / row.openCount) * 100 : 0
              const body = (
                <>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium"><ListChecks className="size-4 text-muted-foreground" aria-hidden />{t(row.label)}</span>
                    <span className="tabular text-muted-foreground" dir="ltr">{row.inProgressCount} / {row.openCount}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </>
              )
              return (
                <li key={row.key}>
                  {canOpenTasks ? <Link to={`/tasks?taskType=${encodeURIComponent(row.key)}`} className="block rounded-md">{body}</Link> : body}
                </li>
              )
            })}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground"><b className="tabular text-foreground">{pending}</b> {t('tasks pending')}</p>
        </>
      )}
    </Widget>
  )
}

/* ───────────────────────── Storage utilization ───────────────────────── */
export function StorageWidget({
  usedCbm, reservedCbm, remainingCbm, percent, warehouses, canOpenWarehouses, isArabic,
}: A & { usedCbm: string | number; reservedCbm: string | number; remainingCbm: string | number; percent: number; warehouses: Warehouse[]; canOpenWarehouses: boolean }) {
  const t = useT(isArabic)
  const used = cbmNumber(usedCbm)
  const reserved = cbmNumber(reservedCbm)
  const remaining = Math.max(0, cbmNumber(remainingCbm))
  const empty = used === 0 && remaining === 0 && reserved === 0
  const fmt = (v: number) => `${numberFmt(Number(v.toFixed(1)))} ${t('CBM')}`
  const slices = [
    { key: 'used', label: t('Used'), value: used, color: 'var(--chart-2)' },
    { key: 'available', label: t('Available'), value: remaining, color: 'var(--chart-3)' },
    { key: 'reserved', label: t('Reserved'), value: Math.max(0, reserved - used), color: 'var(--chart-4)' },
  ].filter((s) => s.value > 0)
  return (
    <Widget title={t('Storage Utilization')} action={<WidgetLink to="/billing/plans">{t('View all')}</WidgetLink>}>
      {empty ? (
        <WidgetEmpty>{t('No storage data.')}</WidgetEmpty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5">
            <DonutChart data={slices} size={132} centerValue={percentFmt(percent)} centerLabel={t('Used')} />
            <div className="min-w-40 flex-1">
              <LegendList items={[
                { key: 'used', label: t('Used'), value: fmt(used), color: 'var(--chart-2)' },
                { key: 'available', label: t('Available'), value: fmt(remaining), color: 'var(--chart-3)' },
                { key: 'reserved', label: t('Reserved'), value: fmt(reserved), color: 'var(--chart-4)' },
              ]} />
            </div>
          </div>
          {warehouses.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-muted-foreground">{t('Top Warehouses')}</p>
              <ul className="space-y-1">
                {warehouses.slice(0, 4).map((w) => {
                  const inner = (
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{w.name}</span>
                      <span className="tabular shrink-0 text-muted-foreground" dir="ltr">{w.code}</span>
                    </span>
                  )
                  return <li key={w.id}>{canOpenWarehouses ? <Link to="/warehouses" className="block rounded-md px-1 py-1.5 hover:bg-muted">{inner}</Link> : <span className="block px-1 py-1.5">{inner}</span>}</li>
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Widget>
  )
}

/* ───────────────────────── Billing & clients ───────────────────────── */
const invoiceTone = (status: string): Tone => (status === 'paid' ? 'success' : status === 'cancelled' ? 'neutral' : 'danger')

export function BillingClientsWidget({
  expiring, overdue, invoices, canMutate, isArabic, onResolveOverdue, renewPending, isError, onRetry,
}: A & { expiring: BillingExpiringCycleRow[]; overdue: BillingOverdueClientRow[]; invoices: BillingRecentInvoiceRow[]; canMutate: boolean; onResolveOverdue?: (planId: string, companyName: string) => void; renewPending?: boolean; isError?: boolean; onRetry?: () => void }) {
  const t = useT(isArabic)
  const heading = 'mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'
  return (
    <Widget title={t('Billing & Clients')} action={<WidgetLink to="/billing/plans">{t('View all')}</WidgetLink>}>
      {isError ? (
        <WidgetError message={t('Unable to load this data.')} retryLabel={t('Try again')} onRetry={onRetry ?? (() => undefined)} />
      ) : (
        <div className="space-y-5">
          <section>
            <h3 className={heading}>{t('Billing Cycles Ending Soon')}</h3>
            {expiring.length === 0 ? <WidgetEmpty>{t('No active billing cycles expiring soon.')}</WidgetEmpty> : (
              <ul className="space-y-2">
                {expiring.slice(0, 4).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link to={`/billing/plans/${row.companyId}`} className="truncate font-medium hover:underline">{row.company.name}</Link>
                    <span className={cn('tabular shrink-0 text-xs font-semibold', row.daysRemaining <= 7 ? 'text-tone-warning-fg' : 'text-muted-foreground')}>{row.daysRemaining} {t('days')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className={heading}>{t('Overdue')}</h3>
            {overdue.length === 0 ? <WidgetEmpty>{t('No overdue clients.')}</WidgetEmpty> : (
              <ul className="space-y-2">
                {overdue.slice(0, 3).map((row) => (
                  <li key={row.companyId} className="flex items-center justify-between gap-2 rounded-lg border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-tone-danger-fg">
                    <div className="min-w-0">
                      <Link to={`/billing/plans/${row.companyId}`} className="block truncate text-sm font-semibold hover:underline">{row.companyName}</Link>
                      <p className="text-xs">{t('Restricted access')}{row.lastCycleEndedAt ? ` · ${formatDate(row.lastCycleEndedAt)}` : ''}</p>
                    </div>
                    {canMutate && row.billingPlanId && onResolveOverdue ? (
                      <Button variant="outline" size="sm" disabled={renewPending} onClick={() => onResolveOverdue(row.billingPlanId!, row.companyName)}>{t('Resolve')}</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className={heading}>{t('Recent Invoices')}</h3>
            {invoices.length === 0 ? <WidgetEmpty>{t('No recent invoices.')}</WidgetEmpty> : (
              <ul className="space-y-2">
                {invoices.slice(0, 4).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link to={`/billing/invoices/${row.id}`} className="truncate font-mono text-xs font-semibold hover:underline"><span dir="ltr">{row.invoiceNumber}</span></Link>
                    <StatusBadge tone={invoiceTone(row.status)}>{t(humanizeInvoiceStatus(row.status))}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Widget>
  )
}

/* ───────────────────────── Recent activity ───────────────────────── */
export type ActivityItem = { id: string; title: string; subtitle?: string; at: string; to?: string; tone: Tone; icon: 'outbound' | 'inbound' | 'invoice' | 'task' | 'client' }
const ACTIVITY_ICONS: Record<ActivityItem['icon'], LucideIcon> = { inbound: ArrowDownToLine, outbound: ArrowUpFromLine, invoice: Receipt, task: ListChecks, client: UserX }

export function RecentActivityWidget({ items, isArabic }: A & { items: ActivityItem[] }) {
  const t = useT(isArabic)
  return (
    <Widget title={t('Recent Activity')} action={<WidgetLink to="/orders/outbound">{t('View all')}</WidgetLink>}>
      {items.length === 0 ? <WidgetEmpty>{t('No recent activity.')}</WidgetEmpty> : (
        <ul className="divide-y">
          {items.map((item) => {
            const Icon = ACTIVITY_ICONS[item.icon]
            const tc = toneClasses[item.tone]
            const content = (
              <div className="flex items-start gap-3 py-2.5">
                <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', tc.bg, tc.text)}><Icon className="size-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  {item.subtitle ? <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.at, isArabic)}</span>
              </div>
            )
            return <li key={item.id}>{item.to ? <Link to={item.to} className="block rounded-md hover:bg-muted/60">{content}</Link> : content}</li>
          })}
        </ul>
      )}
    </Widget>
  )
}

/* ───────────────────────── Top products ───────────────────────── */
export type TopProductRow = { productId: string; name: string; sku?: string; moves: number; imageSrc?: string | null }

export function TopProductsWidget({ rows, isArabic, isError, onRetry }: A & { rows: TopProductRow[]; isError?: boolean; onRetry?: () => void }) {
  const t = useT(isArabic)
  const max = Math.max(...rows.map((r) => r.moves), 1)
  return (
    <Widget title={t('Top Products by Movement')} action={<WidgetLink to="/reports/product-moves">{t('View all')}</WidgetLink>}>
      {isError ? (
        <WidgetError message={t('Unable to load this data.')} retryLabel={t('Try again')} onRetry={onRetry ?? (() => undefined)} />
      ) : rows.length === 0 ? (
        <WidgetEmpty>{t('No product movement yet.')}</WidgetEmpty>
      ) : (
        <ul className="space-y-3.5">
          {rows.map((row) => (
            <li key={row.productId}>
              <Link to={`/inventory/product/${row.productId}`} className="block rounded-md">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {row.imageSrc ? <img src={row.imageSrc} alt="" className="size-7 shrink-0 rounded-md object-cover" /> : null}
                    <span className="truncate font-medium">{row.name}</span>
                  </span>
                  <span className="tabular shrink-0 text-muted-foreground">{numberFmt(row.moves)} {t('moves')}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-2" style={{ width: `${Math.max(8, (row.moves / max) * 100)}%` }} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}
