import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Banknote, Loader2 } from 'lucide-react'
import { formatDate, formatNumber, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiStrip,
  PageHeader,
  ResetFiltersButton,
  StatusBadge,
  useNavigate,
  type Tone,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import {
  fetchClientCodReport,
  type ClientCodReportRow,
  type ClientOmsCodStatus,
} from '@/services/clientOmsOrdersService'
import { OmsSectionTabs } from './OmsSectionTabs'

const ALL = '__all__'

const COD_STATUSES: ClientOmsCodStatus[] = ['pending', 'collected', 'remitted', 'settled', 'returned']

const COD_STATUS_TONE: Record<ClientOmsCodStatus, Tone> = {
  pending: 'pending',
  collected: 'ready',
  remitted: 'progress',
  settled: 'success',
  returned: 'returned',
}

function codStatusLabel(status: ClientOmsCodStatus, isArabic: boolean): string {
  const en: Record<ClientOmsCodStatus, string> = {
    pending: 'Pending',
    collected: 'Collected',
    remitted: 'Remitted',
    settled: 'Settled',
    returned: 'Returned',
  }
  const ar: Record<ClientOmsCodStatus, string> = {
    pending: 'قيد الانتظار',
    collected: 'محصّل',
    remitted: 'محوّل',
    settled: 'مسوّى',
    returned: 'مرتجع',
  }
  return isArabic ? ar[status] : en[status]
}

type CodFilters = { codStatus: string; dateFrom: string; dateTo: string }

const COD_LIST_FILTERS: CodFilters = { codStatus: '', dateFrom: '', dateTo: '' }

function fmtMoney(amount: string | null | undefined, currency: string | null | undefined, locale: string): string {
  if (amount == null || amount === '') return '—'
  const n = Number(amount)
  const formatted = Number.isFinite(n) ? formatNumber(n, locale, { maximumFractionDigits: 2 }) : amount
  return currency?.trim() ? `${formatted} ${currency.trim()}` : formatted
}

export function CodReportsPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(COD_LIST_FILTERS)

  const filterKey = useMemo(
    () => ({
      codStatus: appliedFilters.codStatus || undefined,
      dateFrom: appliedFilters.dateFrom || undefined,
      dateTo: appliedFilters.dateTo || undefined,
    }),
    [appliedFilters],
  )

  const summaryQuery = useQuery({
    queryKey: ['client', 'cod-report', 'summary', filterKey],
    queryFn: () => fetchClientCodReport({ ...filterKey, offset: 0, limit: 1 }),
    select: (page) => page.summary,
  })

  const pagination = useChunkedServerPagination<ClientCodReportRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientCodReport({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'cod-report'],
    chunkQueryKeyPrefix: 'client-cod-report-chunk',
  })

  const summary = summaryQuery.data
  const currencyHint = pagination.rows.find((r) => r.currency)?.currency

  const columns = useMemo<ColumnDef<ClientCodReportRow>[]>(
    () => [
      {
        id: 'orderNumber',
        header: t('Order #', 'رقم الطلب'),
        cell: ({ row }) => <span className="font-mono font-semibold">{row.original.orderNumber}</span>,
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'recipient',
        header: t('Recipient', 'المستلم'),
        cell: ({ row }) => row.original.recipientName ?? '—',
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'codAmount',
        header: t('COD amount', 'المبلغ'),
        cell: ({ row }) => (
          <span className="tabular font-medium">
            {fmtMoney(row.original.codAmount, row.original.currency, locale)}
          </span>
        ),
        meta: { priority: 1, align: 'end', className: 'min-w-28' },
      },
      {
        id: 'codStatus',
        header: t('COD status', 'حالة التحصيل'),
        cell: ({ row }) =>
          row.original.codStatus ? (
            <StatusBadge tone={COD_STATUS_TONE[row.original.codStatus]}>
              {codStatusLabel(row.original.codStatus, isArabic)}
            </StatusBadge>
          ) : (
            '—'
          ),
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => formatDate(row.original.createdAt, locale),
        meta: { priority: 2, align: 'end', className: 'min-w-28' },
      },
    ],
    [isArabic, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const totalCodDisplay =
    summary?.totalCodAmount != null
      ? fmtMoney(summary.totalCodAmount, currencyHint, locale)
      : '—'

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Cash on delivery', 'الدفع عند الاستلام')}
        description={t('Collected and pending remittance', 'المحصّل وبانتظار التحويل')}
      />

      <OmsSectionTabs isArabic={isArabic} />

      <KpiStrip cols={3}>
        <KpiCard
          title={t('COD orders', 'طلبات الدفع عند الاستلام')}
          icon={Banknote}
          value={summaryQuery.isPending ? undefined : formatNumber(summary?.orderCount ?? 0, locale)}
          loading={summaryQuery.isPending}
          footer={t('Matching filters', 'مطابق للفلاتر')}
        />
        <KpiCard
          title={t('Total COD amount', 'إجمالي مبالغ التحصيل')}
          icon={Banknote}
          value={summaryQuery.isPending ? undefined : totalCodDisplay}
          loading={summaryQuery.isPending}
          footer={currencyHint ? currencyHint : t('Matching filters', 'مطابق للفلاتر')}
        />
      </KpiStrip>

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor="cod-status">{t('COD status', 'حالة التحصيل')}</Label>
            <Select
              value={draftFilters.codStatus || ALL}
              onValueChange={(v) => setDraft({ codStatus: v === ALL ? '' : v })}
            >
              <SelectTrigger id="cod-status" className="w-full min-w-40">
                <SelectValue placeholder={t('All COD statuses', 'كل حالات التحصيل')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('All COD statuses', 'كل حالات التحصيل')}</SelectItem>
                {COD_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {codStatusLabel(status, isArabic)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor="cod-from">{t('From date', 'من تاريخ')}</Label>
            <Input
              id="cod-from"
              type="date"
              value={draftFilters.dateFrom}
              onChange={(e) => setDraft({ dateFrom: e.target.value })}
            />
          </div>
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor="cod-to">{t('To date', 'إلى تاريخ')}</Label>
            <Input
              id="cod-to"
              type="date"
              value={draftFilters.dateTo}
              onChange={(e) => setDraft({ dateTo: e.target.value })}
            />
          </div>
          <div className="ms-auto flex items-center gap-2 pb-0.5">
            <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={resetFilters} />
            <Button type="submit" disabled={pagination.isFetching}>
              {pagination.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t('Apply', 'تطبيق')}
            </Button>
          </div>
        </form>
      </section>

      {pagination.isError ? (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={t('Could not load COD report', 'تعذر تحميل تقرير التحصيل')}
            description={(pagination.error as Error)?.message}
            retryLabel={t('Retry', 'إعادة المحاولة')}
            onRetry={() => void pagination.refetch?.()}
          />
        </div>
      ) : !pagination.isInitialLoading && pagination.rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Banknote}
            title={t('No cash-on-delivery orders', 'لا توجد طلبات دفع عند الاستلام')}
            description={t(
              'COD orders will appear here once they are processed.',
              'ستظهر طلبات الدفع عند الاستلام هنا عند معالجتها.',
            )}
          />
        </div>
      ) : (
        <DataTable<ClientCodReportRow>
          columns={columns}
          data={pagination.rows}
          getRowId={(row) => row.id}
          loading={pagination.isInitialLoading}
          empty={t('No cash-on-delivery orders', 'لا توجد طلبات دفع عند الاستلام')}
          onRowClick={(row) => navigate(`/ecommerce-orders/${row.id}`)}
          pagination={{
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onPageChange: pagination.setPage,
            onPageSizeChange: () => pagination.resetPage(),
          }}
          labels={{
            rowsPerPage: t('Rows per page', 'عدد الصفوف في الصفحة'),
            of: t('of', 'من'),
            noResults: t('No results', 'لا نتائج'),
          }}
        />
      )}
    </div>
  )
}
