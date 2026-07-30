import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@ds';

import { WorkflowsApi } from '../../api/workflows';
import { QK } from '../../constants/query-keys';
import { useWmsTranslation } from '../../lib/ui-i18n';
import {
  findNextRunnableTask,
  prettyWorkflowTaskType,
  taskDetailHref,
  type WorkflowReferenceType,
} from '../../lib/workflow-next-task';

/**
 * Sticky primary CTA to open the next floor task for an order (Confirm handoff / return visits).
 */
export function OrderNextTaskHandoff({
  referenceType,
  referenceId,
  companyIdOverride,
  enabled,
}: {
  referenceType: WorkflowReferenceType;
  referenceId: string;
  companyIdOverride?: string;
  enabled: boolean;
}) {
  const { t } = useWmsTranslation();
  const navigate = useNavigate();

  const timeline = useQuery({
    queryKey: QK.workflows.workflowTimelineByRef(referenceId),
    queryFn: () => WorkflowsApi.getTimeline(referenceType, referenceId, companyIdOverride),
    enabled: enabled && !!referenceId,
  });

  const next = findNextRunnableTask(timeline.data?.tasks ?? [], referenceType);
  if (!next) return null;

  const label = prettyWorkflowTaskType(next.taskType, t);
  const href = taskDetailHref(next.id, companyIdOverride);

  return (
    <Alert
      variant="info"
      title={t(['Open next warehouse task', 'افتح مهمة المستودع التالية'])}
      description={t([
        `Continue on the floor: ${label}.`,
        `تابع على أرضية المستودع: ${label}.`,
      ])}
      className="mb-4"
      action={
        <Button type="button" variant="primary" size="md" onClick={() => navigate(href)}>
          {t([`Open ${label}`, `افتح ${label}`])}
        </Button>
      }
    />
  );
}
