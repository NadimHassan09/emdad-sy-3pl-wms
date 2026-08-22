import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import type { WarehouseTaskListItem } from '../api/tasks';
import { TasksApi } from '../api/tasks';
import { Alert, Button } from '@ds';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';
import { useAuth } from '../auth/AuthContext';
import { useFilters } from '../hooks/useFilters';
import { useTaskOrderNumbers } from '../hooks/useTaskOrderNumbers';
import {
  TASK_LIST_DEFAULT_PAGE_SIZE,
  useServerPagination,
} from '../hooks/useServerPagination';
import { isOperatorRole } from '../lib/rbac';
import { formatTaskDateTime } from '../lib/task-details-helpers';
import { resolveTaskListSearch } from '../lib/task-list-search';
import {
  formatTaskDuration,
  isTaskTimingCompleteStatus,
  taskListDurationMs,
  taskListEndedAtIso,
  taskListStartedAtIso,
} from '../lib/task-timing';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';
import { useWmsTranslation } from '../lib/ui-i18n';
import { prettyWorkflowTaskType } from '../lib/workflow-next-task';

type TaskListFilters = {
  taskType: string;
  status: string;
  search: string;
};

export function TasksListPage() {
  const { user } = useAuth();
  const { t, isArabic } = useWmsTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTaskFilters = useMemo<TaskListFilters>(
    () => ({ taskType: '', status: '', search: '' }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters, applyPatch } =
    useFilters(initialTaskFilters);

  useEffect(() => {
    const tt = searchParams.get('taskType') ?? '';
    if (tt !== appliedFilters.taskType) {
      applyPatch({ taskType: tt });
    }
  }, [searchParams, appliedFilters.taskType, applyPatch]);

  const handleApplyFilters = () => {
    applyFilters();
    const tt = draftFilters.taskType.trim();
    setSearchParams(tt ? { taskType: tt } : {}, { replace: true });
  };

  const handleResetFilters = () => {
    resetFilters();
    setSearchParams({}, { replace: true });
  };

  const searchResolve = useQuery({
    queryKey: ['tasks-search-resolve', appliedFilters.search.trim()] as const,
    queryFn: () => resolveTaskListSearch(appliedFilters.search),
    enabled: !!appliedFilters.search.trim(),
    staleTime: 30_000,
  });

  const taskFilterKey = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    const tt = appliedFilters.taskType.trim();
    if (tt) f.taskType = tt;
    const st = appliedFilters.status.trim();
    if (st) f.status = st;
    if (isOperatorRole(user?.role) && user?.workerId) {
      f.workerId = user.workerId;
    }
    const resolved = searchResolve.data;
    if (resolved?.kind === 'referenceId') {
      f.referenceId = resolved.referenceId;
    } else if (resolved?.kind === 'singleTask') {
      const ref = resolved.task.workflowInstance?.referenceId;
      if (ref) f.referenceId = ref;
    }
    return f;
  }, [
    appliedFilters.taskType,
    appliedFilters.status,
    searchResolve.data,
    user?.role,
    user?.workerId,
  ]);

  const searchPending = !!appliedFilters.search.trim() && (searchResolve.isLoading || searchResolve.isFetching);
  const searchNoMatch = searchResolve.data?.kind === 'noMatch';

  const pagination = useServerPagination<WarehouseTaskListItem>({
    filterKey: taskFilterKey,
    queryKey: QK.tasks.list(taskFilterKey),
    fetchPage: (offset, limit) =>
      TasksApi.list({
        ...taskFilterKey,
        offset: String(offset),
        limit: String(limit),
      }),
    defaultPageSize: TASK_LIST_DEFAULT_PAGE_SIZE,
    enabled: !searchPending && !searchNoMatch,
  });

  const displayRows = useMemo(() => {
    if (searchResolve.data?.kind === 'noMatch') return [] as WarehouseTaskListItem[];
    if (searchResolve.data?.kind === 'singleTask') {
      const task = searchResolve.data.task;
      const tt = appliedFilters.taskType.trim();
      const st = appliedFilters.status.trim();
      if (tt && task.taskType !== tt) return [];
      if (st && task.status !== st) return [];
      // Prefer server page filtered by reference when available; fall back to single
      if (pagination.rows.some((r) => r.id === task.id)) return pagination.rows;
      return [task];
    }
    return pagination.rows;
  }, [searchResolve.data, pagination.rows, appliedFilters.taskType, appliedFilters.status]);

  const orderNumbers = useTaskOrderNumbers(displayRows);

  const [now, setNow] = useState(() => Date.now());
  const hasRunningTasks = displayRows.some(
    (row) => taskListStartedAtIso(row) && !isTaskTimingCompleteStatus(row.status),
  );

  useEffect(() => {
    if (!hasRunningTasks) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasRunningTasks]);

  const taskTypeOptions = [
    { value: '', label: t(['All task types', 'كل أنواع المهام']) },
    { value: 'receiving', label: t(['Receiving', 'استلام']) },
    { value: 'qc', label: t(['Quality check', 'فحص الجودة']) },
    { value: 'putaway', label: t(['Putaway', 'تخزين']) },
    { value: 'putaway_quarantine', label: t(['Putaway (quarantine)', 'تخزين (حجر صحي)']) },
    { value: 'pick', label: t(['Pick', 'التقاط']) },
    { value: 'pack', label: t(['Pack', 'تغليف']) },
    { value: 'shipping_details', label: t(['Shipping details', 'تفاصيل الشحن']) },
    { value: 'dispatch', label: t(['Dispatch', 'إرسال']) },
    { value: 'routing', label: t(['Routing', 'توجيه']) },
  ];

  const statusFilterOptions = [
    { value: '', label: t(['All statuses', 'كل الحالات']) },
    { value: 'pending', label: t(['Pending', 'قيد الانتظار']) },
    { value: 'assigned', label: t(['Assigned', 'معين']) },
    { value: 'in_progress', label: t(['In progress', 'قيد التنفيذ']) },
    { value: 'completed', label: t(['Completed', 'مكتمل']) },
    { value: 'blocked', label: t(['Blocked', 'محظور']) },
    { value: 'failed', label: t(['Failed', 'فشل']) },
    { value: 'retry_pending', label: t(['Retry pending', 'بانتظار إعادة المحاولة']) },
    { value: 'cancelled', label: t(['Cancelled', 'ملغي']) },
  ];

  const hasActiveFilters = !!(
    appliedFilters.taskType.trim() ||
    appliedFilters.status.trim() ||
    appliedFilters.search.trim()
  );

  const chips = [
    appliedFilters.taskType.trim()
      ? {
          key: 'taskType',
          label: `${t(['Type', 'النوع'])}: ${prettyWorkflowTaskType(appliedFilters.taskType, t)}`,
          onClear: () => {
            applyPatch({ taskType: '' });
            setSearchParams({}, { replace: true });
          },
        }
      : null,
    appliedFilters.status.trim()
      ? {
          key: 'status',
          label: `${t(['Status', 'الحالة'])}: ${appliedFilters.status}`,
          onClear: () => applyPatch({ status: '' }),
        }
      : null,
    appliedFilters.search.trim()
      ? {
          key: 'search',
          label: `${t(['Search', 'بحث'])}: ${appliedFilters.search.trim()}`,
          onClear: () => applyPatch({ search: '' }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; onClear: () => void }>;

  const columns: Column<WarehouseTaskListItem>[] = [
    {
      header: t(['Task type', 'نوع المهمة']),
      accessor: (r) => (
        <span className="text-sm font-medium text-text-strong">
          {prettyWorkflowTaskType(r.taskType, t)}
        </span>
      ),
      width: '150px',
    },
    {
      header: t(['Order #', 'رقم الطلب']),
      accessor: (r) => {
        const ref = r.workflowInstance?.referenceId;
        const orderNo = ref ? orderNumbers.get(ref) : undefined;
        return (
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-text-strong">
              {orderNo ?? (ref ? `${ref.slice(0, 8)}…` : '—')}
            </div>
            {orderNo && ref ? (
              <div className="truncate font-mono text-[10px] text-text-faint" title={ref}>
                {ref.slice(0, 8)}…
              </div>
            ) : null}
          </div>
        );
      },
      width: '150px',
    },
    { header: t(['Status', 'الحالة']), accessor: (r) => <StatusBadge status={r.status} />, width: '140px' },
    {
      header: t(['Assigned worker', 'العامل المكلف']),
      accessor: (r) => taskAssignedWorkerLabel(r.assignments),
      width: '180px',
    },
    {
      header: t(['Started at', 'بدأ في']),
      accessor: (r) => (
        <span className="text-xs text-text-body">{formatTaskDateTime(taskListStartedAtIso(r))}</span>
      ),
      width: '170px',
    },
    {
      header: t(['Ended at', 'انتهى في']),
      accessor: (r) => (
        <span className="text-xs text-text-body">{formatTaskDateTime(taskListEndedAtIso(r))}</span>
      ),
      width: '170px',
    },
    {
      header: t(['Duration', 'المدة']),
      accessor: (r) => {
        const durationMs = taskListDurationMs(r, now);
        return (
          <span className="font-mono text-xs tabular-nums text-text-body">
            {durationMs != null ? formatTaskDuration(durationMs) : '—'}
          </span>
        );
      },
      width: '110px',
    },
  ];

  const emptyMessage = hasActiveFilters
    ? t(['No tasks match these filters.', 'لا توجد مهام مطابقة لهذه الفلاتر.'])
    : t(['No warehouse tasks yet.', 'لا توجد مهام مستودع بعد.']);

  return (
    <AdminListPageShell
      icon="fa-list-check"
      title={t(['Warehouse tasks', 'مهام المستودع'])}
      isArabic={isArabic}
    >
      <FilterPanel
        title={t(['Task filters', 'فلاتر المهام'])}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        loading={pagination.isFetching || searchResolve.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
        chips={chips}
        onClearAllChips={chips.length ? handleResetFilters : undefined}
        compact={
          <TextField
            label={t(['Search', 'بحث'])}
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t([
              'Order number or task / order id',
              'رقم الطلب أو معرف المهمة / الطلب',
            ])}
          />
        }
        activeCount={[appliedFilters.taskType, appliedFilters.status, appliedFilters.search].filter((v) => String(v).trim()).length}
        advancedLabel={t(['Advanced Filtering', 'تصفية متقدمة'])}
        collapseLabel={t(['Collapsed', 'إخفاء'])}
      >
        <SelectField
          label={t(['Task type', 'نوع المهمة'])}
          name="taskTypeFilter"
          value={draftFilters.taskType}
          onChange={(e) => setDraft({ taskType: e.target.value })}
          options={taskTypeOptions}
        />
        <SelectField
          label={t(['Status', 'الحالة'])}
          name="taskStatusFilter"
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value })}
          options={statusFilterOptions}
        />
        <TextField
          label={t(['Search', 'بحث'])}
          value={draftFilters.search}
          onChange={(e) => setDraft({ search: e.target.value })}
          placeholder={t([
            'Order number or task / order id',
            'رقم الطلب أو معرف المهمة / الطلب',
          ])}
        />
      </FilterPanel>
      <DataTable
        columns={columns}
        rows={displayRows}
        rowKey={(r) => r.id}
        loading={pagination.isInitialLoading || (!!appliedFilters.search.trim() && searchResolve.isLoading)}
        empty={
          <div className="space-y-2 py-2 text-center">
            <p className="text-sm text-text-muted">{emptyMessage}</p>
            {hasActiveFilters ? (
              <Button type="button" variant="danger" size="sm" onClick={handleResetFilters}>
                {t(['Clear filters', 'مسح الفلاتر'])}
              </Button>
            ) : null}
          </div>
        }
        serverPagination={
          searchResolve.data?.kind === 'singleTask' || searchResolve.data?.kind === 'noMatch'
            ? undefined
            : pagination.serverPagination
        }
        onRowClick={(r) =>
          navigate(
            r.workflowInstance?.companyId
              ? `/tasks/${r.id}?companyId=${encodeURIComponent(r.workflowInstance.companyId)}`
              : `/tasks/${r.id}`,
          )
        }
      />
      {pagination.isError && (
        <Alert
          variant="error"
          title={t(['Failed to load tasks', 'فشل تحميل المهام'])}
          description={t([
            'There was a problem retrieving warehouse tasks. Check your connection and try again.',
            'حدثت مشكلة في جلب مهام المستودع. تحقق من اتصالك وأعد المحاولة.',
          ])}
          className="mt-3"
        >
          <Alert.Action onClick={() => pagination.refetch()}>
            {t(['Retry', 'إعادة المحاولة'])}
          </Alert.Action>
        </Alert>
      )}
    </AdminListPageShell>
  );
}
