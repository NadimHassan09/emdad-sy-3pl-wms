import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { WorkflowsApi, type WorkflowTimelineTask } from '../api/workflows';
import { QK } from '../constants/query-keys';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';

function blockedTitle(code: string | null | undefined): string {
  switch (code?.trim()) {
    case 'NOT_ON_WORKFLOW_FRONT':
      return 'Waiting for an earlier workflow step — see order timeline.';
    case 'WORKER_MISSING_REQUIRED_SKILLS':
      return 'Assigned worker does not meet certified skills for this task.';
    case 'ASSIGNMENT_REQUIRED_FOR_SKILLS':
      return 'Assign a worker before this skilled step can run.';
    default:
      return code?.trim() ? `Blocked: ${code}` : 'Not on the current workflow frontier.';
  }
}

function prettyTaskType(taskType: string): string {
  switch (taskType) {
    case 'receiving':
      return 'Receive';
    case 'putaway':
      return 'Putaway';
    case 'putaway_quarantine':
      return 'Putaway (Quarantine)';
    case 'pick':
      return 'Pick';
    case 'pack':
      return 'Pack';
    case 'dispatch':
      return 'Delivery';
    case 'qc':
      return 'QC';
    case 'routing':
      return 'Routing';
    default:
      return taskType.replace(/_/g, ' ');
  }
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function isCompletedStatus(status: string): boolean {
  return ['completed', 'done', 'shipped', 'approved', 'closed'].includes(status);
}

function isActiveStatus(status: string): boolean {
  return ['in_progress', 'assigned', 'picking', 'packing', 'pending'].includes(status);
}

function taskSequence(referenceType: 'inbound_order' | 'outbound_order') {
  return referenceType === 'inbound_order'
    ? ['receiving', 'qc', 'putaway', 'putaway_quarantine', 'routing', 'dispatch']
    : ['pick', 'pack', 'dispatch', 'routing'];
}

function workflowState(task: WorkflowTimelineTask): 'completed' | 'active' | 'pending' {
  if (isCompletedStatus(task.status)) return 'completed';
  if (task.is_current_runnable || isActiveStatus(task.status)) return 'active';
  return 'pending';
}

function StepIcon({ state }: { state: 'completed' | 'active' | 'pending' }) {
  if (state === 'completed') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25">
        <path d="m4.5 10.5 3.2 3.2L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 'active') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="10" cy="10" r="7.2" />
        <path d="M10 6.4v4.2l2.8 1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <circle cx="10" cy="10" r="3.2" />
    </svg>
  );
}

export function WorkflowOrderTimeline({
  referenceType,
  referenceId,
  enabled,
  companyIdOverride,
}: {
  referenceType: 'inbound_order' | 'outbound_order';
  referenceId: string;
  enabled: boolean;
  companyIdOverride?: string;
}) {
  const q = useQuery({
    queryKey: QK.workflows.workflowTimelineByRef(referenceId),
    queryFn: () => WorkflowsApi.getTimeline(referenceType, referenceId, companyIdOverride),
    enabled: enabled && !!referenceId,
  });

  if (!enabled || !referenceId) return null;
  if (q.isLoading)
    return <p className="mt-4 text-xs text-slate-500">Loading workflow timeline…</p>;
  if (q.isError || !q.data)
    return <p className="mt-4 text-xs text-rose-600">Could not load workflow timeline.</p>;

  const wf = q.data.workflowInstance;
  const tasksRaw = q.data.tasks ?? [];
  if (!wf && tasksRaw.length === 0) return null;

  const seq = taskSequence(referenceType);
  const tasks = [...tasksRaw].sort((a, b) => {
    const ai = seq.indexOf(a.taskType);
    const bi = seq.indexOf(b.taskType);
    const ax = ai >= 0 ? ai : Number.MAX_SAFE_INTEGER;
    const bx = bi >= 0 ? bi : Number.MAX_SAFE_INTEGER;
    return ax - bx;
  });

  return (
    <section className="mt-4 mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow timeline</div>
        {wf ? (
          <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
            <span className="font-mono">{wf.id.slice(0, 8)}…</span>
            <span className="text-slate-400">•</span>
            <span>{prettyStatus(wf.status)}</span>
          </div>
        ) : null}
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <ol className="flex min-w-max items-start gap-0">
          {tasks.map((t, idx) => {
            const state = workflowState(t);
            const assigneeLabel = taskAssignedWorkerLabel(t.assignments);
            const done = state === 'completed';
            const active = state === 'active';
            const toneNode = done
              ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
              : active
                ? 'border-amber-300 bg-amber-100 text-amber-700'
                : 'border-slate-300 bg-slate-100 text-slate-500';
            const toneCard = done
              ? 'border-emerald-200 bg-emerald-50/70'
              : active
                ? 'border-amber-200 bg-amber-50/80 ring-1 ring-amber-100'
                : 'border-slate-200 bg-slate-50/80';
            const connectorDone = idx < tasks.length - 1 && done;
            return (
              <li key={t.id} className="flex items-start">
                <div className="w-[18rem] pr-4">
                  <div className="mb-2 flex items-center justify-center gap-2 text-center">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${toneNode}`}
                      title={state}
                    >
                      <StepIcon state={state} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{prettyTaskType(t.taskType)}</div>
                      <div className="truncate text-[11px] uppercase tracking-wide text-slate-500">{prettyStatus(t.status)}</div>
                    </div>
                  </div>
                  <div className={`rounded-lg border p-3 text-center text-xs ${toneCard}`}>
                    <div className="text-slate-600">
                      Assigned:{' '}
                      <span className="font-medium text-slate-800">
                        {assigneeLabel === '—' ? 'Unassigned' : assigneeLabel}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <Link
                        to={
                          companyIdOverride
                            ? `/tasks/${t.id}?companyId=${encodeURIComponent(companyIdOverride)}`
                            : `/tasks/${t.id}`
                        }
                        className="font-medium text-primary-700 hover:underline"
                      >
                        Open task
                      </Link>
                      {!t.is_current_runnable && state === 'pending' ? (
                        <span className="cursor-help text-slate-500 underline decoration-dotted" title={blockedTitle(t.runnability_blocked_reason ?? null)}>
                          blocked
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {idx < tasks.length - 1 ? (
                  <div className="mt-4 mr-4 h-0.5 w-16 shrink-0">
                    <div className={`h-full rounded ${connectorDone ? 'bg-emerald-300' : 'bg-slate-300'}`} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      {tasks.length === 0 && wf ? (
        <p className="mt-2 text-xs text-slate-500">No tasks recorded.</p>
      ) : null}
    </section>
  );
}
