import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { WorkflowsApi, type WorkflowTimelineTask } from '../api/workflows';
import { QK } from '../constants/query-keys';
import { StatusBadge } from './StatusBadge';

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

export function WorkflowOrderTimeline({
  referenceType,
  referenceId,
  enabled,
}: {
  referenceType: 'inbound_order' | 'outbound_order';
  referenceId: string;
  enabled: boolean;
}) {
  const q = useQuery({
    queryKey: QK.workflows.workflowTimelineByRef(referenceId),
    queryFn: () => WorkflowsApi.getTimeline(referenceType, referenceId),
    enabled: enabled && !!referenceId,
  });

  if (!enabled || !referenceId) return null;
  if (q.isLoading)
    return <p className="mt-4 text-xs text-slate-500">Loading workflow timeline…</p>;
  if (q.isError || !q.data)
    return <p className="mt-4 text-xs text-rose-600">Could not load workflow timeline.</p>;

  const wf = q.data.workflowInstance;
  const tasks = q.data.tasks ?? [];
  if (!wf && tasks.length === 0)
    return (
      <p className="mt-4 text-xs text-slate-500">
        No active workflow linked to this order yet (timeline appears after confirmation when tasks are
        created).
      </p>
    );

  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">Workflow timeline</div>
      {wf ? (
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-800">
          <span className="font-mono text-xs text-slate-600">{wf.id.slice(0, 8)}…</span>
          <StatusBadge status={wf.status} />
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {tasks.map((t: WorkflowTimelineTask) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
          >
            <span className="font-medium text-slate-800">{t.taskType.replace(/_/g, ' ')}</span>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={t.status} />
              {t.is_current_runnable ? (
                <Link
                  to={`/tasks/${t.id}`}
                  className="text-xs font-medium text-primary-700 hover:underline"
                >
                  Open task →
                </Link>
              ) : (
                <span
                  className="cursor-help text-xs text-slate-400 underline decoration-dotted"
                  title={blockedTitle(t.runnability_blocked_reason ?? null)}
                >
                  blocked
                </span>
              )}
              {t.assignments?.[0]?.worker?.displayName ? (
                <span className="text-xs text-slate-500">
                  {t.assignments[0].worker.displayName}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {tasks.length === 0 && wf ? <p className="mt-2 text-xs text-slate-500">No tasks recorded.</p> : null}
    </section>
  );
}
