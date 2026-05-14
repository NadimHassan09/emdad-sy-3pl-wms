import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { InboundApi, type InboundOrderLine } from '../api/inbound';
import { LocationsApi } from '../api/locations';
import type { OutboundOrder } from '../api/outbound';
import { OutboundApi } from '../api/outbound';
import { TaskMutationEnvelope, TasksApi, type ResolveTaskResolution } from '../api/tasks';
import type { ProductLot } from '../api/products';
import { ProductsApi } from '../api/products';
import { WorkersApi } from '../api/workers';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';
import { useExecutionExitBlocker } from '../hooks/useExecutionExitBlocker';
import type { Location } from '../api/locations';
import { isPutawayDestinationLocationType, locationTypeLabel } from '../lib/location-types';
import { taskUiMeta } from '../workflow/task-ui-matrix';
import { useWorkflowUx } from '../workflow/WorkflowUxContext';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function readOperatorNotes(raw: unknown): string {
  if (!isRecord(raw)) return '';
  const n = raw.operator_notes;
  return typeof n === 'string' ? n : '';
}

/** Mirrors backend `ReservationSnapshot` JSON on `execution_state.reservations`. */
interface PickReservationRow {
  outboundOrderLineId: string;
  locationId: string;
  lotId: string | null;
  quantity: string;
  productId: string;
}

function parsePickReservationsFromExecutionState(raw: unknown): PickReservationRow[] {
  if (!isRecord(raw)) return [];
  const res = raw.reservations;
  if (!Array.isArray(res)) return [];
  const out: PickReservationRow[] = [];
  for (const row of res) {
    if (!isRecord(row)) continue;
    const outboundOrderLineId =
      typeof row.outboundOrderLineId === 'string'
        ? row.outboundOrderLineId
        : typeof row.outbound_order_line_id === 'string'
          ? row.outbound_order_line_id
          : null;
    const locationId =
      typeof row.locationId === 'string'
        ? row.locationId
        : typeof row.location_id === 'string'
          ? row.location_id
          : null;
    const quantity =
      typeof row.quantity === 'string'
        ? row.quantity
        : typeof row.quantity === 'number'
          ? String(row.quantity)
          : null;
    const productId =
      typeof row.productId === 'string'
        ? row.productId
        : typeof row.product_id === 'string'
          ? row.product_id
          : null;
    let lotId: string | null = null;
    if (row.lotId !== undefined && row.lotId !== null && row.lotId !== '') {
      lotId = String(row.lotId);
    } else if (row.lot_id !== undefined && row.lot_id !== null && row.lot_id !== '') {
      lotId = String(row.lot_id);
    }
    if (!outboundOrderLineId || !locationId || !quantity || !productId) continue;
    out.push({ outboundOrderLineId, locationId, lotId, quantity, productId });
  }
  return out;
}

function buildPickCompletePayload(rows: PickReservationRow[]): {
  task_type: 'pick';
  picks: Array<{
    outbound_order_line_id: string;
    lines: Array<{ location_id: string; lot_id?: string | null; quantity: string }>;
  }>;
} {
  const groups = new Map<string, PickReservationRow[]>();
  for (const r of rows) {
    const g = groups.get(r.outboundOrderLineId) ?? [];
    g.push(r);
    groups.set(r.outboundOrderLineId, g);
  }
  return {
    task_type: 'pick',
    picks: [...groups.entries()].map(([outbound_order_line_id, slice]) => ({
      outbound_order_line_id,
      lines: slice.map((row) => ({
        location_id: row.locationId,
        lot_id: row.lotId,
        quantity: row.quantity,
      })),
    })),
  };
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
  if (id) {
    const task = env.task as Record<string, unknown> | null | undefined;
    const merged =
      Array.isArray(env.assignments) && task && typeof task === 'object'
        ? { ...task, assignments: env.assignments }
        : env.task;
    qc.setQueryData(QK.tasks.detail(id), merged);
  }
  if (env.workflowInstance?.id) {
    qc.setQueryData(QK.workflows.instance(env.workflowInstance.id as string), env.workflowInstance);
  }
  const wi = env.workflowInstance as { referenceType?: string; referenceId?: string } | null | undefined;
  invalidateWorkflowTasksInventory(qc, {
    referenceId: wi?.referenceId ?? undefined,
    referenceType:
      wi?.referenceType === 'inbound_order' || wi?.referenceType === 'outbound_order'
        ? wi.referenceType
        : undefined,
  });
  qc.invalidateQueries({ queryKey: QK.workflows.all });
  if (warehouseId) {
    qc.invalidateQueries({
      queryKey: QK.tasks.list({ warehouseId, limit: '500', offset: '0' }),
    });
  }
  if (id) qc.invalidateQueries({ queryKey: QK.tasks.detail(id) });
}

const MOCK_WORKER_ID = (import.meta.env.VITE_MOCK_WORKER_ID as string | undefined)?.trim();

export function TaskExecutionView() {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const companyIdOverride = searchParams.get('companyId')?.trim() || undefined;
  const toast = useToast();
  const qc = useQueryClient();
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
    enabled: !!warehouseId && ['putaway', 'putaway_quarantine', 'pick'].includes(taskType),
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

  const locationById = useMemo(() => {
    const m = new Map<string, { fullPath: string; barcode: string; type: string }>();
    for (const loc of locations.data ?? []) {
      m.set(loc.id, { fullPath: loc.fullPath, barcode: loc.barcode, type: loc.type });
    }
    return m;
  }, [locations.data]);

  const packingLocationsOnly = useMemo(
    () => (locations.data ?? []).filter((l) => l.type === 'packing'),
    [locations.data],
  );

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

  const uiMeta = taskUiMeta(taskType);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-16">
      <PageHeader
        title={isCompleted ? `View · ${uiMeta.label}` : `Execute · ${uiMeta.label}`}
        description={`Task ${id.slice(0, 8)}… · ${uiMeta.stage} lane`}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 -mt-2">
        <StatusBadge status={sts} />
        {!isCompleted && (
          <>
            {runnable ? (
              <span className="text-xs font-semibold text-emerald-700">Runnable</span>
            ) : (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Not runnable</span>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">{orderLink}</div>

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

      {sts === 'in_progress' && runnable && executionAllowed ? (
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
            Start / reserve pick
          </Button>
          <p className="w-full text-xs text-slate-500">
            {workers.isLoading
              ? 'Loading worker directory…'
              : workers.isError
                ? 'Fix worker directory fetch errors above.'
                : `${workerOptions.length} worker(s)${warehouseId ? ` · warehouse scoped` : ''}`}
          </p>
        </div>
      ) : null}

      {sts !== 'in_progress' && !isCompleted ? (
        <p className="text-xs text-slate-500">Execution forms unlock after Start (pick reserves inventory on start).</p>
      ) : null}

      {sts === 'in_progress' && runnable && executionAllowed ? (
        <ExecuteFormSwitcher
          taskId={id}
          taskType={taskType}
          payload={t.payload}
          warehouseId={warehouseId}
          inboundOrderId={wf?.referenceType === 'inbound_order' ? referenceId : undefined}
          taskOperatorNotes={operatorNotes}
          putawayDestLocs={putawayDestLocs}
          quarantinePutawayDestLocs={quarantinePutawayDestLocs}
          outbound={outbound.data}
          pickReservations={pickReservations}
          locationById={locationById}
          packingLocationsOnly={packingLocationsOnly}
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
          taskOperatorNotes={operatorNotes}
          putawayDestLocs={putawayDestLocs}
          quarantinePutawayDestLocs={quarantinePutawayDestLocs}
          outbound={outbound.data}
          pickReservations={pickReservations}
          locationById={locationById}
          packingLocationsOnly={packingLocationsOnly}
          submit={() => {}}
          busy={false}
          readOnly
        />
      ) : null}

      {taskType === 'pack' && showAssignBar && sts !== 'completed' ? (
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

function PickExecuteForm({
  reservations,
  outbound,
  locationById,
  warehouseId,
  taskOperatorNotes,
  packingLocations,
  submit,
  busy,
  readOnly = false,
}: {
  reservations: PickReservationRow[];
  outbound: OutboundOrder | undefined;
  locationById: Map<string, { fullPath: string; barcode: string; type: string }>;
  warehouseId: string;
  taskOperatorNotes: string;
  packingLocations: Location[];
  submit: (body: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const payload = useMemo(() => buildPickCompletePayload(reservations), [reservations]);

  const lineMeta = useMemo(() => {
    const m = new Map<string, OutboundOrder['lines'][0]>();
    for (const ol of outbound?.lines ?? []) {
      m.set(ol.id, ol);
    }
    return m;
  }, [outbound?.lines]);

  const [packingDestinationId, setPackingDestinationId] = useState('');
  const [packingBarcodeDraft, setPackingBarcodeDraft] = useState('');
  const [packingScanOpen, setPackingScanOpen] = useState(false);

  const productIdsForLots = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const r of reservations) {
      const ol = lineMeta.get(r.outboundOrderLineId);
      if (ol?.productId && !seen.has(ol.productId)) {
        seen.add(ol.productId);
        ids.push(ol.productId);
      }
    }
    return ids;
  }, [reservations, lineMeta]);

  const lotsQueries = useQueries({
    queries: productIdsForLots.map((productId) => ({
      queryKey: ['products', productId, 'lots', 'pick-task'] as const,
      queryFn: () => ProductsApi.listLots(productId),
      enabled: productIdsForLots.length > 0,
    })),
  });

  const lotsFingerprint = lotsQueries.map((q) => `${q.fetchStatus}:${q.dataUpdatedAt}`).join('|');

  const lotNumberById = useMemo(() => {
    const m = new Map<string, string>();
    productIdsForLots.forEach((_, i) => {
      for (const lot of lotsQueries[i]?.data ?? []) {
        m.set(lot.id, lot.lotNumber);
      }
    });
    return m;
  }, [lotsFingerprint, productIdsForLots]);

  const applyPackingBarcode = (raw: string) => {
    const code = raw.trim().toLowerCase();
    if (!code) {
      toast.error('Enter or scan a packing location barcode.');
      return;
    }
    const hit = packingLocations.find((l) => (l.barcode ?? '').trim().toLowerCase() === code);
    if (!hit) {
      toast.error('No packing location matches this barcode.');
      return;
    }
    setPackingDestinationId(hit.id);
    setPackingBarcodeDraft('');
    toast.success(`Staging / packing: ${hit.fullPath}`);
  };

  const packingDestLabel = () => {
    const loc = packingLocations.find((l) => l.id === packingDestinationId);
    return loc ? `${loc.fullPath} (${locationTypeLabel(loc.type)})` : '—';
  };

  const printPickSheet = () => {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rows = reservations
      .map((r, i) => {
        const ol = lineMeta.get(r.outboundOrderLineId);
        const loc = locationById.get(r.locationId);
        const lotNum = r.lotId ? lotNumberById.get(r.lotId) ?? r.lotId.slice(0, 8) + '…' : '—';
        return `<tr>
        <td class="mono">${i + 1}</td>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.barcode ?? '—')}</td>
        <td class="mono">${esc(lotNum)}</td>
        <td>${esc(loc ? `${loc.fullPath} (${loc.barcode})` : r.locationId.slice(0, 8) + '…')}</td>
        <td class="mono">${esc(r.quantity)}</td>
      </tr>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pick list</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .meta { font-size: 12px; color: #444; margin-bottom: 12px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #999; padding: 5px; text-align: left; }
  th { background: #f1f5f9; }
  .mono { font-family: ui-monospace, monospace; }
</style></head><body>
  <h1>Pick worksheet</h1>
  <div class="meta"><strong>Warehouse</strong> ${esc(warehouseId || '—')}</div>
  <div class="meta"><strong>Operator notes</strong><br/>${esc(taskOperatorNotes.trim() || '—')}</div>
  <div class="meta"><strong>Destination (packing)</strong><br/>${esc(packingDestLabel())}</div>
  <table>
    <thead><tr>
      <th>#</th><th>Product name</th><th>SKU</th><th>Barcode</th><th>Lot</th><th>Location</th><th>Qty</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Allow pop-ups to print');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  if (readOnly) {
    if (!reservations.length) {
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          No pick reservation snapshot is available for this task.
        </div>
      );
    }
    return (
      <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <div className="text-sm font-medium text-slate-800">Pick task</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Product name</th>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">Barcode</th>
                <th className="py-2 pr-2">Lot</th>
                <th className="py-2 pr-2">Location</th>
                <th className="py-2">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r, i) => {
                const ol = lineMeta.get(r.outboundOrderLineId);
                const loc = locationById.get(r.locationId);
                const locLabel = loc ? `${loc.fullPath}` : `${r.locationId.slice(0, 8)}…`;
                const barcodeHint = loc?.barcode ? ` · ${loc.barcode}` : '';
                const lotNum = r.lotId
                  ? lotNumberById.get(r.lotId) ?? `${r.lotId.slice(0, 8)}…`
                  : '—';
                return (
                  <tr
                    key={`ro-${r.outboundOrderLineId}-${r.locationId}-${r.lotId ?? 'nl'}-${i}`}
                    className="border-b border-slate-100"
                  >
                    <td className="py-2 pr-2 font-mono text-xs text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{lotNum}</td>
                    <td className="py-2 pr-2 text-xs text-slate-700">
                      {locLabel}
                      {barcodeHint ? <span className="text-slate-400">{barcodeHint}</span> : null}
                    </td>
                    <td className="py-2 font-mono">{r.quantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!reservations.length) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        No pick reservations yet. Start the task to allocate inventory (system applies FEFO/FIFO by expiry and lot age).
      </div>
    );
  }

  const packingComboOptions = packingLocations.map((loc) => ({
    value: loc.id,
    label: loc.fullPath,
    hint: `${locationTypeLabel(loc.type)} · ${loc.barcode}`,
  }));

  return (
    <form
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(payload, e);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-800">Pick allocations (FEFO / FIFO)</div>
          <p className="text-xs text-slate-500">
            Pick from reserved bins in order. Set a <strong>packing</strong> staging destination for paperwork (not sent
            to the server on complete).
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={printPickSheet}>
          Print pick list
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Destination (packing only)</div>
        <p className="mt-1 text-xs text-slate-500">Where picked units are consolidated — packing location type only.</p>
        {packingLocations.length === 0 ? (
          <p className="mt-2 text-xs text-amber-800">No packing locations in this warehouse. Create one under Locations.</p>
        ) : (
          <div className="mt-2 space-y-2">
            <Combobox
              value={packingDestinationId}
              onChange={setPackingDestinationId}
              options={packingComboOptions}
              placeholder="Select packing location…"
              emptyMessage="No packing locations"
            />
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="text"
                className="min-w-[160px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Packing location barcode"
                value={packingBarcodeDraft}
                onChange={(e) => setPackingBarcodeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPackingBarcode(packingBarcodeDraft);
                  }
                }}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => applyPackingBarcode(packingBarcodeDraft)}>
                Apply barcode
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setPackingScanOpen(true)}>
                Scan barcode
              </Button>
            </div>
          </div>
        )}
      </div>

      <BarcodeScanModal
        open={packingScanOpen}
        onClose={() => setPackingScanOpen(false)}
        onScan={(text) => {
          applyPackingBarcode(text);
          setPackingScanOpen(false);
        }}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Product name</th>
              <th className="py-2 pr-2">SKU</th>
              <th className="py-2 pr-2">Barcode</th>
              <th className="py-2 pr-2">Lot</th>
              <th className="py-2 pr-2">Location</th>
              <th className="py-2">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r, i) => {
              const ol = lineMeta.get(r.outboundOrderLineId);
              const loc = locationById.get(r.locationId);
              const locLabel = loc ? `${loc.fullPath}` : `${r.locationId.slice(0, 8)}…`;
              const barcodeHint = loc?.barcode ? ` · ${loc.barcode}` : '';
              const lotNum = r.lotId ? lotNumberById.get(r.lotId) ?? `${r.lotId.slice(0, 8)}…` : '—';
              return (
                <tr
                  key={`${r.outboundOrderLineId}-${r.locationId}-${r.lotId ?? 'nl'}-${i}`}
                  className="border-b border-slate-100"
                >
                  <td className="py-2 pr-2 font-mono text-xs text-slate-500">{i + 1}</td>
                  <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{lotNum}</td>
                  <td className="py-2 pr-2 text-xs text-slate-700">
                    {locLabel}
                    {barcodeHint ? <span className="text-slate-400">{barcodeHint}</span> : null}
                  </td>
                  <td className="py-2 font-mono">{r.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="submit" loading={busy}>
        Complete pick
      </Button>
    </form>
  );
}

function ExecuteFormSwitcher(props: {
  taskId: string;
  taskType: string;
  payload: unknown;
  warehouseId: string;
  inboundOrderId?: string;
  /** Current operator notes (same field as task execution header) for receive print sheet. */
  taskOperatorNotes?: string;
  putawayDestLocs: Location[];
  quarantinePutawayDestLocs: Location[];
  outbound: OutboundOrder | undefined;
  pickReservations: PickReservationRow[];
  locationById: Map<string, { fullPath: string; barcode: string; type: string }>;
  packingLocationsOnly: Location[];
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
    taskOperatorNotes,
    putawayDestLocs,
    quarantinePutawayDestLocs,
    outbound,
    pickReservations,
    locationById,
    packingLocationsOnly,
    submit,
    busy,
    readOnly = false,
  } = props;

  if (taskType === 'receiving' && isRecord(payload) && Array.isArray(payload.lines)) {
    return (
      <ReceivingExecuteForm
        key={`${taskId}-recv`}
        lines={payload.lines as ReceivingLineRow[]}
        inboundOrderId={inboundOrderId}
        warehouseId={warehouseId}
        taskOperatorNotes={taskOperatorNotes ?? ''}
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
      <PutawayExecuteForm
        taskType={taskType as 'putaway' | 'putaway_quarantine'}
        lines={payload.lines as PutawayLineRow[]}
        inboundOrderId={inboundOid}
        warehouseId={warehouseId}
        taskOperatorNotes={taskOperatorNotes ?? ''}
        destinationLocations={taskType === 'putaway_quarantine' ? quarantinePutawayDestLocs : putawayDestLocs}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (taskType === 'pick') {
    return (
      <PickExecuteForm
        reservations={pickReservations}
        outbound={outbound}
        locationById={locationById}
        warehouseId={warehouseId}
        taskOperatorNotes={taskOperatorNotes ?? ''}
        packingLocations={packingLocationsOnly}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (taskType === 'pack' && isRecord(payload) && Array.isArray(payload.outbound_order_line_ids)) {
    return (
      <PackExecuteForm
        lineIds={payload.outbound_order_line_ids as string[]}
        outbound={outbound}
        taskOperatorNotes={taskOperatorNotes ?? ''}
        submit={submit}
        busy={busy}
        readOnly={readOnly}
      />
    );
  }

  if (taskType === 'dispatch' && isRecord(payload) && typeof payload.outbound_order_id === 'string') {
    return (
      <DispatchExecuteForm outbound={outbound} submit={submit} busy={busy} readOnly={readOnly} />
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

interface ReceivingLineRow {
  inbound_order_line_id: string;
  expected_qty: string;
  staging_location_id: string;
}

/** Inbound expected lot (set at order create for lot-tracked SKUs). */
function receivingExpectedLotDisplay(ol: InboundOrderLine | undefined): string {
  if (!ol || ol.product?.trackingType !== 'lot') return '—';
  return ol.expectedLotNumber?.trim() || '—';
}

function ReceivingExecuteForm({
  lines,
  inboundOrderId,
  warehouseId,
  taskOperatorNotes,
  submit,
  busy,
  readOnly = false,
}: {
  lines: ReceivingLineRow[];
  inboundOrderId?: string;
  warehouseId: string;
  taskOperatorNotes: string;
  submit: (b: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, ''])),
  );
  const [expiryByLine, setExpiryByLine] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, ''])),
  );
  const [notesByLine, setNotesByLine] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, ''])),
  );

  const locationsForDock = useQuery({
    queryKey: [...QK.locationsFlatAll(false), warehouseId, 'recv-dock'],
    queryFn: () => LocationsApi.list(warehouseId, false),
    enabled: !!warehouseId && lines.length > 0,
  });

  const dockPath = useMemo(() => {
    const sid = lines[0]?.staging_location_id?.trim();
    if (!sid) return '—';
    const loc = (locationsForDock.data ?? []).find((x) => x.id === sid);
    return loc ? `${loc.fullPath}${loc.barcode ? ` (${loc.barcode})` : ''}` : sid.slice(0, 8) + '…';
  }, [lines, locationsForDock.data]);

  const inbound = useQuery({
    queryKey: [...QK.inboundOrders, inboundOrderId ?? ''],
    queryFn: () => InboundApi.get(inboundOrderId!),
    enabled: !!inboundOrderId,
  });

  const lineMap = useMemo(() => {
    const m = new Map<string, InboundOrderLine>();
    if (!inbound.data) return m;
    for (const ol of inbound.data.lines) m.set(ol.id, ol);
    return m;
  }, [inbound.data]);

  if (readOnly) {
    return (
      <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-800">Receive task</div>
        <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receiving dock</span>
          <div className="mt-1">{locationsForDock.isLoading ? 'Loading location…' : dockPath}</div>
        </div>
        {!inboundOrderId ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Missing inbound order reference — cannot show received quantities.
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">Product name</th>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">Barcode</th>
                <th className="py-2 pr-2">Lot number</th>
                <th className="py-2 pr-2">Expected qty</th>
                <th className="py-2 pr-2">Received qty</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const lid = l.inbound_order_line_id;
                const ol = lineMap.get(lid);
                return (
                  <tr key={lid} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-slate-800">{ol?.product?.sku ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-slate-700">{ol?.product?.barcode ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-slate-800">{receivingExpectedLotDisplay(ol)}</td>
                    <td className="py-2 pr-2 font-mono text-slate-600">{l.expected_qty}</td>
                    <td className="py-2 pr-2 font-mono text-slate-800">{ol?.receivedQuantity ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const printReceiveSheet = () => {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const blankRows = [0, 1, 2, 3]
      .map(
        () => `<tr class="blank">
      <td colspan="5"></td>
      <td class="write"></td>
      <td class="write"></td>
      <td class="write"></td>
    </tr>`,
      )
      .join('');
    const bodyRows = lines
      .map((l) => {
        const lid = l.inbound_order_line_id;
        const ol = lineMap.get(lid);
        const lotLabel = receivingExpectedLotDisplay(ol);
        const name = esc(ol?.product?.name ?? '—');
        const sku = esc(ol?.product?.sku ?? '—');
        const bc = esc(ol?.product?.barcode ?? '—');
        return `<tr>
        <td>${name}</td>
        <td class="mono">${sku}</td>
        <td class="mono">${bc}</td>
        <td class="mono">${esc(lotLabel)}</td>
        <td class="mono">${esc(l.expected_qty)}</td>
        <td class="mono write">${esc((qty[lid] ?? '').trim() || '')}</td>
        <td class="write">${esc(expiryByLine[lid] ?? '')}</td>
        <td>${esc(notesByLine[lid] ?? '')}</td>
      </tr>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receive sheet</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .meta { font-size: 12px; color: #444; margin-bottom: 16px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 6px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  .mono { font-family: ui-monospace, monospace; }
  td.write { min-height: 36px; height: 36px; }
  tr.blank td { height: 28px; }
</style></head><body>
  <h1>Receiving worksheet</h1>
  <div class="meta"><strong>Receiving dock</strong><br/>${esc(dockPath)}</div>
  <div class="meta"><strong>Operator notes</strong><br/>${esc(taskOperatorNotes.trim() || '—')}</div>
  <table>
    <thead><tr>
      <th>Product name</th><th>SKU</th><th>Barcode</th><th>Lot number</th>
      <th>Expected qty</th><th>Received qty</th><th>Expiry date</th><th>Notes</th>
    </tr></thead>
    <tbody>${bodyRows}${blankRows}</tbody>
  </table>
  <p style="font-size:10px;color:#64748b;margin-top:12px">Blank rows: write counts / dates by hand if needed.</p>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Allow pop-ups to print');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  return (
    <form
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();

        for (const pl of lines) {
          const lid = pl.inbound_order_line_id;
          const ol = lineMap.get(lid);
          if (!ol || ol.product?.trackingType !== 'lot') continue;
          if (!ol.expectedLotNumber?.trim()) {
            toast.error(
              `Missing expected lot on inbound line for ${ol.product?.sku ?? 'lot-tracked product'} — fix the order.`,
            );
            return;
          }
        }

        submit({
          task_type: 'receiving',
          lines: lines.map((l) => {
            const lid = l.inbound_order_line_id;
            const ol = lineMap.get(lid);
            const lotPayload =
              ol?.product?.trackingType === 'lot' && ol.expectedLotNumber?.trim()
                ? { capture_lot_number: ol.expectedLotNumber.trim() }
                : {};
            const exp = expiryByLine[lid]?.trim();
            const note = notesByLine[lid]?.trim();
            const disc = [note, exp ? `expiry:${exp}` : ''].filter(Boolean).join(' · ');
            return {
              inbound_order_line_id: lid,
              received_qty: (qty[lid] ?? '0').trim() || '0',
              ...lotPayload,
              ...(disc ? { discrepancy_notes: disc } : {}),
            };
          }),
        });
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-800">Receive task</div>
          <p className="text-xs text-slate-500">
            Record received quantities at the receiving dock; putaway moves stock into storage bins.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={printReceiveSheet}>
          Print worksheet
        </Button>
      </div>

      <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receiving dock</span>
        <div className="mt-1">{locationsForDock.isLoading ? 'Loading location…' : dockPath}</div>
      </div>

      {!inboundOrderId ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Missing inbound order reference — expected lot cannot be shown. Open this task from its inbound workflow.
        </p>
      ) : null}
      {inboundOrderId && inbound.isError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          Could not load inbound order — expected lot cannot be shown.
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">Product name</th>
              <th className="py-2 pr-2">SKU</th>
              <th className="py-2 pr-2">Barcode</th>
              <th className="py-2 pr-2">Lot number</th>
              <th className="py-2 pr-2">Expected qty</th>
              <th className="py-2 pr-2">Received qty</th>
              <th className="py-2 pr-2">Expiry date</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const lid = l.inbound_order_line_id;
              const ol = lineMap.get(lid);

              return (
                <tr key={lid} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-slate-800">{ol?.product?.sku ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-slate-700">{ol?.product?.barcode ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-slate-800">{receivingExpectedLotDisplay(ol)}</td>
                  <td className="py-2 pr-2 font-mono text-slate-600">{l.expected_qty}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                      value={qty[lid] ?? ''}
                      onChange={(e) => setQty((prev) => ({ ...prev, [lid]: e.target.value }))}
                      aria-label={`Received qty for ${lid}`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    {ol?.product?.expiryTracking ? (
                      <input
                        type="date"
                        className="w-32 rounded border border-slate-300 px-1 py-1 text-xs"
                        value={expiryByLine[lid] ?? ''}
                        onChange={(e) =>
                          setExpiryByLine((p) => ({ ...p, [lid]: e.target.value }))
                        }
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      className="w-full min-w-[100px] rounded border border-slate-300 px-2 py-1 text-xs"
                      value={notesByLine[lid] ?? ''}
                      onChange={(e) =>
                        setNotesByLine((p) => ({ ...p, [lid]: e.target.value }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        If received quantity is below expected, submit anyway — the inbound order will show as completed with short
        quantities once the workflow finishes.
      </p>

      <Button type="submit" loading={busy}>
        Submit receive
      </Button>
    </form>
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

  if (readOnly) {
    return (
      <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4 text-sm">
        <div className="font-medium text-slate-800">QC task</div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2">Line</th>
              <th className="py-2">Eligible</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.inbound_order_line_id} className="border-b border-slate-100">
                <td className="py-2 font-mono text-xs">{l.inbound_order_line_id.slice(0, 8)}…</td>
                <td className="py-2 font-mono">{l.eligible_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
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
      <div className="text-sm font-medium text-slate-800">QC — PASS or FAIL per line</div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-500">
            <th className="py-2">Line</th>
            <th className="py-2">Eligible</th>
            <th className="py-2">Result</th>
            <th className="py-2">Passed</th>
            <th className="py-2">Failed</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.inbound_order_line_id} className="border-b border-slate-100">
              <td className="py-2 font-mono text-xs">{l.inbound_order_line_id.slice(0, 8)}…</td>
              <td className="py-2 font-mono">{l.eligible_qty}</td>
              <td className="py-2">
                <label className="mr-3 inline-flex items-center gap-1 text-xs">
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
              </td>
              <td className="py-2">
                <input
                  className="w-24 rounded border px-2 py-1 font-mono text-xs"
                  value={passed[l.inbound_order_line_id] ?? ''}
                  onChange={(e) =>
                    setPassed((p) => ({ ...p, [l.inbound_order_line_id]: e.target.value }))
                  }
                />
              </td>
              <td className="py-2">
                <input
                  className="w-24 rounded border px-2 py-1 font-mono text-xs"
                  value={failed[l.inbound_order_line_id] ?? ''}
                  onChange={(e) =>
                    setFailed((p) => ({ ...p, [l.inbound_order_line_id]: e.target.value }))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="submit" loading={busy}>
        Submit QC
      </Button>
    </form>
  );
}

interface PutawayLineRow {
  inbound_order_line_id: string;
  quantity: string;
  lot_id?: string | null;
  product_id?: string;
  source_staging_location_id?: string;
}

function putawayLotLabel(
  lotId: string | null | undefined,
  ol: InboundOrderLine | undefined,
  lots: ProductLot[],
): string {
  if (!ol || ol.product?.trackingType !== 'lot') return '—';
  if (lotId) {
    const hit = lots.find((x) => x.id === lotId);
    return hit?.lotNumber ?? `${lotId.slice(0, 8)}…`;
  }
  return ol.expectedLotNumber?.trim() || '—';
}

function putawayExpiryLabel(
  lotId: string | null | undefined,
  ol: InboundOrderLine | undefined,
  lots: ProductLot[],
): string {
  if (lotId) {
    const hit = lots.find((x) => x.id === lotId);
    if (hit?.expiryDate) return String(hit.expiryDate).slice(0, 10);
  }
  if (ol?.expectedExpiryDate) return String(ol.expectedExpiryDate).slice(0, 10);
  return '—';
}

function PutawayExecuteForm({
  taskType,
  lines,
  inboundOrderId,
  warehouseId,
  taskOperatorNotes,
  destinationLocations,
  submit,
  busy,
  readOnly = false,
}: {
  taskType: 'putaway' | 'putaway_quarantine';
  lines: PutawayLineRow[];
  inboundOrderId?: string;
  warehouseId: string;
  taskOperatorNotes: string;
  destinationLocations: Location[];
  submit: (b: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const toast = useToast();
  type Alloc = {
    rowKey: string;
    inbound_order_line_id: string;
    putaway_quantity: string;
    destination_location_id: string;
    lot_id?: string | null;
  };

  const linesFingerprint = useMemo(
    () => lines.map((l) => `${l.inbound_order_line_id}\u001f${l.quantity}\u001f${l.lot_id ?? ''}`).join('\u001e'),
    [lines],
  );

  const [allocRows, setAllocRows] = useState<Alloc[]>([]);
  const [barcodeDraftByRow, setBarcodeDraftByRow] = useState<Record<string, string>>({});
  const [scanRowKey, setScanRowKey] = useState<string | null>(null);

  useEffect(() => {
    setAllocRows(
      lines.map((l, i) => ({
        rowKey: `${l.inbound_order_line_id}-${i}`,
        inbound_order_line_id: l.inbound_order_line_id,
        putaway_quantity: l.quantity,
        destination_location_id: '',
        lot_id: l.lot_id ?? null,
      })),
    );
    setBarcodeDraftByRow({});
  }, [linesFingerprint]);

  const inbound = useQuery({
    queryKey: [...QK.inboundOrders, inboundOrderId ?? ''],
    queryFn: () => InboundApi.get(inboundOrderId!),
    enabled: !!inboundOrderId,
  });

  const lineById = useMemo(() => {
    const m = new Map<string, InboundOrderLine>();
    for (const ol of inbound.data?.lines ?? []) m.set(ol.id, ol);
    return m;
  }, [inbound.data?.lines]);

  const productIdsForLots = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const pl of lines) {
      const ol = lineById.get(pl.inbound_order_line_id);
      if (ol?.product?.trackingType === 'lot' && ol.productId && !seen.has(ol.productId)) {
        seen.add(ol.productId);
        ids.push(ol.productId);
      }
    }
    return ids;
  }, [lines, lineById]);

  const lotsQueries = useQueries({
    queries: productIdsForLots.map((productId) => ({
      queryKey: ['products', productId, 'lots'] as const,
      queryFn: () => ProductsApi.listLots(productId),
      enabled: !!inboundOrderId && productIdsForLots.length > 0,
    })),
  });

  const lotsFingerprint = lotsQueries.map((q) => `${q.fetchStatus}:${q.dataUpdatedAt}`).join('|');

  const lotsByProductId = useMemo(() => {
    const map = new Map<string, ProductLot[]>();
    productIdsForLots.forEach((pid, i) => {
      map.set(pid, lotsQueries[i]?.data ?? []);
    });
    return map;
  }, [lotsFingerprint, productIdsForLots]);

  if (readOnly) {
    return (
      <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-800">
          {taskType === 'putaway_quarantine' ? 'Quarantine putaway' : 'Putaway'}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">Product name</th>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">Barcode</th>
                <th className="py-2 pr-2">Lot number</th>
                <th className="py-2 pr-2">Expiry date</th>
                <th className="py-2 pr-2">Qty (task line)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((pl, idx) => {
                const ol = lineById.get(pl.inbound_order_line_id);
                const lots = ol ? lotsByProductId.get(ol.productId) ?? [] : [];
                const lotLabel = putawayLotLabel(pl.lot_id, ol, lots);
                const expLabel = putawayExpiryLabel(pl.lot_id, ol, lots);
                return (
                  <tr key={`${pl.inbound_order_line_id}-${idx}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{lotLabel}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{expLabel}</td>
                    <td className="py-2 pr-2 font-mono text-slate-800">{pl.quantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const targetQty = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, Number(l.quantity)])),
    [lines],
  );

  const setRow = (rowKey: string, patch: Partial<Alloc>) => {
    setAllocRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  };

  const splitAfterRow = (rowKey: string) => {
    setAllocRows((prev) => {
      const idx = prev.findIndex((r) => r.rowKey === rowKey);
      if (idx < 0) return prev;
      const row = prev[idx]!;
      const copy = [...prev];
      copy.splice(idx + 1, 0, {
        rowKey: `${row.inbound_order_line_id}-split-${Date.now()}`,
        inbound_order_line_id: row.inbound_order_line_id,
        putaway_quantity: '',
        destination_location_id: '',
        lot_id: row.lot_id ?? null,
      });
      return copy;
    });
  };

  const applyBarcodeToRow = (rowKey: string, raw: string) => {
    const code = raw.trim().toLowerCase();
    if (!code) {
      toast.error('Enter or scan a location barcode.');
      return;
    }
    const hit = destinationLocations.find((l) => (l.barcode ?? '').trim().toLowerCase() === code);
    if (!hit) {
      toast.error('No matching destination location for this barcode in the current list.');
      return;
    }
    setRow(rowKey, { destination_location_id: hit.id });
    setBarcodeDraftByRow((p) => ({ ...p, [rowKey]: '' }));
    toast.success(`Destination set to ${hit.fullPath}`);
  };

  const printPutawaySheet = () => {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const blankRows = [0, 1, 2, 3, 4]
      .map(
        () => `<tr class="blank">
      <td colspan="6"></td>
      <td class="write"></td>
      <td class="write"></td>
    </tr>`,
      )
      .join('');
    const bodyRows = allocRows
      .map((r) => {
        const ol = lineById.get(r.inbound_order_line_id);
        const lots = ol ? lotsByProductId.get(ol.productId) ?? [] : [];
        const lotLabel = putawayLotLabel(r.lot_id, ol, lots);
        const expLabel = putawayExpiryLabel(r.lot_id, ol, lots);
        const dest = destinationLocations.find((l) => l.id === r.destination_location_id);
        const destLabel = dest
          ? `${esc(dest.fullPath)} (${locationTypeLabel(dest.type)})`
          : esc(r.destination_location_id ? `${r.destination_location_id.slice(0, 8)}…` : '');
        return `<tr>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.barcode ?? '—')}</td>
        <td class="mono">${esc(lotLabel)}</td>
        <td class="mono">${esc(expLabel)}</td>
        <td>${destLabel || '—'}</td>
        <td class="mono write">${esc((r.putaway_quantity ?? '').trim())}</td>
        <td class="write mono"></td>
      </tr>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Putaway worksheet</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .meta { font-size: 12px; color: #444; margin-bottom: 12px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #999; padding: 5px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  .mono { font-family: ui-monospace, monospace; }
  td.write { min-height: 40px; height: 40px; }
  tr.blank td { height: 32px; }
</style></head><body>
  <h1>Putaway worksheet</h1>
  <div class="meta"><strong>Task</strong> ${taskType === 'putaway_quarantine' ? 'Quarantine putaway' : 'Putaway'} · warehouse ${esc(warehouseId || '—')}</div>
  <div class="meta"><strong>Operator notes</strong><br/>${esc(taskOperatorNotes.trim() || '—')}</div>
  <p style="font-size:11px;margin:8px 0">Destination types: storage (internal), fridge, quarantine, scrap. Blank rows: write destination / split quantities by hand.</p>
  <table>
    <thead><tr>
      <th>Product name</th><th>SKU</th><th>Barcode</th><th>Lot number</th><th>Expiry date</th>
      <th>Destination</th><th>Quantity</th><th>Split / notes</th>
    </tr></thead>
    <tbody>${bodyRows}${blankRows}</tbody>
  </table>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Allow pop-ups to print');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const comboboxOptions = destinationLocations.map((loc) => ({
    value: loc.id,
    label: loc.fullPath,
    hint: `${locationTypeLabel(loc.type)} · ${loc.barcode}`,
  }));

  return (
    <form
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const sums: Record<string, number> = {};
        const submitRows = allocRows.filter((r) => Number((r.putaway_quantity ?? '0').trim() || '0') > 0);
        for (const r of submitRows) {
          const q = Number((r.putaway_quantity ?? '0').trim() || '0');
          sums[r.inbound_order_line_id] = (sums[r.inbound_order_line_id] ?? 0) + q;
        }
        for (const l of lines) {
          if (Math.abs((sums[l.inbound_order_line_id] ?? 0) - targetQty[l.inbound_order_line_id]) > 1e-6) {
            toast.error(
              `Qty for line ${l.inbound_order_line_id.slice(0, 8)}… must sum to ${targetQty[l.inbound_order_line_id]}.`,
            );
            return;
          }
        }
        for (const r of submitRows) {
          if (!r.destination_location_id.trim()) {
            toast.error('Each row with quantity needs a destination (pick list or barcode).');
            return;
          }
        }
        submit({
          task_type: taskType,
          lines: submitRows.map((r) => ({
            inbound_order_line_id: r.inbound_order_line_id,
            putaway_quantity: (r.putaway_quantity ?? '0').trim() || '0',
            destination_location_id: r.destination_location_id,
            lot_id: r.lot_id ?? null,
          })),
        });
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-800">
            {taskType === 'putaway_quarantine' ? 'Quarantine putaway' : 'Putaway'}
          </div>
          <p className="text-xs text-slate-500">
            Destinations: storage (internal), fridge, quarantine, or scrap. Set location from the list, type a barcode,
            or scan.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={printPutawaySheet}>
          Print worksheet
        </Button>
      </div>

      {destinationLocations.length === 0 ? (
        <p className="text-xs text-amber-700">No eligible locations for this warehouse — check Locations.</p>
      ) : null}
      {!inboundOrderId ? (
        <p className="text-xs text-amber-800">Missing inbound order on task — product columns may be incomplete.</p>
      ) : null}
      {inboundOrderId && inbound.isError ? (
        <p className="text-xs text-rose-700">Could not load inbound order for line details.</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">Product name</th>
              <th className="py-2 pr-2">SKU</th>
              <th className="py-2 pr-2">Barcode</th>
              <th className="py-2 pr-2">Lot number</th>
              <th className="py-2 pr-2">Expiry date</th>
              <th className="py-2 pr-2 min-w-[220px]">Destination</th>
              <th className="py-2 pr-2">Quantity</th>
              <th className="py-2">Split</th>
            </tr>
          </thead>
          <tbody>
            {allocRows.map((r) => {
              const ol = lineById.get(r.inbound_order_line_id);
              const lots = ol ? lotsByProductId.get(ol.productId) ?? [] : [];
              const lotLabel = putawayLotLabel(r.lot_id, ol, lots);
              const expLabel = putawayExpiryLabel(r.lot_id, ol, lots);
              const lineTarget = targetQty[r.inbound_order_line_id] ?? 0;
              return (
                <tr key={r.rowKey} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{lotLabel}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{expLabel}</td>
                  <td className="py-2 pr-2">
                    <div className="space-y-1">
                      <Combobox
                        value={r.destination_location_id}
                        onChange={(v) => setRow(r.rowKey, { destination_location_id: v })}
                        options={comboboxOptions}
                        placeholder="Select bin…"
                        emptyMessage="No locations"
                      />
                      <div className="flex flex-wrap items-end gap-1">
                        <input
                          type="text"
                          className="min-w-[120px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                          placeholder="Location barcode"
                          value={barcodeDraftByRow[r.rowKey] ?? ''}
                          onChange={(e) =>
                            setBarcodeDraftByRow((p) => ({ ...p, [r.rowKey]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              applyBarcodeToRow(r.rowKey, barcodeDraftByRow[r.rowKey] ?? '');
                            }
                          }}
                          aria-label="Location barcode"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => applyBarcodeToRow(r.rowKey, barcodeDraftByRow[r.rowKey] ?? '')}
                        >
                          Apply
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setScanRowKey(r.rowKey)}>
                          Scan
                        </Button>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                      value={r.putaway_quantity}
                      onChange={(e) => setRow(r.rowKey, { putaway_quantity: e.target.value })}
                      aria-label="Putaway quantity"
                    />
                    <div className="mt-0.5 text-[10px] text-slate-400">Line target {lineTarget}</div>
                  </td>
                  <td className="py-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => splitAfterRow(r.rowKey)}>
                      Split quantity
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BarcodeScanModal
        open={scanRowKey != null}
        onClose={() => setScanRowKey(null)}
        onScan={(text) => {
          if (scanRowKey) applyBarcodeToRow(scanRowKey, text);
          setScanRowKey(null);
        }}
      />

      <Button type="submit" loading={busy}>
        Complete putaway
      </Button>
    </form>
  );
}

function PackExecuteForm({
  lineIds,
  outbound,
  taskOperatorNotes,
  submit,
  busy,
  readOnly = false,
}: {
  lineIds: string[];
  outbound: OutboundOrder | undefined;
  taskOperatorNotes: string;
  submit: (b: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [packed, setPacked] = useState<Record<string, string>>({});
  const [packageLabel, setPackageLabel] = useState<Record<string, string>>({});

  const destAddress = outbound?.destinationAddress?.trim() || '—';

  if (readOnly) {
    return (
      <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-800">Pack task</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">Product name</th>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">Barcode</th>
                <th className="py-2 pr-2">Picked qty</th>
                <th className="py-2">Line status</th>
              </tr>
            </thead>
            <tbody>
              {lineIds.map((lid) => {
                const ol = outbound?.lines?.find((x) => x.id === lid);
                return (
                  <tr key={lid} className="border-b border-slate-100">
                    <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                    <td className="py-2 pr-2 font-mono text-slate-800">{ol?.pickedQuantity ?? '—'}</td>
                    <td className="py-2 text-xs text-slate-600">{ol?.status ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const printPackSheet = () => {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rows = lineIds
      .map((lid) => {
        const ol = outbound?.lines?.find((x) => x.id === lid);
        return `<tr>
        <td>${esc(ol?.product?.name ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.sku ?? '—')}</td>
        <td class="mono">${esc(ol?.product?.barcode ?? '—')}</td>
        <td class="mono">${esc((packed[lid] ?? '').trim())}</td>
        <td class="mono">${esc((packageLabel[lid] ?? '').trim())}</td>
      </tr>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pack list</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .meta { font-size: 12px; color: #444; margin-bottom: 12px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 6px; text-align: left; }
  th { background: #f1f5f9; }
  .mono { font-family: ui-monospace, monospace; }
</style></head><body>
  <h1>Pack worksheet</h1>
  <div class="meta"><strong>Operator notes</strong><br/>${esc(taskOperatorNotes.trim() || '—')}</div>
  <div class="meta"><strong>Destination</strong><br/>${esc(destAddress)}</div>
  <table>
    <thead><tr>
      <th>Product name</th><th>SKU</th><th>Barcode</th><th>Qty packed</th><th>Package ID</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Allow pop-ups to print');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  return (
    <form
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          task_type: 'pack',
          lines: lineIds.map((lid) => ({
            outbound_order_line_id: lid,
            packed_qty: (packed[lid] ?? '0').trim() || '0',
            ...(packageLabel[lid]?.trim() ? { package_label: packageLabel[lid].trim() } : {}),
          })),
        });
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm font-medium text-slate-800">Pack lines</div>
        <Button type="button" variant="secondary" onClick={printPackSheet}>
          Print pack list
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">Product name</th>
              <th className="py-2 pr-2">SKU</th>
              <th className="py-2 pr-2">Barcode</th>
              <th className="py-2 pr-2">Qty packed</th>
              <th className="py-2">Package ID</th>
            </tr>
          </thead>
          <tbody>
            {lineIds.map((lid) => {
              const ol = outbound?.lines?.find((x) => x.id === lid);
              return (
                <tr key={lid} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-xs font-medium text-slate-800">{ol?.product?.name ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                  <td className="py-2 pr-2">
                    <input
                      className="w-28 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                      inputMode="decimal"
                      value={packed[lid] ?? ''}
                      onChange={(e) => setPacked((p) => ({ ...p, [lid]: e.target.value }))}
                      aria-label={`Packed qty ${ol?.product?.sku ?? lid}`}
                    />
                    <div className="mt-0.5 text-[10px] text-slate-400">Max picked {ol?.pickedQuantity ?? '—'}</div>
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                      placeholder="Package ID"
                      value={packageLabel[lid] ?? ''}
                      onChange={(e) => setPackageLabel((p) => ({ ...p, [lid]: e.target.value }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button type="submit" loading={busy}>
        Complete pack
      </Button>
    </form>
  );
}

function DispatchExecuteForm({
  outbound,
  submit,
  busy,
  readOnly = false,
}: {
  outbound: OutboundOrder | undefined;
  submit: (b: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
}) {
  const [ship, setShip] = useState<Record<string, string>>({});
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');

  const lineIds = outbound?.lines?.map((l) => l.id) ?? [];

  if (readOnly) {
    return (
      <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-800">Dispatch task</div>
        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Carrier</span>
            <div className="font-mono text-sm">{outbound?.carrier?.trim() || '—'}</div>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking</span>
            <div className="font-mono text-sm">{outbound?.trackingNumber?.trim() || '—'}</div>
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipped at</span>
            <div className="text-sm">{outbound?.shippedAt ? new Date(outbound.shippedAt).toLocaleString() : '—'}</div>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2">Line</th>
              <th className="py-2">Picked</th>
              <th className="py-2">Ship qty (reference)</th>
            </tr>
          </thead>
          <tbody>
            {lineIds.map((lid) => {
              const ol = outbound?.lines?.find((x) => x.id === lid);
              return (
                <tr key={lid} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs">{lid.slice(0, 8)}…</td>
                  <td className="py-2 font-mono">{ol?.pickedQuantity ?? '—'}</td>
                  <td className="py-2 font-mono text-slate-600">{ol?.pickedQuantity ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          task_type: 'dispatch',
          lines: lineIds.map((lid) => ({
            outbound_order_line_id: lid,
            ship_qty: (ship[lid] ?? '0').trim() || '0',
          })),
          ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
          ...(tracking.trim() ? { tracking: tracking.trim() } : {}),
        });
      }}
    >
      <div className="text-sm font-medium text-slate-800">Dispatch / ship</div>
      <p className="text-xs text-amber-800">
        Final outbound step — completing dispatch deducts on-hand inventory and clears reservations via the
        server handler.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Carrier (optional)" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
        <TextField label="Tracking (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-500">
            <th className="py-2">Line</th>
            <th className="py-2">Picked</th>
            <th className="py-2">Ship qty</th>
          </tr>
        </thead>
        <tbody>
          {lineIds.map((lid) => {
            const ol = outbound?.lines?.find((x) => x.id === lid);
            return (
              <tr key={lid} className="border-b border-slate-100">
                <td className="py-2 font-mono text-xs">{lid.slice(0, 8)}…</td>
                <td className="py-2 font-mono">{ol?.pickedQuantity ?? '—'}</td>
                <td className="py-2">
                  <input
                    className="w-28 rounded border px-2 py-1 font-mono text-xs"
                    value={ship[lid] ?? ''}
                    onChange={(e) => setShip((p) => ({ ...p, [lid]: e.target.value }))}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button type="submit" loading={busy}>
        Complete dispatch
      </Button>
    </form>
  );
}
