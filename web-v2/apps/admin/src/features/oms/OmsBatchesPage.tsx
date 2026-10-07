import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Layers } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { DataTable, KpiCard, KpiStrip, PageHeader, SearchInput, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { OmsApi, type OmsBatchSummary } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import { omsOperationalStageLabel } from '@/lib/oms-operational-stage'
import { OmsStatusBadge } from './oms-ui'

function stageLabel(batch: OmsBatchSummary, isArabic: boolean) {
  if (batch.stageKind === 'operational' && batch.stageKey) {
    return omsOperationalStageLabel(batch.stageKey, isArabic)
  }
  if (batch.stageKind === 'status' && batch.stageKey) {
    return <OmsStatusBadge status={batch.stageKey} isArabic={isArabic} />
  }
  if (batch.stageKind === 'mixed') return isArabic ? 'متعدد' : 'Mixed'
  return '—'
}

export function OmsBatchesPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')

  const query = useQuery({
    queryKey: [...QK.omsBatches, applied],
    queryFn: () => OmsApi.listBatches(applied),
  })

  const rows = query.data ?? []
  const totals = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.orderCount > 0 && row.completedCount < row.orderCount).length,
      issues: rows.filter((row) => row.issueCount > 0).length,
      completed: rows.filter((row) => row.orderCount > 0 && row.completedCount === row.orderCount).length,
    }),
    [rows],
  )

  const columns = useMemo<ColumnDef<OmsBatchSummary>[]>(
    () => [
      {
        id: 'batch',
        header: t('Batch', 'المجموعة'),
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.batchNumber}</div>
            {row.original.name ? <div className="text-xs text-muted-foreground">{row.original.name}</div> : null}
          </div>
        ),
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'orders',
        header: t('Orders', 'الطلبات'),
        cell: ({ row }) => row.original.orderCount,
        meta: { priority: 1, align: 'end', className: 'min-w-20 tabular' },
      },
      {
        id: 'stage',
        header: t('Current stage', 'المرحلة الحالية'),
        cell: ({ row }) => stageLabel(row.original, isArabic),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'progress',
        header: t('Progress', 'التقدم'),
        cell: ({ row }) => {
          const { completedCount, orderCount } = row.original
          const pct = orderCount ? Math.round((completedCount / orderCount) * 100) : 0
          return (
            <div className="min-w-36">
              <div className="mb-1 text-xs tabular">
                {completedCount} / {orderCount}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-tone-success-bg">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        },
        meta: { priority: 2, className: 'min-w-40' },
      },
      {
        id: 'issues',
        header: t('Issues', 'المشكلات'),
        cell: ({ row }) => (
          <span className={row.original.issueCount ? 'font-semibold text-tone-danger-fg tabular' : 'text-tone-success-fg tabular'}>
            {row.original.issueCount}
          </span>
        ),
        meta: { priority: 2, align: 'end', className: 'min-w-20' },
      },
      {
        id: 'createdBy',
        header: t('Created by', 'أنشأها'),
        cell: ({ row }) => row.original.createdByName,
        meta: { priority: 3, className: 'min-w-28' },
      },
      {
        id: 'createdAt',
        header: t('Created at', 'تاريخ الإنشاء'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
        meta: { priority: 3, className: 'min-w-36' },
      },
      {
        id: 'open',
        header: () => <span className="sr-only">{t('Open', 'فتح')}</span>,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate(`/oms/batches/${row.original.id}`)}
            >
              {t('Open', 'فتح')}
            </Button>
          </div>
        ),
        meta: { priority: 1, align: 'end', className: 'w-24 min-w-24', cardAction: true },
      },
    ],
    [isArabic, locale, navigate], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Batches', 'المجموعات')}
        description={
          t(
            'Persistent groups of orders you can continue across stages without selecting them again.',
            'مجموعات محفوظة من الطلبات يمكن متابعتها عبر المراحل دون إعادة التحديد.',
          )
        }
      />

      <KpiStrip cols={4}>
        <KpiCard title={t('Total batches', 'كل المجموعات')} value={totals.total} icon={Layers} />
        <KpiCard title={t('Active batches', 'قيد العمل')} value={totals.active} icon={Layers} />
        <KpiCard title={t('Batches with issues', 'فيها مشكلات')} value={totals.issues} icon={Layers} />
        <KpiCard title={t('Completed batches', 'مكتملة')} value={totals.completed} icon={Layers} />
      </KpiStrip>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(search.trim())
        }}
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('Search by batch number or name', 'بحث برقم المجموعة أو الاسم')}
          clearLabel={t('Clear search', 'مسح البحث')}
          className="max-w-md"
        />
        <Button type="submit" variant="secondary">
          {t('Apply', 'بحث')}
        </Button>
      </form>

      <DataTable<OmsBatchSummary>
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        loading={query.isLoading}
        empty={t('No batches yet.', 'لا توجد مجموعات بعد.')}
        onRowClick={(row) => navigate(`/oms/batches/${row.id}`)}
      />
    </div>
  )
}
