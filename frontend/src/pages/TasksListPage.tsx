import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { WarehouseTaskListItem } from '../api/tasks';
import { TasksApi } from '../api/tasks';
import { Alert } from '@ds';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';
import { useAuth } from '../auth/AuthContext';
import { useFilters } from '../hooks/useFilters';
import {
  TASK_LIST_DEFAULT_PAGE_SIZE,
  useServerPagination,
} from '../hooks/useServerPagination';
import { isOperatorRole } from '../lib/rbac';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';
import { useWmsTranslation } from '../lib/ui-i18n';

type TaskListFilters = {
  taskType: string;
  status: string;
  search: string;
};

export function TasksListPage() {
  const { user } = useAuth();
  const { t } = useWmsTranslation();
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

  const taskFilterKey = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    const tt = appliedFilters.taskType.trim();
    if (tt) f.taskType = tt;
    const st = appliedFilters.status.trim();
    if (st) f.status = st;
    if (isOperatorRole(user?.role) && user?.workerId) {
      f.workerId = user.workerId;
    }
    const q = appliedFilters.search.trim();
    if (q) {
      f.referenceId = q;
    }
    return f;
  }, [appliedFilters.taskType, appliedFilters.status, appliedFilters.search, user?.role, user?.workerId]);

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
  });

  const taskTypeOptions = [
    { value: '', label: t(['All task types', 'كل أنواع المهام']) },
    { value: 'receiving', label: t(['Receiving', 'استلام']) },
    { value: 'qc', label: t(['Quality check', 'فحص الجودة']) },
    { value: 'putaway', label: t(['Putaway', 'تخزين']) },
    { value: 'putaway_quarantine', label: t(['Putaway (quarantine)', 'تخزين (حجر صحي)']) },
    { value: 'pick', label: t(['Pick', 'التقاط']) },
    { value: 'pack', label: t(['Pack', 'تغليف']) },
    { value: 'dispatch', label: t(['Dispatch', 'تسليم']) },
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

  const columns: Column<WarehouseTaskListItem>[] = [
    {
      header: t(['Task type', 'نوع المهمة']),
      accessor: (r) => <span className="font-mono text-sm">{r.taskType}</span>,
      width: '140px',
    },
    {
      header: t(['Reference', 'المرجع']),
      accessor: (r) => (
        <span className="font-mono text-xs" title={r.workflowInstance?.referenceId}>
          {r.workflowInstance?.referenceId
            ? `${r.workflowInstance.referenceId.slice(0, 8)}…`
            : '—'}
        </span>
      ),
      width: '130px',
    },
    { header: t(['Status', 'الحالة']), accessor: (r) => <StatusBadge status={r.status} />, width: '140px' },
    {
      header: t(['Assigned worker', 'العامل المكلف']),
      accessor: (r) => taskAssignedWorkerLabel(r.assignments),
      width: '180px',
    },
  ];

  return (
    <div>
      <FilterPanel
        title={t(['Task filters', 'فلاتر المهام'])}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
      >
        <div className="flex flex-wrap gap-5">
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
              'Search by order id, task id, or worker id',
              'ابحث بمعرف الطلب أو معرف المهمة أو معرف العامل',
            ])}
          />
        </div>
      </FilterPanel>
      <DataTable
        title={t(['Warehouse tasks', 'مهام المستودع'])}
        columns={columns}
        rows={pagination.rows}
        rowKey={(r) => r.id}
        loading={pagination.isInitialLoading}
        serverPagination={pagination.serverPagination}
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
    </div>
  );
}
