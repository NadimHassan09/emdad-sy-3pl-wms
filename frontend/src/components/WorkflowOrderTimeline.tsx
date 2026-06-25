import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { WorkflowsApi, type WorkflowTimelineTask } from '../api/workflows';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from './FilterPanel';
import { QK } from '../constants/query-keys';
import { taskAssignedWorkerLabel } from '../lib/task-worker-label';

/** Parse an ISO timestamp to ms, or null when missing/invalid. */
function toMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Timer starts when the task is assigned (fallback: started), stops at completion. */
function taskStartMs(task: WorkflowTimelineTask): number | null {
  return toMs(task.assignments?.[0]?.assignedAt) ?? toMs(task.startedAt);
}

function isTimerCompletedStatus(status: string): boolean {
  return ['completed', 'done', 'shipped', 'approved', 'closed', 'cancelled'].includes(status);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

function TaskTimer({ task, now }: { task: WorkflowTimelineTask; now: number }) {
  const start = taskStartMs(task);
  if (start == null) return null;
  const completed = isTimerCompletedStatus(task.status);
  const end = completed ? toMs(task.completedAt) : null;
  const elapsed = (completed && end != null ? end : now) - start;
  if (elapsed < 0) return null;

  return (
    <div
      className={`mt-2 inline-flex self-center items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] tabular-nums ${
        completed
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-amber-100 text-amber-800'
      }`}
      title={completed ? 'Total task duration' : 'Time since assignment (live)'}
    >
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10" cy="10" r="7.2" />
        <path d="M10 6.4v4l2.6 1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {formatDuration(elapsed)}
    </div>
  );
}

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

  const [now, setNow] = useState(() => Date.now());
  // Tick once per second only while at least one task is still running (assigned but not done).
  const hasRunningTimer = (q.data?.tasks ?? []).some(
    (t) => taskStartMs(t) != null && !isTimerCompletedStatus(t.status),
  );
  useEffect(() => {
    if (!hasRunningTimer) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasRunningTimer]);

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
    <section className={PANEL_CARD_CLASS}>
      <h2 className={PANEL_TITLE_CLASS}>Workflow timeline</h2>
      <div className="mt-4 flex justify-center overflow-x-auto pb-1">
        <ol className="flex w-max items-stretch gap-0">
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
              <li key={t.id} className="flex items-stretch">
                <div className="flex w-[18rem] flex-col pr-4">
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
                  <div className={`flex flex-1 flex-col rounded-lg border p-3 text-center text-xs ${toneCard}`}>
                    <div className="text-slate-600">
                      Assigned:{' '}
                      <span className="font-medium text-slate-800">
                        {assigneeLabel === '—' ? 'Unassigned' : assigneeLabel}
                      </span>
                    </div>
                    <TaskTimer task={t} now={now} />
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
