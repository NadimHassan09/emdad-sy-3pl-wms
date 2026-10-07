import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, MoreHorizontal, Printer } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { useCachedState } from '@/hooks/useCachedState'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import {
  fetchClientInvoicesPage,
  type ClientInvoice,
} from '@/services/clientBillingService'
import { BillingSubNav } from './BillingSubNav'
import {
  BILLING_CURRENCY,
  InvoiceStatusBadge,
  formatCycleLabel,
  formatDate,
  formatDecimal,
  paymentDateFor,
} from './billing-ui'

const STATUS_OPTIONS = [
  { value: 'all', en: 'All statuses', ar: 'كل الحالات' },
  { value: 'unpaid', en: 'Pending', ar: 'قيد الانتظار' },
  { value: 'overdue', en: 'Overdue', ar: 'متأخر' },
  { value: 'paid', en: 'Paid', ar: 'مدفوعة' },
  { value: 'draft', en: 'Draft', ar: 'مسودة' },
  { value: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
] as const

export function InvoicesListPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useCachedState('invoices-status', 'all')

  const filterKey = useMemo(
    () => ({ status: statusFilter === 'all' ? undefined : statusFilter }),
    [statusFilter],
  )

  const pagination = useChunkedServerPagination<ClientInvoice>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) =>
      fetchClientInvoicesPage({
        offset,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    rtQueryKeyPrefix: ['client', 'billing', 'invoices'],
    chunkQueryKeyPrefix: 'client-billing-invoices-chunk',
  })

  const columns = useMemo<ColumnDef<ClientInvoice>[]>(
    () => [
      {
        id: 'invoiceNumber',
        header: t('Invoice #', 'رقم الفاتورة'),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums" dir="ltr">
            {row.original.invoiceNumber}
          </span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'issuedAt',
        header: t('Invoice date', 'تاريخ الفاتورة'),
        cell: ({ row }) => formatDate(row.original.issuedAt ?? row.original.createdAt),
        meta: { priority: 2, className: 'min-w-28' },
      },
      {
        id: 'period',
        header: t('Billing period', 'فترة الفوترة'),
        cell: ({ row }) => formatCycleLabel(row.original.billingCycle),
        meta: { priority: 2, className: 'min-w-40' },
      },
      {
        id: 'dueDate',
        header: t('Due date', 'تاريخ الاستحقاق'),
        cell: ({ row }) => formatDate(row.original.dueDate),
        meta: { priority: 3, className: 'min-w-28' },
      },
      {
        id: 'amount',
        header: t('Amount', 'المبلغ'),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums" dir="ltr">
            {formatDecimal(row.original.grandTotal ?? row.original.totalAmount)}
          </span>
        ),
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'currency',
        header: t('Currency', 'العملة'),
        cell: () => BILLING_CURRENCY,
        meta: { priority: 3, className: 'w-20' },
      },
      {
        id: 'status',
        header: t('Payment status', 'حالة الدفع'),
        cell: ({ row }) => (
          <InvoiceStatusBadge status={row.original.status} isArabic={isArabic} />
        ),
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'paidAt',
        header: t('Payment date', 'تاريخ الدفع'),
        cell: ({ row }) => paymentDateFor(row.original),
        meta: { priority: 3, className: 'min-w-28' },
      },
      {
        id: 'actions',
        header: t('Actions', 'إجراءات'),
        cell: ({ row }) => {
          const inv = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={t('Actions', 'إجراءات')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <Eye className="size-4" aria-hidden />
                  {t('View', 'عرض')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/invoices/${inv.id}?print=1`)}>
                  <Printer className="size-4" aria-hidden />
                  {t('Print', 'طباعة')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        meta: { align: 'end', cardAction: true, hideInCard: true },
      },
    ],
    [isArabic, navigate],
  )

  return (
    <div className="space-y-5">
      <BillingSubNav />
      <PageHeader
        title={t('Invoices', 'الفواتير')}
        description={t('Invoice history and payment status', 'سجل الفواتير وحالة الدفع')}
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-w-44" aria-label={t('Filter by status', 'تصفية حسب الحالة')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t(o.en, o.ar)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {pagination.isError ? (
        <ErrorState
          title={t('Could not load invoices.', 'تعذر تحميل الفواتير.')}
          description={(pagination.error as Error | undefined)?.message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void pagination.refetch()}
        />
      ) : null}

      <DataTable<ClientInvoice>
        columns={columns}
        data={pagination.rows}
        getRowId={(row) => row.id}
        loading={pagination.isInitialLoading}
        onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        empty={
          <EmptyState
            title={
              statusFilter !== 'all'
                ? t('No invoices match this filter.', 'لا توجد فواتير تطابق هذا الفلتر.')
                : t('No invoices yet.', 'لا توجد فواتير بعد.')
            }
          />
        }
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.setPage,
          onPageSizeChange: () => {},
        }}
      />
    </div>
  )
}
