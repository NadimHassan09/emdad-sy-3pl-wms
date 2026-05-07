import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { WarehouseTaskListItem } from '../api/tasks';
import { TasksApi } from '../api/tasks';
import { Column, DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';

export function TasksListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [taskTypeFilter, setTaskTypeFilter] = useState(() => searchParams.get('taskType') ?? '');
  const [referenceFilter, setReferenceFilter] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [referenceTypeClient, setReferenceTypeClient] = useState('');

  useEffect(() => {
    setTaskTypeFilter(searchParams.get('taskType') ?? '');
  }, [searchParams]);

  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    f.limit = '500';
    f.offset = '0';
    const tt = taskTypeFilter.trim();
    if (tt) f.taskType = tt;
    const refTrim = referenceFilter.trim();
    if (refTrim) f.referenceId = refTrim;
    const wTrim = workerFilter.trim();
    if (wTrim) f.workerId = wTrim;
    return f;
  }, [taskTypeFilter, referenceFilter, workerFilter]);

  const query = useQuery({
    queryKey: QK.tasks.list(filters),
    queryFn: () => TasksApi.list(filters),
  });

  const refTypeLower = referenceTypeClient.trim().toLowerCase();
  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    if (!refTypeLower) return items;
    return items.filter((t) => {
      const rt = t.workflowInstance?.referenceType?.toLowerCase() ?? '';
      if (refTypeLower === 'inbound') return rt.includes('inbound');
      if (refTypeLower === 'outbound') return rt.includes('outbound');
      return rt === refTypeLower;
    });
  }, [query.data?.items, refTypeLower]);

  const columns: Column<WarehouseTaskListItem>[] = [
    {
      header: 'task_type',
      accessor: (r) => <span className="font-mono text-sm">{r.taskType}</span>,
      width: '120px',
    },
    {
      header: 'reference_type',
      accessor: (r) => (
        <span className="text-xs text-slate-700">{r.workflowInstance?.referenceType ?? '—'}</span>
      ),
      width: '140px',
    },
    {
      header: 'reference_id',
      accessor: (r) => (
        <span className="font-mono text-xs" title={r.workflowInstance?.referenceId}>
          {r.workflowInstance?.referenceId
            ? `${r.workflowInstance.referenceId.slice(0, 8)}…`
            : '—'}
        </span>
      ),
      width: '120px',
    },
    { header: 'status', accessor: (r) => <StatusBadge status={r.status} />, width: '140px' },
    {
      header: 'assigned_worker',
      accessor: (r) => r.assignments?.[0]?.worker?.displayName ?? '—',
      width: '160px',
    },
  ];

  return (
    <div>
      <PageHeader title="Warehouse tasks" description="Workflow-driven operational tasks" />
      <div className="mb-3 flex flex-wrap gap-3">
        <TextField
          label="task_type"
          value={taskTypeFilter}
          onChange={(e) => setTaskTypeFilter(e.target.value)}
          placeholder="e.g. receiving, pick"
        />
        <TextField
          label="reference_id (API)"
          value={referenceFilter}
          onChange={(e) => setReferenceFilter(e.target.value)}
          placeholder="Order UUID"
        />
        <TextField
          label="reference_type (client filter)"
          value={referenceTypeClient}
          onChange={(e) => setReferenceTypeClient(e.target.value)}
          placeholder="inbound / outbound"
        />
        <TextField
          label="workerId"
          value={workerFilter}
          onChange={(e) => setWorkerFilter(e.target.value)}
          placeholder="Worker UUID"
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={query.isLoading}
        onRowClick={(r) => navigate(`/tasks/${r.id}`)}
      />
      {query.isError ? (
        <p className="mt-2 text-sm text-rose-600">{(query.error as Error).message}</p>
      ) : null}
    </div>
  );
}
