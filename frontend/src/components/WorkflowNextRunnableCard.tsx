import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { WorkflowsApi } from '../api/workflows';
import { QK } from '../constants/query-keys';
import { Button } from './Button';

export function WorkflowNextRunnableCard({
  referenceType,
  referenceId,
  enabled,
  isDraftOrder,
}: {
  referenceType: 'inbound_order' | 'outbound_order';
  referenceId: string;
  enabled: boolean;
  /** Draft orders have no workflow yet — skip references fetch and show confirm hint only */
  isDraftOrder: boolean;
}) {
  const navigate = useNavigate();
  const fetchTimeline = enabled && !!referenceId && !isDraftOrder;
  const q = useQuery({
    queryKey: QK.workflows.workflowTimelineByRef(referenceId),
    queryFn: () => WorkflowsApi.getTimeline(referenceType, referenceId),
    enabled: fetchTimeline,
  });

  if (!referenceId) return null;

  if (isDraftOrder) {
    return (
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-slate-500">Next step</div>
        <p className="mt-2 text-sm text-slate-600">Confirm order to start workflow</p>
      </section>
    );
  }

  if (!enabled) return null;

  if (q.isLoading)
    return (
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Loading workflow…</p>
      </section>
    );
  if (q.isError || !q.data)
    return (
      <section className="mt-4 rounded-md border border-rose-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-rose-600">Could not load workflow.</p>
      </section>
    );

  const steps = q.data.steps ?? [];
  /** Only the current runnable step is pending with a task id; locked / future steps are ignored */
  const step = steps?.find((s) => s.status === 'pending' && s.taskId != null);

  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">Next step</div>
      {step ? (
        <div className="mt-3">
          <Button type="button" onClick={() => navigate(`/tasks/${step.taskId!}`)}>
            Go to {step.label}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Confirm order to start workflow</p>
      )}
    </section>
  );
}
