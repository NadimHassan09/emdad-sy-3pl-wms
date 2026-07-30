import type { WorkflowTimelineTask } from '../api/workflows';

export type WorkflowReferenceType = 'inbound_order' | 'outbound_order';

export function workflowTaskSequence(referenceType: WorkflowReferenceType): string[] {
  return referenceType === 'inbound_order'
    ? ['receiving', 'qc', 'putaway', 'putaway_quarantine', 'routing', 'dispatch']
    : ['pick', 'pack', 'dispatch', 'routing'];
}

export function sortWorkflowTimelineTasks(
  tasks: WorkflowTimelineTask[],
  referenceType: WorkflowReferenceType,
): WorkflowTimelineTask[] {
  const seq = workflowTaskSequence(referenceType);
  return [...tasks].sort((a, b) => {
    const ai = seq.indexOf(a.taskType);
    const bi = seq.indexOf(b.taskType);
    const ax = ai >= 0 ? ai : Number.MAX_SAFE_INTEGER;
    const bx = bi >= 0 ? bi : Number.MAX_SAFE_INTEGER;
    return ax - bx;
  });
}

const ACTIVE_STATUSES = new Set(['pending', 'assigned', 'in_progress', 'blocked', 'retry_pending']);

/**
 * First runnable / startable task for an order workflow (Confirm handoff + list UX).
 * Prefers `is_current_runnable`; falls back to first non-completed step in sequence order.
 */
export function findNextRunnableTask(
  tasks: WorkflowTimelineTask[],
  referenceType: WorkflowReferenceType,
): WorkflowTimelineTask | undefined {
  const ordered = sortWorkflowTimelineTasks(tasks, referenceType);
  const runnable = ordered.find((t) => t.is_current_runnable === true);
  if (runnable) return runnable;
  return ordered.find((t) => ACTIVE_STATUSES.has(String(t.status).toLowerCase()));
}

/** Step after `currentTaskId` on the same order (post-complete chaining). */
export function findNextTaskAfterCurrent(
  tasks: WorkflowTimelineTask[],
  referenceType: WorkflowReferenceType,
  currentTaskId: string,
): WorkflowTimelineTask | undefined {
  const ordered = sortWorkflowTimelineTasks(tasks, referenceType);
  const currentIdx = ordered.findIndex((x) => x.id === currentTaskId);
  return currentIdx >= 0 ? ordered[currentIdx + 1] : undefined;
}

export function prettyWorkflowTaskType(
  taskType: string,
  t: (m: [string, string]) => string,
): string {
  switch (taskType) {
    case 'receiving':
      return t(['Receiving', 'استلام']);
    case 'qc':
      return t(['Quality check', 'فحص الجودة']);
    case 'putaway':
      return t(['Putaway', 'تخزين']);
    case 'putaway_quarantine':
      return t(['Putaway (quarantine)', 'تخزين (حجر صحي)']);
    case 'pick':
      return t(['Pick', 'التقاط']);
    case 'pack':
      return t(['Pack', 'تغليف']);
    case 'dispatch':
      return t(['Dispatch', 'إرسال']);
    case 'routing':
      return t(['Routing', 'توجيه']);
    default:
      return taskType.replace(/_/g, ' ');
  }
}

export function taskDetailHref(taskId: string, companyIdOverride?: string): string {
  return companyIdOverride
    ? `/tasks/${taskId}?companyId=${encodeURIComponent(companyIdOverride)}`
    : `/tasks/${taskId}`;
}
