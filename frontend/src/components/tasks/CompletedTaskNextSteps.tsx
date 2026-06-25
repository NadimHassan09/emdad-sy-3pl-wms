import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { WorkflowsApi, type WorkflowTimelineTask } from '../../api/workflows';
import { QK } from '../../constants/query-keys';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';

function taskSequence(referenceType: 'inbound_order' | 'outbound_order') {
  return referenceType === 'inbound_order'
    ? ['receiving', 'qc', 'putaway', 'putaway_quarantine', 'routing', 'dispatch']
    : ['pick', 'pack', 'dispatch', 'routing'];
}

function prettyTaskType(taskType: string, t: (m: [string, string]) => string): string {
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
      return t(['Delivery', 'تسليم']);
    case 'routing':
      return t(['Routing', 'توجيه']);
    default:
      return taskType.replace(/_/g, ' ');
  }
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const BTN_LG = '!px-4 !py-2 !text-sm';

/**
 * Navigation helper rendered after a task is completed so the operator/admin can jump
 * straight to the next step *of the same order's workflow* without bouncing back to the
 * order page. When the workflow's final step is done, no "Next task" button is shown.
 */
export function CompletedTaskNextSteps({
  referenceType,
  referenceId,
  currentTaskId,
  companyIdOverride,
}: {
  referenceType: 'inbound_order' | 'outbound_order';
  referenceId: string;
  currentTaskId: string;
  companyIdOverride?: string;
}) {
  const { t } = useWmsTranslation();
  const navigate = useNavigate();

  const timeline = useQuery({
    queryKey: QK.workflows.workflowTimelineByRef(referenceId),
    queryFn: () => WorkflowsApi.getTimeline(referenceType, referenceId, companyIdOverride),
    enabled: !!referenceId,
  });

  const tasks = timeline.data?.tasks ?? [];
  const seq = taskSequence(referenceType);
  const ordered = [...tasks].sort((a, b) => {
    const ai = seq.indexOf(a.taskType);
    const bi = seq.indexOf(b.taskType);
    const ax = ai >= 0 ? ai : Number.MAX_SAFE_INTEGER;
    const bx = bi >= 0 ? bi : Number.MAX_SAFE_INTEGER;
    return ax - bx;
  });

  // Next step belongs to THIS order only: the step that follows the current task in
  // workflow order, regardless of its status. When the current task is the last step in
  // the workflow there is no next task (button hidden).
  const currentIdx = ordered.findIndex((x) => x.id === currentTaskId);
  const nextTask: WorkflowTimelineTask | undefined =
    currentIdx >= 0 ? ordered[currentIdx + 1] : undefined;

  const taskHref = (taskId: string) =>
    companyIdOverride
      ? `/tasks/${taskId}?companyId=${encodeURIComponent(companyIdOverride)}`
      : `/tasks/${taskId}`;

  const orderHref =
    referenceType === 'inbound_order'
      ? `/orders/inbound/${referenceId}`
      : `/orders/outbound/${referenceId}`;

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m4.5 10.5 3.2 3.2L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {t(['Task completed — what’s next?', 'اكتملت المهمة — ما التالي؟'])}
      </div>

      <p className="mt-1 text-xs text-emerald-800/90">
        {nextTask
          ? t([
              'Continue to the next step of this same order.',
              'تابع إلى الخطوة التالية لنفس هذا الطلب.',
            ])
          : t([
              'This was the final step — the order workflow is complete.',
              'كانت هذه الخطوة الأخيرة — اكتمل سير عمل الطلب.',
            ])}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {nextTask ? (
          <Button type="button" className={BTN_LG} onClick={() => navigate(taskHref(nextTask.id))}>
            {t([
              `Next task: ${prettyTaskType(nextTask.taskType, t)}`,
              `المهمة التالية: ${prettyTaskType(nextTask.taskType, t)}`,
            ])}
            <ArrowRightIcon />
          </Button>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className={BTN_LG}
          onClick={() => navigate(orderHref)}
        >
          {t(['Back to order', 'العودة إلى الطلب'])}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={BTN_LG}
          onClick={() => navigate('/tasks')}
        >
          {t(['All tasks', 'كل المهام'])}
        </Button>
      </div>
    </section>
  );
}
