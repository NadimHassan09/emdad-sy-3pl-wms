import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useSearchParams } from 'react-router'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  FilterBar,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { TasksApi, type WarehouseTaskListItem } from '@/api/tasks'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_TASKS, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { useTaskOrderNumbers } from '@/hooks/useTaskOrderNumbers'
import { resolveTaskListSearch } from '@/lib/task-list-search'
import {
  formatTaskDuration,
  isTaskTimingCompleteStatus,
  taskListDurationMs,
  taskListEndedAtIso,
  taskListStartedAtIso,
} from '@/lib/task-timing'
import { taskAssignedWorkerLabel } from '@/lib/task-worker-label'
import { isOperatorRole } from '@/lib/rbac'
import { prettyWorkflowTaskType } from '@/lib/workflow-next-task'
import { TaskStatusBadge, taskTypeLabel } from './task-ui'

type TaskListFilters = { taskType: string; status: string; search: string }

const TASK_TYPES = [
  '',
  'receiving',
  'qc',
  'putaway',
  'putaway_quarantine',
  'pick',
  'pack',
  'shipping_details',
  'dispatch',
  'routing',
]

const STATUSES = ['', 'pending', 'assigned', 'in_progress', 'completed', 'blocked', 'failed', 'retry_pending', 'cancelled']

export function TasksListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const tt = (m: [string, string]) => (isArabic ? m[1] : m[0])
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters, applyPatch } =
    useFilters<TaskListFilters>({ taskType: '', status: '', search: '' })

  useEffect(() => {
    const ttParam = searchParams.get('taskType') ?? ''
    if (ttParam !== appliedFilters.taskType) applyPatch({ taskType: ttParam })
  }, [searchParams, appliedFilters.taskType, applyPatch])

  const searchResolve = useQuery({
    queryKey: ['tasks-search-resolve', appliedFilters.search.trim()] as const,
    queryFn: () => resolveTaskListSearch(appliedFilters.search),
    enabled: !!appliedFilters.search.trim(),
    staleTime: 30_000,
  })

  const taskFilterKey = useMemo(() => {
    const f: Record<string, string | undefined> = {}
    const tt = appliedFilters.taskType.trim()
    if (tt) f.taskType = tt
    const st = appliedFilters.status.trim()
    if (st) f.status = st
    if (isOperatorRole(user?.role) && user?.workerId) f.workerId = user.workerId
    const resolved = searchResolve.data
    if (resolved?.kind === 'referenceId') f.referenceId = resolved.referenceId
    else if (resolved?.kind === 'singleTask') {
      const ref = resolved.task.workflowInstance?.referenceId
      if (ref) f.referenceId = ref
    }
    return f
  }, [appliedFilters, searchResolve.data, user?.role, user?.workerId])

  const searchPending = !!appliedFilters.search.trim() && (searchResolve.isLoading || searchResolve.isFetching)
  const searchNoMatch = searchResolve.data?.kind === 'noMatch'

  const pagination = useChunkedServerPagination<WarehouseTaskListItem>({
    chunkSize: CHUNK_SIZE_TASKS,
    filterKey: taskFilterKey,
    fetchChunk: (offset, limit) =>
      TasksApi.list({ ...taskFilterKey, offset: String(offset), limit: String(limit) }),
    rtQueryKeyPrefix: QK.tasks.all,
    chunkQueryKeyPrefix: 'tasks-chunk',
    enabled: !searchPending && !searchNoMatch,
  })

  const displayRows = useMemo(() => {
    if (searchResolve.data?.kind === 'noMatch') return []
    if (searchResolve.data?.kind === 'singleTask') {
      const task = searchResolve.data.task
      if (appliedFilters.taskType.trim() && task.taskType !== appliedFilters.taskType.trim()) return []
      if (appliedFilters.status.trim() && task.status !== appliedFilters.status.trim()) return []
      if (pagination.rows.some((r) => r.id === task.id)) return pagination.rows
      return [task]
    }
    return pagination.rows
  }, [searchResolve.data, pagination.rows, appliedFilters.taskType, appliedFilters.status])

  const orderNumbers = useTaskOrderNumbers(displayRows)
  const [now, setNow] = useState(() => Date.now())
  const hasRunning = displayRows.some((r) => taskListStartedAtIso(r) && !isTaskTimingCompleteStatus(r.status))
  useEffect(() => {
    if (!hasRunning) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasRunning])

  const columns = useMemo<ColumnDef<WarehouseTaskListItem>[]>(
    () => [
      {
        id: 'type',
        header: t('Task type', 'نوع المهمة'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{prettyWorkflowTaskType(row.original.taskType, tt)}</span>
        ),
      },
      {
        id: 'order',
        header: t('Order #', 'رقم الطلب'),
        cell: ({ row }) => {
          const ref = row.original.workflowInstance?.referenceId
          const orderNo = ref ? orderNumbers.get(ref) : undefined
          return (
            <div className="min-w-0 font-mono text-sm">
              <div className="font-semibold">{orderNo ?? (ref ? `${ref.slice(0, 8)}…` : '—')}</div>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <TaskStatusBadge status={row.original.status} isArabic={isArabic} />,
      },
      {
        id: 'worker',
        header: t('Assigned worker', 'العامل المكلف'),
        cell: ({ row }) => <span className="text-sm">{taskAssignedWorkerLabel(row.original.assignments)}</span>,
      },
      {
        id: 'started',
        header: t('Started at', 'بدأ في'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(taskListStartedAtIso(row.original), locale) || '—'}
          </span>
        ),
      },
      {
        id: 'ended',
        header: t('Ended at', 'انتهى في'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(taskListEndedAtIso(row.original), locale) || '—'}
          </span>
        ),
      },
      {
        id: 'duration',
        header: t('Duration', 'المدة'),
        cell: ({ row }) => {
          const ms = taskListDurationMs(row.original, now)
          return <span className="font-mono text-sm tabular-nums">{ms != null ? formatTaskDuration(ms) : '—'}</span>
        },
      },
    ],
    [isArabic, locale, now, orderNumbers, t, tt],
  )

  const apply = () => {
    applyFilters()
    const ttVal = draftFilters.taskType.trim()
    setSearchParams(ttVal ? { taskType: ttVal } : {}, { replace: true })
  }

  const reset = () => {
    resetFilters()
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('Warehouse tasks', 'مهام المستودع')} />
      <FilterBar>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('Search', 'بحث')}</Label>
            <SearchInput
              value={draftFilters.search}
              onChange={(v) => setDraft({ search: v })}
              placeholder={t('Order number or task / order id', 'رقم الطلب أو معرف المهمة / الطلب')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Task type', 'نوع المهمة')}</Label>
            <Select value={draftFilters.taskType || '__all'} onValueChange={(v) => setDraft({ taskType: v === '__all' ? '' : v })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t('All task types', 'كل أنواع المهام')}</SelectItem>
                {TASK_TYPES.filter(Boolean).map((k) => (
                  <SelectItem key={k} value={k}>{taskTypeLabel(k, isArabic)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Status', 'الحالة')}</Label>
            <Select value={draftFilters.status || '__all'} onValueChange={(v) => setDraft({ status: v === '__all' ? '' : v })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t('All statuses', 'كل الحالات')}</SelectItem>
                {STATUSES.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={apply}>{t('Apply filters', 'تطبيق الفلاتر')}</Button>
          <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={reset} />
        </div>
      </FilterBar>

      <DataTable<WarehouseTaskListItem>
        columns={columns}
        data={displayRows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading || searchPending}
        onRowClick={(row) => {
          const cid = row.workflowInstance?.companyId
          navigate(cid ? `/tasks/${row.id}?companyId=${encodeURIComponent(cid)}` : `/tasks/${row.id}`)
        }}
        pagination={
          searchResolve.data?.kind === 'singleTask' || searchResolve.data?.kind === 'noMatch'
            ? undefined
            : {
                page: pagination.page,
                pageSize: pagination.pageSize,
                total: pagination.total,
                onPageChange: pagination.setPage,
                onPageSizeChange: () => {},
              }
        }
        empty={
          searchNoMatch
            ? t('No tasks match this search.', 'لا مهام مطابقة لهذا البحث.')
            : t('No warehouse tasks yet.', 'لا توجد مهام مستودع بعد.')
        }
      />
    </div>
  )
}
