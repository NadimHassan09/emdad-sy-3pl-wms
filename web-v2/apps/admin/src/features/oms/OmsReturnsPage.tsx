import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, OnChangeFn, RowSelectionState } from '@tanstack/react-table'
import { Check, Loader2, Plus, QrCode, X, Zap } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  StatusBadge,
  cn,
  useNavigate,
  type Tone,
} from '@emdad/ui'
import { Badge } from '@emdad/ui/ui/badge'
import { Button } from '@emdad/ui/ui/button'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { OmsReturnsApi, type OmsReturn, type OmsReturnStatus } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { ConfirmReturnByScanDialog } from './ConfirmReturnByScanDialog'
import { CreateOmsReturnDialog } from './CreateOmsReturnDialog'
import { ExpressReturnDialog } from './ExpressReturnDialog'

const RETURN_STATUSES: OmsReturnStatus[] = ['requested', 'approved', 'rejected', 'completed', 'cancelled']

const RETURN_STATUS_TONE: Record<OmsReturnStatus, Tone> = {
  requested: 'pending',
  approved: 'ready',
  rejected: 'danger',
  completed: 'success',
  cancelled: 'neutral',
}

function returnStatusLabel(status: OmsReturnStatus, isArabic: boolean): string {
  const en: Record<OmsReturnStatus, string> = {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  const ar: Record<OmsReturnStatus, string> = {
    requested: 'مطلوب',
    approved: 'معتمد',
    rejected: 'مرفوض',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }
  return isArabic ? ar[status] : en[status]
}

function isConfirmableReturn(r: OmsReturn): boolean {
  return r.status === 'requested' || r.status === 'approved'
}

type ReturnFilters = { search: string; status: string }

export function OmsReturnsPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [expressOpen, setExpressOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const invalidate = () => void qc.invalidateQueries({ queryKey: QK.omsReturns })

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters<ReturnFilters>({
    search: '',
    status: '',
  })

  const listParams = useMemo(
    () => ({
      search: (appliedFilters.search ?? '').trim() || undefined,
      status: ((appliedFilters.status ?? '').trim() || undefined) as OmsReturnStatus | undefined,
    }),
    [appliedFilters],
  )

  const pagination = useChunkedServerPagination<OmsReturn>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OmsReturnsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.omsReturns,
    chunkQueryKeyPrefix: 'oms-returns-chunk',
  })

  useEffect(() => setSelectedIds(new Set()), [listParams])

  const confirmMut = useMutation({
    mutationFn: (id: string) => OmsReturnsApi.confirmReturn(id),
    onSuccess: () => {
      toast.success(t('Return confirmed successfully.', 'تم تأكيد الإرجاع بنجاح.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkConfirmMut = useMutation({
    mutationFn: (ids: string[]) => OmsReturnsApi.confirmReturnsBulk(ids),
    onSuccess: (result) => {
      const msg = t(
        `Confirmed ${result.confirmed}${result.skipped > 0 ? `, skipped ${result.skipped} (already done)` : ''}${result.failed > 0 ? `, ${result.failed} failed` : ''}.`,
        `تم تأكيد ${result.confirmed}${result.skipped > 0 ? `، تجاوز ${result.skipped} (مكتمل)` : ''}${result.failed > 0 ? `، فشل ${result.failed}` : ''}.`,
      )
      if (result.failed > 0) toast.error(msg)
      else toast.success(msg)
      setSelectedIds(new Set())
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries([...selectedIds].map((id) => [id, true])),
    [selectedIds],
  )
  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next = typeof updater === 'function' ? updater(rowSelection) : updater
    setSelectedIds(new Set(Object.keys(next).filter((k) => next[k])))
  }

  const selectedRows = useMemo(() => pagination.rows.filter((r) => selectedIds.has(r.id)), [pagination.rows, selectedIds])
  const confirmableSelected = useMemo(() => selectedRows.filter(isConfirmableReturn), [selectedRows])

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: t('All statuses', 'كل الحالات') },
      ...RETURN_STATUSES.map((value) => ({ value, label: returnStatusLabel(value, isArabic) })),
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const columns = useMemo<ColumnDef<OmsReturn>[]>(
    () => [
      {
        id: 'returnNumber',
        header: t('Return #', 'رقم المرتجع'),
        cell: ({ row }) => (
          <Link
            to={`/oms/returns/${row.original.id}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.returnNumber}
          </Link>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'order',
        header: t('Order', 'الطلب'),
        cell: ({ row }) =>
          row.original.omsOrder ? (
            <Link
              to={`/orders/oms/${row.original.omsOrderId}`}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.omsOrder.orderNumber}
            </Link>
          ) : (
            '—'
          ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'company',
        header: t('Client', 'العميل'),
        cell: ({ row }) => row.original.company?.name ?? '—',
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <StatusBadge tone={RETURN_STATUS_TONE[row.original.status]}>{returnStatusLabel(row.original.status, isArabic)}</StatusBadge>
        ),
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'reason',
        header: t('Reason', 'السبب'),
        cell: ({ row }) => row.original.reason?.trim() || '—',
        meta: { priority: 2, className: 'min-w-32 max-w-48 truncate' },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
        meta: { priority: 2, className: 'min-w-36' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('Actions', 'الإجراءات')}</span>,
        cell: ({ row }) => {
          const r = row.original
          if (!isConfirmableReturn(r)) {
            return (
              <span className="text-sm text-muted-foreground">
                {r.status === 'completed' ? t('Done', 'مكتمل') : '—'}
              </span>
            )
          }
          return (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <Button
                type="button"
                size="sm"
                disabled={confirmMut.isPending}
                onClick={() => confirmMut.mutate(r.id)}
              >
                <Check className="size-4" aria-hidden />
                {t('Confirm', 'تأكيد')}
              </Button>
            </div>
          )
        },
        meta: { priority: 1, align: 'end', className: 'min-w-28', cardAction: true },
      },
    ],
    [isArabic, locale, confirmMut.isPending], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('OMS Returns', 'مرتجعات OMS')}
        description={t('Commercial return requests for OMS orders.', 'طلبات الإرجاع التجارية لطلبات OMS.')}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
              <QrCode aria-hidden />
              {t('Confirm by scan', 'تأكيد عبر المسح')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('Create return', 'إنشاء مرتجع')}
            </Button>
            <Button type="button" onClick={() => setExpressOpen(true)}>
              <Zap aria-hidden />
              {t('Express return', 'مرتجع سريع')}
            </Button>
          </>
        }
      />

      {selectedIds.size > 0 ? (
        <div
          role="region"
          aria-label={t('Selected returns', 'المرتجعات المحددة')}
          className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-secondary p-3 shadow-sm"
        >
          <span className="text-sm font-medium">
            <Badge className="me-2 tabular">{selectedIds.size}</Badge>
            {t('selected', 'محدد')}
            {confirmableSelected.length < selectedIds.size ? (
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                ({t(`${confirmableSelected.length} confirmable`, `${confirmableSelected.length} قابل للتأكيد`)})
              </span>
            ) : null}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={confirmableSelected.length === 0 || bulkConfirmMut.isPending}
              onClick={() => bulkConfirmMut.mutate(confirmableSelected.map((r) => r.id))}
            >
              {bulkConfirmMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              {t(
                `Confirm selected (${confirmableSelected.length})`,
                `تأكيد المحدد (${confirmableSelected.length})`,
              )}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              <X aria-hidden />
              {t('Clear selection', 'إلغاء التحديد')}
            </Button>
          </div>
        </div>
      ) : null}

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
            <Label htmlFor="returns-search">{t('Search', 'بحث')}</Label>
            <SearchInput
              value={draftFilters.search ?? ''}
              onChange={(v) => setDraft({ search: v })}
              placeholder={t('Search return #, order, client…', 'بحث: المرتجع، الطلب، العميل…')}
              clearLabel={t('Clear search', 'مسح البحث')}
            />
          </div>
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor="returns-status">{t('Status', 'الحالة')}</Label>
            <Select value={draftFilters.status ?? ''} onValueChange={(v) => setDraft({ status: v })}>
              <SelectTrigger id="returns-status" className="w-full min-w-40">
                <SelectValue placeholder={t('All statuses', 'كل الحالات')} />
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((opt) => (
                  <SelectItem key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <DataTable<OmsReturn>
        columns={columns}
        data={pagination.rows}
        getRowId={(row) => row.id}
        loading={pagination.isInitialLoading}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        stateOverride={
          pagination.isError ? (
            <div
              role="alert"
              className={cn('rounded-xl border border-tone-danger-border bg-tone-danger-bg p-4 text-sm text-tone-danger-fg')}
            >
              {(pagination.error as Error)?.message || t('Failed to load returns.', 'تعذر تحميل المرتجعات.')}
            </div>
          ) : undefined
        }
        empty={t('No returns match the filters.', 'لا توجد مرتجعات مطابقة للتصفية.')}
        onRowClick={(row) => navigate(`/oms/returns/${row.id}`)}
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
          select: t('Select row', 'تحديد الصف'),
          selectAll: t('Select all on page', 'تحديد الكل في الصفحة'),
        }}
      />

      <ConfirmReturnByScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        isArabic={isArabic}
        onRefreshNeeded={() => {
          invalidate()
          pagination.refetch?.()
        }}
      />
      <CreateOmsReturnDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ExpressReturnDialog
        open={expressOpen}
        onClose={() => setExpressOpen(false)}
        onSuccess={() => {
          invalidate()
          pagination.refetch?.()
        }}
      />
    </div>
  )
}
