import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate, useUiPreferences } from '@emdad/core'
import { DataTable, FilterBar, PageHeader, ResetFiltersButton, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Input } from '@emdad/ui/ui/input'
import {
  CycleCountApi,
  type CycleCountListItem,
  type CycleCountProductHistoryRow,
  type CycleCountStatus,
} from '@/api/cycle-count'
import { WorkersApi } from '@/api/workers'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useTenantCompanyId } from '@/hooks/useTenantCompanyId'
import { useFilters } from '@/hooks/useFilters'
import { CycleCountStatusBadge } from './cycle-count-ui'

type Tab = 'sessions' | 'schedule'
type FilterDraft = {
  status: string
  assignedWorkerId: string
  overdueOnly: string
  discrepancyOnly: string
  dateFrom: string
  dateTo: string
}

function isOverdue(nextDueAt: string | null | undefined): boolean {
  if (!nextDueAt) return false
  return new Date(nextDueAt).getTime() < Date.now()
}

export function CycleCountListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const { warehouseId: wid } = useDefaultWarehouseId()
  const companyId = useTenantCompanyId()
  const [tab, setTab] = useState<Tab>('sessions')

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters<FilterDraft>({
    status: '',
    assignedWorkerId: '',
    overdueOnly: '',
    discrepancyOnly: '',
    dateFrom: '',
    dateTo: '',
  })

  const sessionListParams = useMemo(() => {
    const params: Record<string, string | undefined> = {
      companyId: companyId || undefined,
      warehouseId: wid || undefined,
    }
    if (appliedFilters.discrepancyOnly === 'yes') params.discrepancyOnly = 'yes'
    else if (appliedFilters.status) params.status = appliedFilters.status
    if (appliedFilters.assignedWorkerId) params.assignedWorkerId = appliedFilters.assignedWorkerId
    if (appliedFilters.dateFrom) params.createdFrom = appliedFilters.dateFrom
    if (appliedFilters.dateTo) params.createdTo = appliedFilters.dateTo
    return params
  }, [appliedFilters, companyId, wid])

  const scheduleListParams = useMemo(
    () => ({
      companyId: companyId || undefined,
      warehouseId: wid || undefined,
      overdueOnly: appliedFilters.overdueOnly === 'yes' ? 'yes' : undefined,
      lastCountedFrom: appliedFilters.dateFrom || undefined,
      lastCountedTo: appliedFilters.dateTo || undefined,
    }),
    [appliedFilters, companyId, wid],
  )

  const countsPagination = useChunkedServerPagination<CycleCountListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: sessionListParams,
    fetchChunk: (offset, limit) =>
      CycleCountApi.listCounts({
        ...sessionListParams,
        status: sessionListParams.status as CycleCountStatus | undefined,
        offset,
        limit,
      }),
    rtQueryKeyPrefix: QK.cycleCount.all,
    chunkQueryKeyPrefix: 'cycle-count-chunk',
    enabled: !!wid && !!companyId && tab === 'sessions',
  })

  const historyPagination = useChunkedServerPagination<CycleCountProductHistoryRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: scheduleListParams,
    fetchChunk: (offset, limit) =>
      CycleCountApi.listProductHistory({
        warehouseId: wid!,
        companyId: companyId || undefined,
        overdueOnly: scheduleListParams.overdueOnly,
        lastCountedFrom: scheduleListParams.lastCountedFrom,
        lastCountedTo: scheduleListParams.lastCountedTo,
        offset,
        limit,
      }),
    rtQueryKeyPrefix: QK.cycleCount.all,
    chunkQueryKeyPrefix: 'cycle-count-history-chunk',
    enabled: !!wid && !!companyId && tab === 'schedule',
  })

  const scheduleQuery = useQuery({
    queryKey: QK.cycleCount.schedules(companyId || wid),
    queryFn: () => CycleCountApi.listSchedules(companyId || undefined),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })

  const workersQuery = useQuery({
    queryKey: [...QK.workers.all, wid],
    queryFn: () => WorkersApi.list({ warehouseId: wid || undefined, companyId: companyId || undefined }),
    enabled: !!wid,
    staleTime: 5 * 60_000,
  })

  const intervalByWh = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scheduleQuery.data ?? []) m.set(s.warehouseId, s.intervalDays)
    return m
  }, [scheduleQuery.data])

  const sessionCols = useMemo<ColumnDef<CycleCountListItem>[]>(
    () => [
      { id: 'wh', header: t('Warehouse', 'المستودع'), cell: ({ row }) => row.original.warehouse?.code ?? '—' },
      { id: 'st', header: t('Status', 'الحالة'), cell: ({ row }) => <CycleCountStatusBadge status={row.original.status} isArabic={isArabic} /> },
      { id: 'lines', header: t('Lines', 'البنود'), cell: ({ row }) => <span className="font-mono text-sm">{row.original._count?.lines ?? 0}</span> },
      {
        id: 'disc',
        header: t('Discrepancy', 'فرق'),
        cell: ({ row }) =>
          row.original.status === 'pending_review' ? (
            <span className="text-sm font-medium text-amber-700">{t('Review', 'مراجعة')}</span>
          ) : (
            '—'
          ),
      },
      { id: 'worker', header: t('Assigned', 'المكلف'), cell: ({ row }) => row.original.assignedWorker?.displayName ?? '—' },
      {
        id: 'int',
        header: t('Interval', 'الفترة'),
        cell: ({ row }) => {
          const d = row.original.schedule?.intervalDays ?? intervalByWh.get(row.original.warehouseId)
          return d ? `${d}d` : '—'
        },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => formatDate(row.original.createdAt, locale),
      },
    ],
    [intervalByWh, isArabic, locale, t],
  )

  const scheduleCols = useMemo<ColumnDef<CycleCountProductHistoryRow>[]>(
    () => [
      {
        id: 'product',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.product.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{row.original.product.sku}</div>
          </div>
        ),
      },
      { id: 'last', header: t('Last count', 'آخر جرد'), cell: ({ row }) => formatDate(row.original.lastCountedAt, locale) },
      {
        id: 'next',
        header: t('Next due', 'الاستحقاق'),
        cell: ({ row }) => {
          if (!row.original.nextDueAt) return '—'
          const overdue = isOverdue(row.original.nextDueAt)
          return (
            <span className={overdue ? 'font-semibold text-destructive' : ''}>
              {formatDate(row.original.nextDueAt, locale)}
              {overdue ? ` (${t('overdue', 'متأخر')})` : ''}
            </span>
          )
        },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <CycleCountStatusBadge
            status={isOverdue(row.original.nextDueAt) ? 'pending_review' : 'scheduled'}
            isArabic={isArabic}
          />
        ),
      },
      {
        id: 'rec',
        header: t('Recurrence', 'التكرار'),
        cell: ({ row }) => {
          const d = intervalByWh.get(row.original.warehouseId)
          return d ? `${d} ${t('days', 'يوم')}` : '—'
        },
      },
      { id: 'cnt', header: t('Counts', 'مرات'), cell: ({ row }) => <span className="font-mono text-sm">{row.original.completionCount}</span> },
    ],
    [intervalByWh, isArabic, locale, t],
  )

  const workerOptions = useMemo(
    () => [
      { value: '', label: t('All workers', 'كل العمال') },
      ...(workersQuery.data ?? []).map((w) => ({ value: w.id, label: w.displayName })),
    ],
    [workersQuery.data, t],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Cycle count', 'الجرد الدوري')}
        description={t(
          'Operational inventory verification — sessions, schedules, and discrepancies.',
          'التحقق التشغيلي من المخزون — الجلسات والجداول والفروقات.',
        )}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={tab === 'sessions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('sessions')}>
          {t('Count sessions', 'جلسات الجرد')}
        </Button>
        <Button type="button" variant={tab === 'schedule' ? 'default' : 'outline'} size="sm" onClick={() => setTab('schedule')}>
          {t('Product schedule', 'جدول المنتجات')}
        </Button>
      </div>

      <FilterBar>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tab === 'sessions' ? (
            <>
              <div className="space-y-1.5">
                <Label>{t('Status', 'الحالة')}</Label>
                <Select value={draftFilters.status || '__all'} onValueChange={(v) => setDraft({ status: v === '__all' ? '' : v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">{t('All statuses', 'كل الحالات')}</SelectItem>
                    {(['scheduled', 'in_progress', 'pending_review', 'completed', 'cancelled'] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('Assigned worker', 'العامل')}</Label>
                <Select
                  value={draftFilters.assignedWorkerId || '__all'}
                  onValueChange={(v) => setDraft({ assignedWorkerId: v === '__all' ? '' : v })}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workerOptions.map((o) => (
                      <SelectItem key={o.value || '__all'} value={o.value || '__all'}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('Discrepancy only', 'فروقات فقط')}</Label>
                <Select
                  value={draftFilters.discrepancyOnly || '__any'}
                  onValueChange={(v) => setDraft({ discrepancyOnly: v === '__yes' ? 'yes' : '' })}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">{t('Any', 'الكل')}</SelectItem>
                    <SelectItem value="__yes">{t('Yes', 'نعم')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>{t('Overdue only', 'متأخر فقط')}</Label>
              <Select
                value={draftFilters.overdueOnly || '__any'}
                onValueChange={(v) => setDraft({ overdueOnly: v === '__yes' ? 'yes' : '' })}
              >
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any">{t('Any', 'الكل')}</SelectItem>
                  <SelectItem value="__yes">{t('Yes', 'نعم')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t('Date from', 'من تاريخ')}</Label>
            <Input type="date" value={draftFilters.dateFrom} onChange={(e) => setDraft({ dateFrom: e.target.value })} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Date to', 'إلى تاريخ')}</Label>
            <Input type="date" value={draftFilters.dateTo} onChange={(e) => setDraft({ dateTo: e.target.value })} className="text-sm" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={applyFilters}>{t('Apply filters', 'تطبيق الفلاتر')}</Button>
          <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={resetFilters} />
        </div>
      </FilterBar>

      {tab === 'sessions' ? (
        <DataTable<CycleCountListItem>
          columns={sessionCols}
          data={countsPagination.rows}
          getRowId={(r) => r.id}
          loading={countsPagination.isInitialLoading}
          onRowClick={(row) => navigate(`/cycle-count/${row.id}`)}
          pagination={{
            page: countsPagination.page,
            pageSize: countsPagination.pageSize,
            total: countsPagination.total,
            onPageChange: countsPagination.setPage,
            onPageSizeChange: () => {},
          }}
          empty={t('No cycle counts for this warehouse.', 'لا توجد جلسات جرد.')}
        />
      ) : (
        <DataTable<CycleCountProductHistoryRow>
          columns={scheduleCols}
          data={historyPagination.rows}
          getRowId={(r) => r.id}
          loading={historyPagination.isInitialLoading}
          pagination={{
            page: historyPagination.page,
            pageSize: historyPagination.pageSize,
            total: historyPagination.total,
            onPageChange: historyPagination.setPage,
            onPageSizeChange: () => {},
          }}
          empty={t('No product count history yet.', 'لا يوجد سجل جرد للمنتجات.')}
        />
      )}
    </div>
  )
}
