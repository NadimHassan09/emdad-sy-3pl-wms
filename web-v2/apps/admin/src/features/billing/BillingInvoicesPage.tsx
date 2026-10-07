import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import {
  DataTable,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { BillingApi, type BillingInvoiceRow } from '@/api/billing'
import { CompaniesApi } from '@/api/companies'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useCachedState } from '@/hooks/useCachedState'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { formatCycleLabel, formatDate, formatDecimal, type InvoiceStatusFilter } from '@/lib/billing-invoice-display'
import { BillingSubNav } from './BillingSubNav'
import { BILLING_CURRENCY, InvoiceStatusBadge, canMutateBilling } from './billing-ui'

type ListFilters = {
  companyId: string
  search: string
  status: InvoiceStatusFilter
  createdFrom: string
  createdTo: string
  sort_by: 'createdAt' | 'invoiceNumber' | 'totalAmount' | 'status' | 'issuedAt'
  sort_dir: 'asc' | 'desc'
}

const INITIAL_FILTERS: ListFilters = {
  companyId: '',
  search: '',
  status: '',
  createdFrom: '',
  createdTo: '',
  sort_by: 'createdAt',
  sort_dir: 'desc',
}

export function BillingInvoicesPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canMutate = canMutateBilling(user?.role)
  const [advancedOpen, setAdvancedOpen] = useCachedState('billing-invoices:advanced-open', false)

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(INITIAL_FILTERS)

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  })

  const companyNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companiesQuery.data ?? []) m.set(c.id, c.name)
    return m
  }, [companiesQuery.data])

  const companyOptions = useMemo(
    () => companyFilterComboboxOptions(companiesQuery.data, t('All clients', 'كل العملاء')),
    [companiesQuery.data, t],
  )

  const serverFilters = useMemo(
    () => ({
      companyId: appliedFilters.companyId.trim() || undefined,
      search: appliedFilters.search.trim() || undefined,
      status: appliedFilters.status || undefined,
      createdFrom: appliedFilters.createdFrom || undefined,
      createdTo: appliedFilters.createdTo || undefined,
      sort_by: appliedFilters.sort_by,
      sort_dir: appliedFilters.sort_dir,
    }),
    [appliedFilters],
  )

  const pagination = useChunkedServerPagination<BillingInvoiceRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: serverFilters,
    fetchChunk: (offset, limit) => BillingApi.listInvoicesPage({ ...serverFilters, offset, limit }),
    rtQueryKeyPrefix: QK.billing.invoices,
    chunkQueryKeyPrefix: 'billing-invoices-chunk',
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paid' | 'cancelled' | 'unpaid' }) =>
      BillingApi.updateInvoiceStatus(id, status),
    onSuccess: () => {
      toast.success(t('Invoice status updated.', 'تم تحديث حالة الفاتورة.'))
      void qc.invalidateQueries({ queryKey: QK.billing.invoices })
      void qc.invalidateQueries({ queryKey: QK.billing.dashboardSummary })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns = useMemo<ColumnDef<BillingInvoiceRow>[]>(
    () => [
      {
        header: t('Invoice number', 'رقم الفاتورة'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-primary" dir="ltr">
            {row.original.invoiceNumber}
          </span>
        ),
        meta: { priority: 1 },
      },
      {
        header: t('Client', 'العميل'),
        cell: ({ row }) => companyNameById.get(row.original.companyId) ?? row.original.companyId,
        meta: { priority: 1 },
      },
      {
        header: t('Billing period', 'فترة الفوترة'),
        cell: ({ row }) => formatCycleLabel(row.original.billingCycle),
        meta: { priority: 3, hideInCard: true },
      },
      {
        header: t('Amount', 'المبلغ'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDecimal(row.original.grandTotal ?? row.original.totalAmount)} {BILLING_CURRENCY}
          </span>
        ),
        meta: { priority: 2 },
      },
      {
        header: t('Issue date', 'تاريخ الإصدار'),
        cell: ({ row }) => formatDate(row.original.issuedAt ?? row.original.createdAt),
        meta: { priority: 3 },
      },
      {
        header: t('Due date', 'تاريخ الاستحقاق'),
        cell: ({ row }) => formatDate(row.original.dueDate),
        meta: { priority: 3, hideInCard: true },
      },
      {
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} isArabic={isArabic} />,
        meta: { priority: 2 },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          const isUnpaid = r.status === 'unpaid' || r.status === 'open' || r.status === 'overdue'
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/billing/invoices/${r.id}`)}>
                  {t('View', 'عرض')}
                </DropdownMenuItem>
                {canMutate && isUnpaid ? (
                  <DropdownMenuItem onClick={() => statusMut.mutate({ id: r.id, status: 'paid' })}>
                    {t('Mark as paid', 'تعيين كمدفوعة')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        meta: { cardAction: true, align: 'end' },
      },
    ],
    [canMutate, companyNameById, isArabic, navigate, statusMut, t],
  )

  const advancedCount = [
    appliedFilters.companyId,
    appliedFilters.status,
    appliedFilters.createdFrom,
    appliedFilters.createdTo,
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Invoices', 'الفواتير')}
        description={t('Client billing invoices across all sources.', 'فواتير الفوترة لجميع العملاء.')}
      />
      <BillingSubNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchInput
          className="min-w-0 flex-1 sm:max-w-sm"
          placeholder={t('Search invoice #…', 'بحث برقم الفاتورة…')}
          value={draftFilters.search}
          onChange={(v) => setDraft({ search: v })}
        />
        <div className="w-full min-w-48 sm:w-56">
          <Combobox
            value={draftFilters.companyId}
            onChange={(v) => setDraft({ companyId: v })}
            options={companyOptions}
            placeholder={t('All clients', 'كل العملاء')}
          />
        </div>
        <Button variant="outline" onClick={() => setAdvancedOpen(!advancedOpen)}>
          <SlidersHorizontal className="size-4" />
          {t('Filters', 'تصفية')}
          {advancedCount > 0 ? ` (${advancedCount})` : ''}
        </Button>
        <Button onClick={() => applyFilters()}>{t('Apply', 'تطبيق')}</Button>
        <ResetFiltersButton label={t('Reset filters', 'إعادة تعيين الفلاتر')} onClick={() => resetFilters()} />
      </div>

      {advancedOpen ? (
        <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('Status', 'الحالة')}</Label>
            <Select
              value={draftFilters.status || '__all__'}
              onValueChange={(v) =>
                setDraft({ status: v === '__all__' ? '' : (v as InvoiceStatusFilter) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('All statuses', 'كل الحالات')}</SelectItem>
                <SelectItem value="draft">{t('Draft', 'مسودة')}</SelectItem>
                <SelectItem value="unpaid">{t('Issued', 'صادرة')}</SelectItem>
                <SelectItem value="overdue">{t('Overdue', 'متأخرة')}</SelectItem>
                <SelectItem value="paid">{t('Paid', 'مدفوعة')}</SelectItem>
                <SelectItem value="cancelled">{t('Cancelled', 'ملغاة')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Created from', 'أُنشئت من')}</Label>
            <Input
              type="date"
              value={draftFilters.createdFrom}
              onChange={(e) => setDraft({ createdFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Created to', 'أُنشئت إلى')}</Label>
            <Input
              type="date"
              value={draftFilters.createdTo}
              onChange={(e) => setDraft({ createdTo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Sort by', 'ترتيب حسب')}</Label>
            <Select
              value={draftFilters.sort_by}
              onValueChange={(v) => setDraft({ sort_by: v as ListFilters['sort_by'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">{t('Created', 'تاريخ الإنشاء')}</SelectItem>
                <SelectItem value="issuedAt">{t('Issue date', 'تاريخ الإصدار')}</SelectItem>
                <SelectItem value="invoiceNumber">{t('Invoice number', 'رقم الفاتورة')}</SelectItem>
                <SelectItem value="totalAmount">{t('Amount', 'المبلغ')}</SelectItem>
                <SelectItem value="status">{t('Status', 'الحالة')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        onRowClick={(r) => navigate(`/billing/invoices/${r.id}`)}
        loading={pagination.isInitialLoading}
        empty={t('No invoices match your filters.', 'لا فواتير مطابقة.')}
        pagination={pagination.serverPagination}
      />

      {pagination.isError ? (
        <p className="text-sm text-destructive">{(pagination.error as Error).message}</p>
      ) : null}
    </div>
  )
}
