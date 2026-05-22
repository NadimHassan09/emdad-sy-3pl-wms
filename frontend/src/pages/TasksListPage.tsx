import { useQuery } from '@tanstack/react-query';
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
import { isOperatorRole } from '../lib/rbac';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';

type TaskListFilters = {
  taskType: string;
  search: string;
};

export function TasksListPage() {
  const { user } = useAuth();
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTaskFilters = useMemo<TaskListFilters>(
    () => ({ taskType: '', search: '' }),
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

  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    f.limit = '500';
    f.offset = '0';
    const tt = appliedFilters.taskType.trim();
    if (tt) f.taskType = tt;
    if (isOperatorRole(user?.role) && user?.workerId) {
      f.workerId = user.workerId;
    }
    const q = appliedFilters.search.trim();
    if (q) {
      // Server-side assist: typically matches related order reference ids.
      f.referenceId = q;
    }
    return f;
  }, [appliedFilters.taskType, appliedFilters.search, user?.role, user?.workerId]);

  const query = useQuery({
    queryKey: QK.tasks.list(filters),
    queryFn: () => TasksApi.list(filters),
  });
  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = appliedFilters.search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const taskId = r.id?.toLowerCase() ?? '';
      const refId = r.workflowInstance?.referenceId?.toLowerCase() ?? '';
      const workerId = r.assignments?.[0]?.worker?.id?.toLowerCase() ?? '';
      const workerName = taskAssignedWorkerLabel(r.assignments).toLowerCase();
      return taskId.includes(q) || refId.includes(q) || workerId.includes(q) || workerName.includes(q);
    });
  }, [query.data?.items, appliedFilters.search]);

  const taskTypeOptions = [
    { value: '', label: t('All task types', 'كل أنواع المهام') },
    { value: 'receiving',          label: t('Receiving',          'استلام') },
    { value: 'qc',                 label: t('Quality check',      'فحص الجودة') },
    { value: 'putaway',            label: t('Putaway',            'تخزين') },
    { value: 'putaway_quarantine', label: t('Putaway (quarantine)', 'تخزين (حجر صحي)') },
    { value: 'pick',               label: t('Pick',               'التقاط') },
    { value: 'pack',               label: t('Pack',               'تغليف') },
    { value: 'dispatch',           label: t('Dispatch',           'تسليم') },
    { value: 'routing',            label: t('Routing',            'توجيه') },
  ];

  const columns: Column<WarehouseTaskListItem>[] = [
    {
      header: t('Task type', 'نوع المهمة'),
      accessor: (r) => <span className="font-mono text-sm">{r.taskType}</span>,
      width: '140px',
    },
    {
      header: t('Reference', 'المرجع'),
      accessor: (r) => (
        <span className="font-mono text-xs" title={r.workflowInstance?.referenceId}>
          {r.workflowInstance?.referenceId
            ? `${r.workflowInstance.referenceId.slice(0, 8)}…`
            : '—'}
        </span>
      ),
      width: '130px',
    },
    { header: t('Status', 'الحالة'), accessor: (r) => <StatusBadge status={r.status} />, width: '140px' },
    {
      header: t('Assigned worker', 'العامل المكلف'),
      accessor: (r) => taskAssignedWorkerLabel(r.assignments),
      width: '180px',
    },
  ];

  return (
    <div>
      <FilterPanel
        title={t('Task filters', 'فلاتر المهام')}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        loading={query.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
        <div className="flex flex-wrap gap-5">
          <SelectField
            label={t('Task type', 'نوع المهمة')}
            name="taskTypeFilter"
            value={draftFilters.taskType}
            onChange={(e) => setDraft({ taskType: e.target.value })}
            options={taskTypeOptions}
          />
          <TextField
            label={t('Search', 'بحث')}
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t(
              'Search by order id, task id, or worker id',
              'ابحث بمعرف الطلب أو معرف المهمة أو معرف العامل',
            )}
          />
        </div>
      </FilterPanel>
      <DataTable
        title={t('Warehouse tasks', 'مهام المستودع')}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        onRowClick={(r) =>
          navigate(
            r.workflowInstance?.companyId
              ? `/tasks/${r.id}?companyId=${encodeURIComponent(r.workflowInstance.companyId)}`
              : `/tasks/${r.id}`,
          )
        }
      />
      {query.isError && (
        <Alert
          variant="error"
          title={t('Failed to load tasks', 'فشل تحميل المهام')}
          description={t(
            'There was a problem retrieving warehouse tasks. Check your connection and try again.',
            'حدثت مشكلة في جلب مهام المستودع. تحقق من اتصالك وأعد المحاولة.',
          )}
          className="mt-3"
        >
          <Alert.Action onClick={() => query.refetch()}>{t('Retry', 'إعادة المحاولة')}</Alert.Action>
        </Alert>
      )}
    </div>
  );
}
