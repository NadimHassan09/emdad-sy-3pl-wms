import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, QrCode } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  FilterBar,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  StatusBadge,
  cn,
  useNavigate,
  type Tone,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { CodApi, type CodRecord, type CodRecordStatus } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { OmsScanDialog, type OmsScanResult } from './OmsScanDialog'

const COD_STATUS_OPTIONS: CodRecordStatus[] = ['pending', 'available', 'paid_out', 'returned']

const COD_STATUS_TONE: Record<CodRecordStatus, Tone> = {
  pending: 'pending',
  available: 'ready',
  paid_out: 'success',
  returned: 'returned',
}

function codStatusLabel(status: CodRecordStatus, isArabic: boolean): string {
  const en: Record<CodRecordStatus, string> = {
    pending: 'Pending',
    available: 'Available',
    paid_out: 'Paid out',
    returned: 'Returned',
  }
  const ar: Record<CodRecordStatus, string> = {
    pending: 'معلق',
    available: 'متاح',
    paid_out: 'تم الصرف',
    returned: 'مرتجع',
  }
  return isArabic ? ar[status] : en[status]
}

function fmtMoney(value: string | null | undefined, currency?: string | null): string {
  if (!value) return '—'
  return `${value}${currency ? ` ${currency}` : ''}`
}

function codStatusScanCopy(
  status: CodRecordStatus | null,
  isArabic: boolean,
): { title: string; hint: string; button: string } {
  if (!status) return { title: '', hint: '', button: '' }
  const label = codStatusLabel(status, isArabic)
  return {
    title: isArabic ? `${label} بالـ QR` : `${label} by QR`,
    hint: isArabic
      ? `امسح QR البوليصة لتحويل حالة COD إلى «${label}». إذا كانت الحالة نفسها مسبقاً فلن يحدث تغيير.`
      : `Scan the waybill QR to set COD status to “${label}”. If it is already that status, nothing changes.`,
    button: isArabic ? `${label} بالـ QR` : `${label} by QR`,
  }
}

type CodFilters = { search: string; status: string }

export function OmsCodPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [statusScan, setStatusScan] = useState<CodRecordStatus | null>(null)

  const invalidate = () => void qc.invalidateQueries({ queryKey: QK.omsCod })

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters<CodFilters>({
    search: '',
    status: '',
  })

  const listParams = useMemo(
    () => ({
      search: (appliedFilters.search ?? '').trim() || undefined,
      status: ((appliedFilters.status ?? '').trim() || undefined) as CodRecordStatus | undefined,
    }),
    [appliedFilters],
  )

  const pagination = useChunkedServerPagination<CodRecord>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => CodApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.omsCod,
    chunkQueryKeyPrefix: 'oms-cod-records-chunk',
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CodRecordStatus }) => CodApi.setStatus(id, status),
    onSuccess: () => {
      toast.success(t('COD status updated.', 'تم تحديث حالة COD.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleCodStatusScan = async (raw: string): Promise<OmsScanResult> => {
    const target = statusScan
    if (!target) return { ok: false, message: '' }
    const label = codStatusLabel(target, isArabic)
    try {
      const result = await CodApi.setStatusByScan(raw, target)
      if (result.action === 'updated') invalidate()
      return {
        ok: true,
        message:
          result.action === 'updated'
            ? t(`${result.orderNumber} — set to ${label}`, `${result.orderNumber} — تم التحويل إلى ${label}`)
            : t(
                `${result.orderNumber} — already ${label} (no change)`,
                `${result.orderNumber} — الحالة ${label} مسبقاً (بدون تغيير)`,
              ),
      }
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : t('Scan failed.', 'فشل المسح.'),
      }
    }
  }

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: t('All statuses', 'كل الحالات') },
      ...COD_STATUS_OPTIONS.map((value) => ({ value, label: codStatusLabel(value, isArabic) })),
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const columns = useMemo<ColumnDef<CodRecord>[]>(
    () => [
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
            <span className="font-mono text-xs">{row.original.omsOrderId.slice(0, 8)}…</span>
          ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => row.original.company?.name ?? '—',
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'recipient',
        header: t('Recipient', 'المستلم'),
        cell: ({ row }) => row.original.omsOrder?.recipientName?.trim() || '—',
        meta: { priority: 2, className: 'min-w-28' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <StatusBadge tone={COD_STATUS_TONE[row.original.status]}>{codStatusLabel(row.original.status, isArabic)}</StatusBadge>
        ),
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'original',
        header: t('Original', 'الأصلي'),
        cell: ({ row }) => fmtMoney(row.original.originalAmount, row.original.currency),
        meta: { priority: 2, align: 'end', className: 'min-w-24 tabular' },
      },
      {
        id: 'current',
        header: t('Current', 'الحالي'),
        cell: ({ row }) => fmtMoney(row.original.currentAmount, row.original.currency),
        meta: { priority: 1, align: 'end', className: 'min-w-24 tabular font-medium' },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
        meta: { priority: 2, className: 'min-w-36' },
      },
      {
        id: 'statusSelect',
        header: t('Change status', 'تغيير الحالة'),
        cell: ({ row }) => {
          const record = row.original
          return (
            <div className="min-w-36" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <Select
                value={record.status}
                disabled={statusMut.isPending}
                onValueChange={(next) => {
                  const status = next as CodRecordStatus
                  if (status === record.status) return
                  statusMut.mutate({ id: record.id, status })
                }}
              >
                <SelectTrigger className="h-9 w-full font-semibold" aria-label={t('Change COD status', 'تغيير حالة COD')}>
                  <SelectValue>
                    <StatusBadge tone={COD_STATUS_TONE[record.status]}>{codStatusLabel(record.status, isArabic)}</StatusBadge>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COD_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      <StatusBadge tone={COD_STATUS_TONE[opt]}>{codStatusLabel(opt, isArabic)}</StatusBadge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        },
        meta: { priority: 1, className: 'min-w-40', cardAction: true },
      },
    ],
    [isArabic, locale, statusMut.isPending], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('COD', 'الدفع عند الاستلام')}
        description={t('COD records with collection and payout status.', 'سجلات COD مع حالة التحصيل والصرف.')}
      />

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
            <Label htmlFor="cod-search">{t('Search', 'بحث')}</Label>
            <SearchInput
              value={draftFilters.search ?? ''}
              onChange={(v) => setDraft({ search: v })}
              placeholder={t('Search order, client, recipient…', 'بحث: الطلب، العميل، المستلم…')}
              clearLabel={t('Clear search', 'مسح البحث')}
            />
          </div>
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor="cod-status">{t('Status', 'الحالة')}</Label>
            <Select value={draftFilters.status ?? ''} onValueChange={(v) => setDraft({ status: v })}>
              <SelectTrigger id="cod-status" className="w-full min-w-40">
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

      <FilterBar className="flex-wrap gap-2">
        <span className="me-1 inline-flex items-center gap-1.5 text-sm font-medium">
          <QrCode className="size-4 text-primary" aria-hidden />
          {t('COD status by QR', 'حالة COD بالـ QR')}
        </span>
        {COD_STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt}
            type="button"
            variant={opt === 'returned' ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => setStatusScan(opt)}
          >
            <QrCode className="size-4" aria-hidden />
            {codStatusScanCopy(opt, isArabic).button}
          </Button>
        ))}
        <span className="basis-full text-sm text-muted-foreground lg:basis-auto lg:ms-auto">
          {t(
            'Choose a status, then scan the waybill QR. If already that status, nothing changes.',
            'اختر الحالة ثم امسح QR البوليصة. إذا كانت الحالة نفسها فلن يحدث تغيير.',
          )}
        </span>
      </FilterBar>

      <DataTable<CodRecord>
        columns={columns}
        data={pagination.rows}
        getRowId={(row) => row.id}
        loading={pagination.isInitialLoading}
        stateOverride={
          pagination.isError ? (
            <div
              role="alert"
              className={cn('rounded-xl border border-tone-danger-border bg-tone-danger-bg p-4 text-sm text-tone-danger-fg')}
            >
              {(pagination.error as Error)?.message || t('Failed to load COD records.', 'تعذر تحميل سجلات COD.')}
            </div>
          ) : undefined
        }
        empty={t('No COD records match the filters.', 'لا توجد سجلات COD مطابقة للتصفية.')}
        onRowClick={(row) => navigate(`/oms/cod/${row.id}`)}
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

      <OmsScanDialog
        open={statusScan !== null}
        keepOpen
        isArabic={isArabic}
        title={codStatusScanCopy(statusScan, isArabic).title}
        hint={codStatusScanCopy(statusScan, isArabic).hint}
        submitLabel={t('Record', 'تسجيل')}
        onClose={() => setStatusScan(null)}
        onScan={handleCodStatusScan}
      />
    </div>
  )
}
