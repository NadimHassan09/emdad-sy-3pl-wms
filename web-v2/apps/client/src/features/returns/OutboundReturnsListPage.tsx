import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, RotateCcw } from 'lucide-react'
import { formatDate, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { WmsSectionTabs } from '@/features/_shared/WmsSectionTabs'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import {
  fetchClientReturns,
  type ClientReturnOrderRow,
} from '@/services/clientReturnsService'
import { ReturnStatusBadge } from './returns-ui'

export function OutboundReturnsListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const billingAccess = useClientOperationalAccess(isArabic)

  const pagination = useChunkedServerPagination<ClientReturnOrderRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: { source: 'outbound' },
    fetchChunk: (offset, limit) => fetchClientReturns({ offset, limit, source: 'outbound' }),
    rtQueryKeyPrefix: ['client', 'returns', 'outbound'],
    chunkQueryKeyPrefix: 'client-returns-outbound-chunk',
  })

  const columns = useMemo<ColumnDef<ClientReturnOrderRow>[]>(
    () => [
      {
        id: 'returnNumber',
        header: t('Return #', 'رقم الإرجاع'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {row.original.orderNumber || row.original.id.slice(0, 8)}
          </span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <ReturnStatusBadge status={row.original.status} isArabic={isArabic} />
        ),
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'linkedOrder',
        header: t('Linked order', 'الطلب المرتبط'),
        cell: ({ row }) =>
          row.original.originalOutbound?.orderNumber ??
          (row.original.clientReference?.startsWith('oms:')
            ? row.original.clientReference.slice(4)
            : '—'),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'lines',
        header: t('Lines', 'البنود'),
        cell: ({ row }) => row.original._count?.lines ?? 0,
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
      onClick={() => navigate('/outbound-orders/returns/new')}
    >
      <Plus aria-hidden />
      {t('Create return', 'إنشاء مرتجع')}
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Outbound returns', 'مرتجعات الصادر')}
        description={t(
          'Returns for warehouse outbound shipments',
          'مرتجعات شحنات الصادر من المستودع',
        )}
        actions={createButton}
      />

      <WmsSectionTabs isArabic={isArabic} />

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
            description={t(
              'Create a return for a shipped outbound order.',
              'أنشئ مرتجعاً لطلب صادر مشحون.',
            )}
            action={
              billingAccess.operationalAllowed ? (
                <Button type="button" onClick={() => navigate('/outbound-orders/returns/new')}>
                  <Plus aria-hidden />
                  {t('Create first return', 'إنشاء أول مرتجع')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <DataTable<ClientReturnOrderRow>
          columns={columns}
          data={pagination.rows}
          getRowId={(row) => row.id}
          loading={pagination.isInitialLoading}
          empty={t('No returns yet', 'لا توجد مرتجعات بعد')}
          onRowClick={(row) => navigate(`/outbound-orders/returns/${row.id}`)}
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
