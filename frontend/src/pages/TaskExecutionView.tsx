import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { LocationsApi } from '../api/locations';
import type { OutboundOrder } from '../api/outbound';
import { OutboundApi } from '../api/outbound';
import { TaskMutationEnvelope, TasksApi, type ResolveTaskResolution } from '../api/tasks';
import { WorkersApi } from '../api/workers';
import { Button } from '../components/Button';
import { Column, DataTable } from '../components/DataTable';
import { Combobox } from '../components/Combobox';
import { PageHeader } from '../components/PageHeader';
import { TaskDetailsCard } from '../components/tasks/TaskDetailsCard';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useAuth } from '../auth/AuthContext';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { applyTaskMutationEnvelope } from '../lib/task-mutation-cache';
import { isOperatorRole } from '../lib/rbac';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';
import { useExecutionExitBlocker } from '../hooks/useExecutionExitBlocker';
import type { Location } from '../api/locations';
import { isPutawayDestinationLocationType } from '../lib/location-types';
import { DispatchExecutionPanel } from './tasks/dispatch/DispatchExecutionPanel';
import { PackExecutionPanel } from './tasks/pack/PackExecutionPanel';
import { PickExecutionPanel } from './tasks/pick/PickExecutionPanel';
import { parsePickReservationsFromExecutionState } from './tasks/pick/pick-utils';
import { PutawayExecutionPanel } from './tasks/putaway/PutawayExecutionPanel';
import type { PutawayLineRow } from './tasks/putaway/putaway-types';
import { ReceivingExecutionPanel } from './tasks/receiving/ReceivingExecutionPanel';
import type { ReceivingLineRow } from './tasks/receiving/receiving-types';
import { taskTypeIconClass } from '../lib/task-type-icons';
import { taskTypeTitle } from '../workflow/task-ui-matrix';
import { useWorkflowUx } from '../workflow/WorkflowUxContext';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function readOperatorNotes(raw: unknown): string {
  if (!isRecord(raw)) return '';
  const n = raw.operator_notes;
  return typeof n === 'string' ? n : '';
}

function runnabilityBlockedHint(code: string | null): string {
  switch (code) {
    case 'NOT_ON_WORKFLOW_FRONT':
      return 'Another workflow step must finish before this task can proceed.';
    case 'WORKER_MISSING_REQUIRED_SKILLS':
      return 'Assigned worker does not satisfy required skills or certifications.';
    case 'ASSIGNMENT_REQUIRED_FOR_SKILLS':
      return 'Assign a worker before starting — skilled tasks validate the assignee.';
    default:
      return 'This step cannot run yet under workflow rules.';
  }
}

function envelopeTouch(
  qc: ReturnType<typeof useQueryClient>,
  id: string | undefined,
  env: TaskMutationEnvelope,
  warehouseId: string | undefined,
) {
  if (!id) return;
  const wi = env.workflowInstance as { referenceType?: string; referenceId?: string } | null | undefined;
  applyTaskMutationEnvelope(qc, {
    taskId: id,
    envelope: env,
    warehouseId,
    referenceId: wi?.referenceId ?? undefined,
    referenceType:
      wi?.referenceType === 'inbound_order' || wi?.referenceType === 'outbound_order'
        ? wi.referenceType
        : undefined,
  });
}

const MOCK_WORKER_ID = (import.meta.env.VITE_MOCK_WORKER_ID as string | undefined)?.trim();

export function TaskExecutionView() {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const companyIdOverride = searchParams.get('companyId')?.trim() || undefined;
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isWorkerAccount = isOperatorRole(user?.role);
  const { effective } = useWorkflowUx();
  const { warehouseId: defaultWid } = useDefaultWarehouseId();
  const [workerId, setWorkerId] = useState('');
  const [resolveReason, setResolveReason] = useState('');
  const [resolveResolution, setResolveResolution] = useState<ResolveTaskResolution>('resume');
  const [resolveForkHint, setResolveForkHint] = useState('');
  const [retryReason, setRetryReason] = useState('');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [syncedOperatorNotes, setSyncedOperatorNotes] = useState('');

  const task = useQuery({
    queryKey: id ? QK.tasks.detail(id) : [],
    queryFn: () => TasksApi.get(id!, companyIdOverride),
    enabled: !!id,
  });

  const wf = task.data?.workflowInstance as
    | { id?: string; referenceType?: string; referenceId?: string; warehouseId?: string }
    | undefined;

  const warehouseId = wf?.warehouseId || defaultWid || '';
  const taskType = (task.data?.taskType as string) ?? '';
  const referenceId = wf?.referenceId;

  const outbound = useQuery({
    queryKey: ['outbound-task', referenceId],
    queryFn: () => OutboundApi.get(referenceId!),
    enabled:
      !!referenceId &&
      wf?.referenceType === 'outbound_order' &&
      ['pick', 'pack', 'dispatch'].includes(taskType),
  });

  const locations = useQuery({
    queryKey: [...QK.locationsFlatAll(false), warehouseId],
    queryFn: () => LocationsApi.list(warehouseId, false),
    enabled:
      !!warehouseId &&
      ['putaway', 'putaway_quarantine', 'pick', 'pack', 'dispatch'].includes(taskType),
  });

  const workers = useQuery({
    queryKey: [...QK.workers.all, 'task-detail', warehouseId || 'all'],
    queryFn: () => WorkersApi.list(warehouseId || undefined),
    enabled: !!id,
  });

  const workerLoad = useQuery({
    queryKey: QK.workers.load(warehouseId || 'none'),
    queryFn: () => WorkersApi.listLoad(warehouseId || undefined),
    enabled: !!id,
  });

  const workerOptions = useMemo(() => {
    const loadById = new Map((workerLoad.data ?? []).map((w) => [w.workerId, w]));
    return (workers.data ?? []).map((w) => {
      const load = loadById.get(w.id);
      const loadHint =
        load != null
          ? `Load ${load.loadScore} · in progress ${load.inProgressCount} · assigned ${load.assignedPendingCount}`
          : null;
      const userHint = w.user?.email ? `${w.user.email}` : null;
      const hint = [userHint, loadHint].filter(Boolean).join(' · ') || undefined;
      return { value: w.id, label: w.displayName || w.user?.fullName || w.id.slice(0, 8), hint };
    });
  }, [workers.data, workerLoad.data]);

  const mutateAssign = useMutation({
    mutationFn: () => TasksApi.assign(id, workerId.trim(), companyIdOverride),
    onSuccess: (env) => {
      toast.success('Assigned');
      envelopeTouch(qc, id, env, warehouseId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutateStart = useMutation({
    mutationFn: () => TasksApi.start(id, workerId.trim() || undefined, companyIdOverride),
    onSuccess: (env) => {
      toast.success('Started');
      envelopeTouch(qc, id, env, warehouseId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutateComplete = useMutation({
    mutationFn: (body: unknown) => TasksApi.complete(id, body, companyIdOverride),
    onSuccess: (env) => {
      toast.success('Completed');
      envelopeTouch(qc, id, env, warehouseId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutateRetry = useMutation({
    mutationFn: () =>
      TasksApi.retry(
        id,
        retryReason.trim() ? { reason: retryReason.trim() } : {},
        companyIdOverride,
      ),
    onSuccess: (env) => {
      toast.success('Retry acknowledged');
      envelopeTouch(qc, id, env, warehouseId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutateResolve = useMutation({
    mutationFn: () =>
      TasksApi.resolve(
        id,
        {
          resolution: resolveResolution,
          reason: resolveReason.trim(),
          ...(resolveForkHint.trim() ? { fork_hint: resolveForkHint.trim() } : {}),
        },
        companyIdOverride,
      ),
    onSuccess: (env) => {
      toast.success('Resolve applied');
      envelopeTouch(qc, id, env, warehouseId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Sellable putaway: storage (`internal`), fridge, quarantine, scrap. */
  const putawayDestLocs = useMemo(
    () => (locations.data ?? []).filter((l) => isPutawayDestinationLocationType(l.type)),
    [locations.data],
  );
  /** Quarantine putaway task: quarantine or scrap bins only. */
  const quarantinePutawayDestLocs = useMemo(
    () => (locations.data ?? []).filter((l) => l.type === 'quarantine' || l.type === 'scrap'),
    [locations.data],
  );

  const packingLocationsOnly = useMemo(
    () => (locations.data ?? []).filter((l) => l.type === 'packing'),
    [locations.data],
  );

  const dispatchLocationsOnly = useMemo(
    () => (locations.data ?? []).filter((l) => l.type === 'output'),
    [locations.data],
  );

  const packSiblingTask = useQuery({
    queryKey: [...QK.tasks.list({ warehouseId, limit: '100' }), 'pack-sibling', wf?.id, referenceId],
    queryFn: async () => {
      const page = await TasksApi.list(
        {
          warehouseId,
          limit: '100',
          ...(referenceId ? { referenceId } : {}),
        },
        companyIdOverride,
      );
      return page.items.find(
        (t) =>
          (!wf?.id || t.workflowInstance?.id === wf.id) &&
          t.taskType === 'pack' &&
          t.status === 'completed',
      );
    },
    enabled: taskType === 'dispatch' && !!warehouseId && !!referenceId,
  });

  const packSiblingDetail = useQuery({
    queryKey: packSiblingTask.data?.id ? QK.tasks.detail(packSiblingTask.data.id) : [],
    queryFn: () => TasksApi.get(packSiblingTask.data!.id, companyIdOverride),
    enabled: !!packSiblingTask.data?.id,
  });

  const packExecutionStateForDispatch = useMemo(() => {
    const t = packSiblingDetail.data;
    if (!t || typeof t !== 'object') return undefined;
    const r = t as Record<string, unknown>;
    return r.executionState ?? r.execution_state;
  }, [packSiblingDetail.data]);

  const pickSiblingTask = useQuery({
    queryKey: [...QK.tasks.list({ warehouseId, limit: '100' }), 'pick-sibling', wf?.id, referenceId],
    queryFn: async () => {
      const page = await TasksApi.list(
        {
          warehouseId,
          limit: '100',
          ...(referenceId ? { referenceId } : {}),
        },
        companyIdOverride,
      );
      return page.items.find(
        (t) =>
          (!wf?.id || t.workflowInstance?.id === wf.id) &&
          t.taskType === 'pick' &&
          t.status === 'completed',
      );
    },
    enabled: taskType === 'dispatch' && !!warehouseId && !!referenceId,
  });

  const pickSiblingDetail = useQuery({
    queryKey: pickSiblingTask.data?.id ? QK.tasks.detail(pickSiblingTask.data.id) : [],
    queryFn: () => TasksApi.get(pickSiblingTask.data!.id, companyIdOverride),
    enabled: !!pickSiblingTask.data?.id,
  });

  const pickExecutionStateForDispatch = useMemo(() => {
    const t = pickSiblingDetail.data;
    if (!t || typeof t !== 'object') return undefined;
    const r = t as Record<string, unknown>;
    return r.executionState ?? r.execution_state;
  }, [pickSiblingDetail.data]);

  const pickReservations = useMemo(
    () => parsePickReservationsFromExecutionState(task.data?.executionState),
    [task.data?.executionState],
  );

  useEffect(() => {
    setWorkerId('');
  }, [id]);

  useEffect(() => {
    const aid = task.data?.assignments?.[0]?.worker?.id as string | undefined;
    if (aid) setWorkerId(aid);
  }, [task.data?.assignments?.[0]?.worker?.id]);

  useEffect(() => {
    if (!task.data) return;
    const n = readOperatorNotes(task.data.executionState);
    setOperatorNotes(n);
    setSyncedOperatorNotes(n);
  }, [task.data?.id]);

  const mutateSaveOperatorNotes = useMutation({
    mutationFn: () => TasksApi.patchProgress(id, { operator_notes: operatorNotes }, companyIdOverride),
    onSuccess: (env) => {
      setSyncedOperatorNotes(operatorNotes);
      envelopeTouch(qc, id, env, warehouseId || undefined);
      toast.success('Operator notes saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useExecutionExitBlocker(
    Boolean(
      !isWorkerAccount &&
      effective.confirmUnsavedDraft &&
        operatorNotes !== syncedOperatorNotes &&
        task.data?.status === 'in_progress' &&
        task.data?.is_current_runnable === true,
    ),
  );

  if (!id) return null;
  if (task.isLoading) return <p className="text-sm text-slate-500">Loading task…</p>;
  if (task.isError) {
    return (
      <p className="text-sm text-rose-600">
        {(task.error as Error).message ?? 'Could not load task.'}
      </p>
    );
  }
  if (!task.data) return null;

  const t = task.data;
  const runnable = t.is_current_runnable === true;
  const blockedCode = t.runnability_blocked_reason ?? null;
  const sts = String(t.status);
  const isCompleted = sts === 'completed';
  const canOperate = ['pending', 'assigned', 'in_progress'].includes(sts);

  const assignedWorkerId = t.assignments?.[0]?.worker?.id as string | undefined;
  /**
   * Optional dev override: VITE_MOCK_WORKER_ID impersonates that worker; if set and it
   * does not match the task assignee, block execution. Production uses the real assignment only.
   */
  const assignmentBlocked =
    !!MOCK_WORKER_ID && !!assignedWorkerId && MOCK_WORKER_ID !== assignedWorkerId;
  const assigneeGateMessage = assignmentBlocked
    ? 'This task is not assigned to the worker in VITE_MOCK_WORKER_ID — clear or update that env value.'
    : null;

  const executionAllowed = assigneeGateMessage === null;

  const orderLink =
    wf?.referenceType === 'inbound_order' && referenceId ? (
      <Link className="text-primary-700 hover:underline" to={`/orders/inbound/${referenceId}`}>
        Inbound order
      </Link>
    ) : wf?.referenceType === 'outbound_order' && referenceId ? (
      <Link className="text-primary-700 hover:underline" to={`/orders/outbound/${referenceId}`}>
        Outbound order
      </Link>
    ) : null;

  const showAssignBar = sts !== 'completed' && sts !== 'cancelled';

  const structuredPanelTypes = new Set([
    'receiving',
    'qc',
    'putaway',
    'putaway_quarantine',
    'pick',
    'pack',
    'dispatch',
  ]);
  const usesStructuredPanel = structuredPanelTypes.has(taskType);

  return (
    <div className="w-full min-w-0 space-y-4 pb-16">
      {!usesStructuredPanel ? (
        <>
          <PageHeader title={taskTypeTitle(taskType)} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusBadge status={sts} />
            {!isCompleted ? (
              runnable ? (
              <span className="text-xs font-semibold text-emerald-700">Runnable</span>
            ) : (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Not runnable</span>
              )
            ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">{orderLink}</div>
        </>
      ) : null}

      {assigneeGateMessage ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {assigneeGateMessage}
        </p>
      ) : null}

      {!runnable && canOperate ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {runnabilityBlockedHint(blockedCode)} Use the order timeline to find the active step.
        </p>
      ) : null}

      {sts === 'retry_pending' ? (
        <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm">
          <div className="font-medium text-rose-900">retry_pending — manager retry</div>
          <TextField label="Reason (optional)" value={retryReason} onChange={(e) => setRetryReason(e.target.value)} />
          <Button type="button" onClick={() => mutateRetry.mutate()} loading={mutateRetry.isPending}>
            Resume after retry
          </Button>
        </div>
      ) : null}

      {sts === 'blocked' ? (
        <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm">
          <div className="font-medium text-rose-900">blocked — manager resolve</div>
          <label className="block text-xs font-semibold text-slate-700">
            Resolution
            <select
              className="mt-1 w-full max-w-md rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={resolveResolution}
              onChange={(e) => setResolveResolution(e.target.value as ResolveTaskResolution)}
            >
              <option value="resume">resume</option>
              <option value="cancel_remaining">cancel_remaining</option>
              <option value="approve_partial">approve_partial</option>
              <option value="fork_new_task">fork_new_task</option>
            </select>
          </label>
          <TextField
            label="Resolution note (min 4 chars)"
            value={resolveReason}
            onChange={(e) => setResolveReason(e.target.value)}
          />
          {resolveResolution === 'fork_new_task' || resolveResolution === 'approve_partial' ? (
            <TextField
              label="Fork / audit hint (optional)"
              value={resolveForkHint}
              onChange={(e) => setResolveForkHint(e.target.value)}
            />
          ) : null}
          <Button
            type="button"
            onClick={() => mutateResolve.mutate()}
            loading={mutateResolve.isPending}
            disabled={resolveReason.trim().length < 4}
          >
            Apply resolution
          </Button>
        </div>
      ) : null}

      {sts === 'in_progress' && runnable && executionAllowed && !isWorkerAccount ? (
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Operator notes
            </span>
            <textarea
              className="min-h-[72px] w-full rounded border border-slate-300 p-2 text-sm"
              value={operatorNotes}
              spellCheck
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="Short free-text; use Save to persist."
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => mutateSaveOperatorNotes.mutate()}
              loading={mutateSaveOperatorNotes.isPending}
              disabled={operatorNotes === syncedOperatorNotes}
            >
              Save notes
            </Button>
            {operatorNotes !== syncedOperatorNotes ? (
              <span className="text-[10px] text-amber-700">Unsaved changes</span>
            ) : (
              <span className="text-[10px] text-slate-400">All changes saved</span>
            )}
          </div>
          {syncedOperatorNotes.trim() ? (
            <div className="rounded border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved notes</div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{syncedOperatorNotes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showAssignBar ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3">
          <div className="w-full text-sm text-slate-700">
            <span className="text-slate-500">Assigned worker:</span>{' '}
            <span className="font-medium text-slate-900">{taskAssignedWorkerLabel(t.assignments)}</span>
          </div>
          <div className="min-w-[260px] flex-[2]">
            <Combobox
              label="Assign worker"
              value={workerId}
              onChange={setWorkerId}
              options={workerOptions}
              placeholder={workers.isLoading ? 'Loading workers…' : 'Select worker…'}
              disabled={workers.isLoading || !!workers.isError}
              emptyMessage={
                workers.isError ? 'Could not load workers' : warehouseId ? 'No workers for this warehouse' : 'No workers'
              }
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => mutateAssign.mutate()}
            disabled={!workerId.trim() || mutateAssign.isPending || !!workers.isError}
          >
            Assign
          </Button>
          <Button
            type="button"
            onClick={() => mutateStart.mutate()}
            disabled={!runnable || !executionAllowed}
          >
            Start
          </Button>
          {workers.isLoading || workers.isError ? (
          <p className="w-full text-xs text-slate-500">
            {workers.isLoading
              ? 'Loading worker directory…'
                : 'Fix worker directory fetch errors above.'}
          </p>
          ) : null}
        </div>
      ) : null}

      {sts === 'in_progress' && runnable && executionAllowed ? (
        <ExecuteFormSwitcher
          taskId={id}
          taskType={taskType}
          payload={t.payload}
          warehouseId={warehouseId}
          inboundOrderId={wf?.referenceType === 'inbound_order' ? referenceId : undefined}
          outboundOrderId={wf?.referenceType === 'outbound_order' ? referenceId : undefined}
          companyIdOverride={companyIdOverride}
          taskStatus={sts}
          executionState={
            isRecord(t) ? (t.executionState ?? t.execution_state) : undefined
          }
          assignedWorkerLabel={taskAssignedWorkerLabel(t.assignments)}
          taskOperatorNotes={operatorNotes}
          showExportPdf={!isWorkerAccount}
          putawayDestLocs={putawayDestLocs}
          quarantinePutawayDestLocs={quarantinePutawayDestLocs}
          outbound={outbound.data}
          pickReservations={pickReservations}
          allLocations={locations.data ?? []}
          packingLocationsOnly={packingLocationsOnly}
          dispatchLocationsOnly={dispatchLocationsOnly}
          packExecutionState={packExecutionStateForDispatch}
          pickExecutionState={pickExecutionStateForDispatch}
          submit={(body: unknown, e?: FormEvent) => {
            e?.preventDefault();
            mutateComplete.mutate(body);
          }}
          busy={mutateComplete.isPending}
          readOnly={false}
        />
      ) : null}

      {isCompleted ? (
        <ExecuteFormSwitcher
          taskId={id}
          taskType={taskType}
          payload={t.payload}
          warehouseId={warehouseId}
          inboundOrderId={wf?.referenceType === 'inbound_order' ? referenceId : undefined}
          outboundOrderId={wf?.referenceType === 'outbound_order' ? referenceId : undefined}
          companyIdOverride={companyIdOverride}
          taskStatus={sts}
          executionState={
            isRecord(t) ? (t.executionState ?? t.execution_state) : undefined
          }
          assignedWorkerLabel={taskAssignedWorkerLabel(t.assignments)}
          taskOperatorNotes={operatorNotes}
          showExportPdf={!isWorkerAccount}
          putawayDestLocs={putawayDestLocs}
          quarantinePutawayDestLocs={quarantinePutawayDestLocs}
          outbound={outbound.data}
          pickReservations={pickReservations}
          allLocations={locations.data ?? []}
          packingLocationsOnly={packingLocationsOnly}
          dispatchLocationsOnly={dispatchLocationsOnly}
          packExecutionState={packExecutionStateForDispatch}
          pickExecutionState={pickExecutionStateForDispatch}
          submit={() => {}}
          busy={false}
          readOnly
        />
      ) : null}

      {taskType === 'qc' && showAssignBar && sts !== 'completed' ? (
        <TaskManagerSkipBlock taskType={taskType} taskId={id} />
      ) : null}

      {effective.showAdvancedJson && showAssignBar && sts !== 'completed' ? (
        <TaskJsonCompleteBlock taskType={taskType} taskId={id} />
      ) : null}

    </div>
  );
}

function TaskManagerSkipBlock({ taskType, taskId }: { taskType: string; taskId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { warehouseId: wid } = useDefaultWarehouseId();
  const [skipReason, setSkipReason] = useState('');

  const mut = useMutation({
    mutationFn: () => {
      const reason = skipReason.trim();
      if (taskType === 'qc') return TasksApi.skip(taskId, { skip_target: 'qc', reason });
      return TasksApi.skip(taskId, { skip_target: 'pack', reason });
    },
    onSuccess: (env) => {
      toast.success('Skipped step (manager)');
      envelopeTouch(qc, taskId, env, wid || undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4">
      <div className="text-sm font-medium text-amber-950">Manager skip ({taskType})</div>
      <p className="mt-1 text-xs text-amber-900/90">Requires wh_manager or super_admin.</p>
      <TextField
        label="Reason (min 4 characters)"
        value={skipReason}
        onChange={(e) => setSkipReason(e.target.value)}
        className="mt-2"
      />
      <Button
        type="button"
        className="mt-2"
        variant="secondary"
        onClick={() => mut.mutate()}
        loading={mut.isPending}
        disabled={skipReason.trim().length < 4}
      >
        Skip {taskType === 'qc' ? 'QC' : 'pack'}
      </Button>
    </div>
  );
}

function defaultCompleteJsonBody(taskType: string): string {
  const inboundLine = '00000000-0000-4000-8000-000000000011';
  const outboundLine = '00000000-0000-4000-8000-000000000022';
  const loc = '00000000-0000-4000-8000-000000000033';
  const samples: Record<string, string> = {
    receiving: JSON.stringify(
      {
        task_type: 'receiving',
        lines: [
          {
            inbound_order_line_id: inboundLine,
            received_qty: '1',
          },
        ],
      },
      null,
      2,
    ),
    qc: JSON.stringify(
      {
        task_type: 'qc',
        lines: [
          {
            inbound_order_line_id: inboundLine,
            passed_qty: '10',
            failed_qty: '0',
          },
        ],
      },
      null,
      2,
    ),
    putaway: JSON.stringify(
      {
        task_type: 'putaway',
        lines: [
          {
            inbound_order_line_id: inboundLine,
            putaway_quantity: '5',
            destination_location_id: loc,
          },
        ],
      },
      null,
      2,
    ),
    putaway_quarantine: JSON.stringify(
      {
        task_type: 'putaway_quarantine',
        lines: [
          {
            inbound_order_line_id: inboundLine,
            putaway_quantity: '1',
            destination_location_id: loc,
          },
        ],
      },
      null,
      2,
    ),
    pick: JSON.stringify({ task_type: 'pick', picks: [] }, null, 2),
    pack: JSON.stringify(
      {
        task_type: 'pack',
        lines: [{ outbound_order_line_id: outboundLine, packed_qty: '1' }],
      },
      null,
      2,
    ),
    dispatch: JSON.stringify(
      {
        task_type: 'dispatch',
        lines: [{ outbound_order_line_id: outboundLine, ship_qty: '1' }],
      },
      null,
      2,
    ),
  };
  return samples[taskType] ?? JSON.stringify({ task_type: taskType, lines: [] }, null, 2);
}

function TaskJsonCompleteBlock({ taskType, taskId }: { taskType: string; taskId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { warehouseId: wid } = useDefaultWarehouseId();
  const [jsonBody, setJsonBody] = useState(() => defaultCompleteJsonBody(taskType));
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (taskType && !seeded) {
      setJsonBody(defaultCompleteJsonBody(taskType));
      setSeeded(true);
    }
  }, [taskType, seeded]);

  const mut = useMutation({
    mutationFn: () => {
      const body = JSON.parse(jsonBody) as unknown;
      return TasksApi.complete(taskId, body);
    },
    onSuccess: (env) => {
      toast.success('Completed (JSON)');
      envelopeTouch(qc, taskId, env, wid || undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-slate-300 bg-slate-50/80 p-4">
      <div className="text-sm font-medium text-slate-800">Advanced — complete via JSON</div>
      <textarea
        className="mt-2 w-full rounded border border-slate-300 p-2 font-mono text-xs"
        rows={12}
        spellCheck={false}
        value={jsonBody}
        onChange={(e) => setJsonBody(e.target.value)}
      />
      <Button type="button" className="mt-2" onClick={() => mut.mutate()} loading={mut.isPending}>
        Complete task (JSON)
      </Button>
    </div>
  );
}


function ExecuteFormSwitcher(props: {
  taskId: string;
  taskType: string;
  payload: unknown;
  warehouseId: string;
  inboundOrderId?: string;
  outboundOrderId?: string;
  companyIdOverride?: string;
  taskStatus: string;
  executionState?: unknown;
  assignedWorkerLabel: string;
  /** Current operator notes (same field as task execution header). */
  taskOperatorNotes?: string;
  showExportPdf?: boolean;
  putawayDestLocs: Location[];
  quarantinePutawayDestLocs: Location[];
  outbound: OutboundOrder | undefined;
  pickReservations: ReturnType<typeof parsePickReservationsFromExecutionState>;
  allLocations: Location[];
  packingLocationsOnly: Location[];
  dispatchLocationsOnly: Location[];
  packExecutionState?: unknown;
  pickExecutionState?: unknown;
  submit: (body: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const {
    taskId,
    taskType,
    payload,
    warehouseId,
    inboundOrderId,
    outboundOrderId,
    companyIdOverride,
    taskStatus,
    executionState,
    assignedWorkerLabel,
    taskOperatorNotes,
    showExportPdf = true,
    putawayDestLocs,
    quarantinePutawayDestLocs,
    outbound,
    pickReservations,
    allLocations,
    packingLocationsOnly,
    dispatchLocationsOnly,
    packExecutionState,
    pickExecutionState,
    submit,
    busy,
    readOnly = false,
  } = props;

  if (taskType === 'receiving' && isRecord(payload) && Array.isArray(payload.lines)) {
    return (
      <ReceivingExecutionPanel
        key={`${taskId}-recv`}
        taskId={taskId}
        lines={payload.lines as ReceivingLineRow[]}
        inboundOrderId={inboundOrderId}
        warehouseId={warehouseId}
        companyIdOverride={companyIdOverride}
        taskOperatorNotes={taskOperatorNotes ?? ''}
        showExportPdf={showExportPdf}
        assignedWorkerLabel={assignedWorkerLabel}
        taskStatus={taskStatus}
        executionState={executionState}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (taskType === 'qc' && isRecord(payload) && Array.isArray(payload.lines)) {
    return (
      <QcExecuteForm
        lines={payload.lines as QcLineRow[]}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (
    (taskType === 'putaway' || taskType === 'putaway_quarantine') &&
    isRecord(payload) &&
    Array.isArray(payload.lines)
  ) {
    const pl = payload as { inbound_order_id?: string };
    const inboundOid = typeof pl.inbound_order_id === 'string' ? pl.inbound_order_id : undefined;
    return (
      <PutawayExecutionPanel
        key={`${taskId}-putaway`}
        taskId={taskId}
        taskType={taskType as 'putaway' | 'putaway_quarantine'}
        lines={payload.lines as PutawayLineRow[]}
        inboundOrderId={inboundOid}
        warehouseId={warehouseId}
        companyIdOverride={companyIdOverride}
        assignedWorkerLabel={assignedWorkerLabel}
        taskOperatorNotes={taskOperatorNotes}
        showExportPdf={showExportPdf}
        taskStatus={taskStatus}
        executionState={executionState}
        destinationLocations={
          taskType === 'putaway_quarantine' ? quarantinePutawayDestLocs : putawayDestLocs
        }
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (taskType === 'pick') {
    const requiresPacking = outbound?.requiresPacking !== false;
    return (
      <PickExecutionPanel
        key={`${taskId}-pick`}
        taskId={taskId}
        reservations={pickReservations}
        outbound={outbound}
        outboundOrderId={outboundOrderId}
        allLocations={allLocations}
        dropOffLocations={requiresPacking ? packingLocationsOnly : dispatchLocationsOnly}
        requiresPacking={requiresPacking}
        warehouseId={warehouseId}
        companyIdOverride={companyIdOverride}
        assignedWorkerLabel={assignedWorkerLabel}
        taskOperatorNotes={taskOperatorNotes}
        showExportPdf={showExportPdf}
        taskStatus={taskStatus}
        executionState={executionState}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (taskType === 'pack' && isRecord(payload) && Array.isArray(payload.outbound_order_line_ids)) {
    return (
      <PackExecutionPanel
        key={`${taskId}-pack`}
        taskId={taskId}
        lineIds={payload.outbound_order_line_ids as string[]}
        outbound={outbound}
        outboundOrderId={outboundOrderId}
        packingLocations={packingLocationsOnly}
        warehouseId={warehouseId}
        companyIdOverride={companyIdOverride}
        assignedWorkerLabel={assignedWorkerLabel}
        taskOperatorNotes={taskOperatorNotes}
        showExportPdf={showExportPdf}
        taskStatus={taskStatus}
        executionState={executionState}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (taskType === 'dispatch' && isRecord(payload) && typeof payload.outbound_order_id === 'string') {
    const lineIds = outbound?.lines?.map((l) => l.id) ?? [];
    const requiresPacking = outbound?.requiresPacking !== false;
    return (
      <DispatchExecutionPanel
        key={`${taskId}-dispatch`}
        taskId={taskId}
        outbound={outbound}
        outboundOrderId={outboundOrderId ?? payload.outbound_order_id}
        lineIds={lineIds}
        requiresPacking={requiresPacking}
        allLocations={allLocations}
        warehouseId={warehouseId}
        companyIdOverride={companyIdOverride}
        assignedWorkerLabel={assignedWorkerLabel}
        taskOperatorNotes={taskOperatorNotes}
        showExportPdf={showExportPdf}
        taskStatus={taskStatus}
        executionState={executionState}
        packExecutionState={packExecutionState}
        pickExecutionState={pickExecutionState}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  return (
    <p className="text-sm text-slate-600">
      {readOnly ? (
        <>
          No summary view for <span className="font-mono">{taskType}</span>.
        </>
      ) : (
        <>
          No structured form for <span className="font-mono">{taskType}</span> yet (warehouse{' '}
          <span className="font-mono">{warehouseId || '—'}</span>). Use the supervisor JSON page.
        </>
      )}
    </p>
  );
}


interface QcLineRow {
  inbound_order_line_id: string;
  eligible_qty: string;
}

function QcExecuteForm({
  lines,
  submit,
  busy,
  readOnly = false,
}: {
  lines: QcLineRow[];
  submit: (b: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [passed, setPassed] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, ''])),
  );
  const [failed, setFailed] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, ''])),
  );
  const [disposition, setDisposition] = useState<Record<string, 'PASS' | 'FAIL' | ''>>(() =>
    Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, ''])),
  );

  const applyPassFail = (lineId: string, mode: 'PASS' | 'FAIL') => {
    const elig = lines.find((x) => x.inbound_order_line_id === lineId)?.eligible_qty ?? '0';
    setDisposition((d) => ({ ...d, [lineId]: mode }));
    if (mode === 'PASS') {
      setPassed((p) => ({ ...p, [lineId]: elig }));
      setFailed((f) => ({ ...f, [lineId]: '0' }));
    } else {
      setPassed((p) => ({ ...p, [lineId]: '0' }));
      setFailed((f) => ({ ...f, [lineId]: elig }));
    }
  };

  const eligibleTotal = lines.reduce((sum, l) => sum + Number(l.eligible_qty || 0), 0);

  const qcDetailsCard = (
    <TaskDetailsCard
      taskTypeLabel={taskTypeTitle('qc')}
      iconClass={taskTypeIconClass('qc')}
      primaryTitle={`${lines.length} line${lines.length === 1 ? '' : 's'} to inspect`}
      subtitle={`${eligibleTotal} eligible units`}
      fields={[
        {
          iconClass: 'fa-solid fa-list-ol',
          label: 'Lines',
          value: String(lines.length),
        },
        {
          iconClass: 'fa-solid fa-boxes-stacked',
          label: 'Eligible quantity',
          value: String(eligibleTotal),
        },
      ]}
      summary="PASS or FAIL each line before putaway can proceed."
    />
  );

  const qcColumns: Column<QcLineRow>[] = [
    {
      header: 'Line',
      accessor: (l) => (
        <span className="font-mono text-xs">{l.inbound_order_line_id.slice(0, 8)}…</span>
      ),
      width: '120px',
    },
    {
      header: 'Eligible',
      accessor: (l) => <span className="font-mono tabular-nums">{l.eligible_qty}</span>,
      width: '100px',
    },
    ...(readOnly
      ? []
      : [
          {
            header: 'Result',
            accessor: (l: QcLineRow) => (
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name={`qc-${l.inbound_order_line_id}`}
                    checked={disposition[l.inbound_order_line_id] === 'PASS'}
                    onChange={() => applyPassFail(l.inbound_order_line_id, 'PASS')}
                  />
                  PASS
                </label>
                <label className="inline-flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name={`qc-${l.inbound_order_line_id}`}
                    checked={disposition[l.inbound_order_line_id] === 'FAIL'}
                    onChange={() => applyPassFail(l.inbound_order_line_id, 'FAIL')}
                  />
                  FAIL
                </label>
              </div>
            ),
            width: '140px',
          } satisfies Column<QcLineRow>,
          {
            header: 'Passed',
            accessor: (l: QcLineRow) => (
                <input
                className="w-24 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                  value={passed[l.inbound_order_line_id] ?? ''}
                  onChange={(e) =>
                    setPassed((p) => ({ ...p, [l.inbound_order_line_id]: e.target.value }))
                  }
                />
            ),
            width: '100px',
          } satisfies Column<QcLineRow>,
          {
            header: 'Failed',
            accessor: (l: QcLineRow) => (
                <input
                className="w-24 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                  value={failed[l.inbound_order_line_id] ?? ''}
                  onChange={(e) =>
                    setFailed((p) => ({ ...p, [l.inbound_order_line_id]: e.target.value }))
                  }
                />
            ),
            width: '100px',
          } satisfies Column<QcLineRow>,
        ]),
  ];

  if (readOnly) {
    return (
      <div className="space-y-4">
        {qcDetailsCard}
        <DataTable
          title="QC lines"
          columns={qcColumns}
          rows={lines}
          rowKey={(l) => l.inbound_order_line_id}
          empty="No QC lines."
        />
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        for (const l of lines) {
          if (!disposition[l.inbound_order_line_id]) {
            toast.error('PASS or FAIL is required for every line.');
            return;
          }
        }
        submit({
          task_type: 'qc',
          lines: lines.map((l) => ({
            inbound_order_line_id: l.inbound_order_line_id,
            passed_qty: (passed[l.inbound_order_line_id] ?? '0').trim() || '0',
            failed_qty: (failed[l.inbound_order_line_id] ?? '0').trim() || '0',
          })),
        });
      }}
    >
      {qcDetailsCard}
      <DataTable
        title="QC lines"
        columns={qcColumns}
        rows={lines}
        rowKey={(l) => l.inbound_order_line_id}
        empty="No QC lines."
      />
      <Button type="submit" loading={busy}>
        Submit QC
      </Button>
    </form>
  );
}
