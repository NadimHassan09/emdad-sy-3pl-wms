import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, RotateCcw } from 'lucide-react'
import { formatDate, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
  useNavigate,
  type Tone,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import {
  fetchClientOmsReturns,
  type ClientOmsReturnRow,
  type ClientOmsReturnStatus,
} from '@/services/clientOmsReturnsService'
import { OmsSectionTabs } from './OmsSectionTabs'

const RETURN_STATUS_TONE: Record<string, Tone> = {
  requested: 'pending',
  approved: 'ready',
  rejected: 'danger',
  in_progress: 'progress',
  completed: 'success',
  cancelled: 'neutral',
}

function returnStatusLabel(status: string, isArabic: boolean): string {
  const en: Record<string, string> = {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  const ar: Record<string, string> = {
    requested: 'مطلوب',
    approved: 'معتمد',
    rejected: 'مرفوض',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }
  return (isArabic ? ar : en)[status] ?? status.replace(/_/g, ' ')
}

export function OmsReturnsListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const billingAccess = useClientOperationalAccess(isArabic)

  const pagination = useChunkedServerPagination<ClientOmsReturnRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: { source: 'oms' },
    fetchChunk: (offset, limit) => fetchClientOmsReturns({ offset, limit }),
    rtQueryKeyPrefix: ['client', 'oms-returns'],
    chunkQueryKeyPrefix: 'client-oms-returns-chunk',
  })

  const columns = useMemo<ColumnDef<ClientOmsReturnRow>[]>(
    () => [
      {
        id: 'returnNumber',
        header: t('Return #', 'رقم الإرجاع'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold">{row.original.returnNumber || row.original.id.slice(0, 8)}</span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => {
          const status = row.original.status as ClientOmsReturnStatus | string
          return (
            <StatusBadge tone={RETURN_STATUS_TONE[status] ?? 'neutral'}>
              {returnStatusLabel(status, isArabic)}
            </StatusBadge>
          )
        },
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'linkedOrder',
        header: t('Linked order', 'الطلب المرتبط'),
        cell: ({ row }) => row.original.omsOrder?.orderNumber ?? '—',
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'lines',
        header: t('Lines', 'البنود'),
        cell: ({ row }) => row.original.lines?.length ?? 0,
        meta: { priority: 2, align: 'end', className: 'min-w-20 tabular' },
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

  const createButton = (
    <Button
      type="button"
      disabled={!billingAccess.operationalAllowed}
      title={billingAccess.operationalAllowed ? undefined : billingAccess.actionBlockedReason}
      onClick={() => navigate('/ecommerce-orders/returns/new')}
    >
      <Plus aria-hidden />
      {t('Create return', 'إنشاء مرتجع')}
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Online returns', 'مرتجعات الطلبات الإلكترونية')}
        description={t('Returns for online store orders', 'مرتجعات طلبات المتجر الإلكتروني')}
        actions={createButton}
      />

      <OmsSectionTabs isArabic={isArabic} />

      {pagination.isError ? (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={t('Could not load returns', 'تعذر تحميل المرتجعات')}
            description={(pagination.error as Error)?.message}
            retryLabel={t('Retry', 'إعادة المحاولة')}
            onRetry={() => void pagination.refetch?.()}
          />
        </div>
      ) : !pagination.isInitialLoading && pagination.rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={RotateCcw}
            title={t('No returns yet', 'لا توجد مرتجعات بعد')}
            description={t('Create a return for an online order.', 'أنشئ مرتجعاً لطلب إلكتروني.')}
            action={
              billingAccess.operationalAllowed ? (
                <Button type="button" onClick={() => navigate('/ecommerce-orders/returns/new')}>
                  <Plus aria-hidden />
                  {t('Create first return', 'إنشاء أول مرتجع')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <DataTable<ClientOmsReturnRow>
          columns={columns}
          data={pagination.rows}
          getRowId={(row) => row.id}
          loading={pagination.isInitialLoading}
          empty={t('No returns yet', 'لا توجد مرتجعات بعد')}
          onRowClick={(row) => navigate(`/ecommerce-orders/returns/${row.id}`)}
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
