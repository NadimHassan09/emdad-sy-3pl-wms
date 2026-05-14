import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { WarehouseTaskListItem } from '../api/tasks';
import { TasksApi } from '../api/tasks';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';

export function TasksListPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [taskTypeFilter, setTaskTypeFilter] = useState(() => searchParams.get('taskType') ?? '');
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    setTaskTypeFilter(searchParams.get('taskType') ?? '');
  }, [searchParams]);

  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    f.limit = '500';
    f.offset = '0';
    const tt = taskTypeFilter.trim();
    if (tt) f.taskType = tt;
    const q = searchFilter.trim();
    if (q) {
      // Server-side assist: typically matches related order reference ids.
      f.referenceId = q;
    }
    return f;
  }, [taskTypeFilter, searchFilter]);

  const query = useQuery({
    queryKey: QK.tasks.list(filters),
    queryFn: () => TasksApi.list(filters),
  });
  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = searchFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const taskId = r.id?.toLowerCase() ?? '';
      const refId = r.workflowInstance?.referenceId?.toLowerCase() ?? '';
      const workerId = r.assignments?.[0]?.worker?.id?.toLowerCase() ?? '';
      const workerName = taskAssignedWorkerLabel(r.assignments).toLowerCase();
      return taskId.includes(q) || refId.includes(q) || workerId.includes(q) || workerName.includes(q);
    });
  }, [query.data?.items, searchFilter]);

  const taskTypeOptions = [
    { value: '', label: t('All task types', 'كل أنواع المهام') },
    { value: 'receiving', label: 'receiving' },
    { value: 'qc', label: 'qc' },
    { value: 'putaway', label: 'putaway' },
    { value: 'putaway_quarantine', label: 'putaway_quarantine' },
    { value: 'pick', label: 'pick' },
    { value: 'pack', label: 'pack' },
    { value: 'dispatch', label: 'dispatch' },
    { value: 'routing', label: 'routing' },
  ];

  const columns: Column<WarehouseTaskListItem>[] = [
    {
      header: t('task_type', 'نوع_المهمة'),
      accessor: (r) => <span className="font-mono text-sm">{r.taskType}</span>,
      width: '120px',
    },
    {
      header: t('reference_id', 'معرف_المرجع'),
      accessor: (r) => (
        <span className="font-mono text-xs" title={r.workflowInstance?.referenceId}>
          {r.workflowInstance?.referenceId
            ? `${r.workflowInstance.referenceId.slice(0, 8)}…`
            : '—'}
        </span>
      ),
      width: '120px',
    },
    { header: t('status', 'الحالة'), accessor: (r) => <StatusBadge status={r.status} />, width: '140px' },
    {
      header: t('assigned_worker', 'العامل_المعين'),
      accessor: (r) => taskAssignedWorkerLabel(r.assignments),
      width: '160px',
    },
  ];

  return (
    <div>
      <PageHeader title={t('Warehouse tasks', 'مهام المستودع')} description={t('Workflow-driven operational tasks', 'مهام تشغيلية حسب سير العمل')} />
      <FilterPanel showLabel={t('Show filters', 'إظهار الفلاتر')} hideLabel={t('Hide filters', 'إخفاء الفلاتر')}>
        <div className="flex flex-wrap gap-3">
          <SelectField
            label={t('task_type', 'نوع_المهمة')}
            name="taskTypeFilter"
            value={taskTypeFilter}
            onChange={(e) => setTaskTypeFilter(e.target.value)}
            options={taskTypeOptions}
          />
          <TextField
            label={t('Search', 'بحث')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={t(
              'Search by order id, task id, or worker id',
              'ابحث بمعرف الطلب أو معرف المهمة أو معرف العامل',
            )}
          />
        </div>
      </FilterPanel>
      <DataTable
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
      {query.isError ? (
        <p className="mt-2 text-sm text-rose-600">{(query.error as Error).message}</p>
      ) : null}
    </div>
  );
}
