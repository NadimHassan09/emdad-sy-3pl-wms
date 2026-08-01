import { useQuery } from '@tanstack/react-query';

import type { InboundOrder } from '../../api/inbound';
import type { OutboundOrder } from '../../api/outbound';
import { TasksApi } from '../../api/tasks';
import { WorkflowsApi, type WorkflowTimelineTask } from '../../api/workflows';
import { Button } from '@ds';
import { OrderDocumentsCard } from '../documents/OrderDocumentsCard';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { findTimelineTask, isRecord } from '../../lib/order-workspace-tasks';
import { esc, openTaskPrintHtml, TASK_PRINT_PAGE_STYLES } from '../../lib/task-print-html';
import { formatTaskDateTime } from '../../lib/task-details-helpers';

type InboundProps = {
  mode: 'inbound';
  order: InboundOrder;
  companyId?: string;
};

type OutboundProps = {
  mode: 'outbound';
  order: OutboundOrder;
  companyId?: string;
  requiresPacking: boolean;
};

type Props = InboundProps | OutboundProps;

function useIsArabic(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl')
  );
}

function label(en: string, ar: string, isArabic: boolean) {
  return isArabic ? ar : en;
}

export function OrderWorkspaceDocumentsSection(props: Props) {
  const toast = useToast();
  const isArabic = useIsArabic();
  const referenceType = props.mode === 'inbound' ? 'inbound_order' : 'outbound_order';
  const orderId = props.order.id;

  const timeline = useQuery({
    queryKey: QK.workflows.timeline(referenceType, orderId),
    queryFn: () => WorkflowsApi.getTimeline(referenceType, orderId, props.companyId),
    enabled: !!orderId,
  });

  const tasks = timeline.data?.tasks ?? [];

  const printCompletePacket = async () => {
    const order = props.order;
    const sections: string[] = [];

    sections.push(`
      <h1>${esc(props.mode === 'inbound' ? 'Inbound order packet' : 'Outbound order packet')}</h1>
      <p class="meta">${esc(order.orderNumber ?? order.id)} · ${esc(order.company?.name ?? '—')} · Printed ${esc(new Date().toLocaleString())}</p>
      <div class="grid">
        <div class="field"><label>Status</label><div>${esc(order.status)}</div></div>
        <div class="field"><label>Client</label><div>${esc(order.company?.name ?? '—')}</div></div>
      </div>
      <h2>Order lines</h2>
      <table class="data">
        <thead><tr><th>#</th><th>SKU</th><th>Product</th><th>Qty</th></tr></thead>
        <tbody>
          ${(order.lines ?? [])
            .map((l) => {
              const qty =
                props.mode === 'inbound'
                  ? (l as InboundOrder['lines'][number]).expectedQuantity
                  : (l as NonNullable<OutboundOrder['lines']>[number]).requestedQuantity;
              return `<tr>
                <td>${l.lineNumber}</td>
                <td class="mono">${esc(l.product?.sku ?? '—')}</td>
                <td>${esc(l.product?.name ?? '—')}</td>
                <td class="mono">${esc(qty)}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    `);

    const taskEntries: Array<[string, WorkflowTimelineTask | undefined]> =
      props.mode === 'inbound'
        ? [
            ['Receiving', findTimelineTask(tasks, 'receiving')],
            [
              'Putaway',
              findTimelineTask(tasks, 'putaway') ?? findTimelineTask(tasks, 'putaway_quarantine'),
            ],
          ]
        : [
            ['Pick', findTimelineTask(tasks, 'pick')],
            ...(props.requiresPacking
              ? [['Pack', findTimelineTask(tasks, 'pack')] as [string, WorkflowTimelineTask | undefined]]
              : []),
            ['Dispatch', findTimelineTask(tasks, 'dispatch')],
          ];

    for (const [labelText, task] of taskEntries) {
      if (!task) continue;
      let planSummary = '—';
      try {
        const detail = await TasksApi.get(task.id, props.companyId);
        const payload = detail.payload;
        if (isRecord(payload)) {
          const wp = payload.workspace_plan ?? payload.workspacePlan;
          if (isRecord(wp) && Array.isArray(wp.lines)) {
            planSummary = `${wp.lines.length} planned line(s)`;
          } else if (Array.isArray(payload.lines)) {
            planSummary = `${payload.lines.length} task line(s)`;
          }
        }
      } catch {
        planSummary = 'Could not load plan';
      }
      sections.push(`
        <h2>${esc(labelText)}</h2>
        <div class="grid">
          <div class="field"><label>Task status</label><div>${esc(task.status)}</div></div>
          <div class="field"><label>Plan</label><div>${esc(planSummary)}</div></div>
          <div class="field"><label>Started</label><div>${esc(task.startedAt ? formatTaskDateTime(task.startedAt) : '—')}</div></div>
          <div class="field"><label>Completed</label><div>${esc(task.completedAt ? formatTaskDateTime(task.completedAt) : '—')}</div></div>
        </div>
      `);
    }

    const body = sections.join('\n');
    const ok = openTaskPrintHtml(`Order packet ${order.orderNumber ?? order.id}`, body);
    if (!ok) toast.error(label('Allow pop-ups to print.', 'اسمح بالنوافذ المنبثقة للطباعة.', isArabic));
  };

  const stagePrintHint =
    props.mode === 'inbound'
      ? label(
          'Use Receiving and Putaway sections for stage-specific print sheets.',
          'استخدم أقسام الاستلام والإيداع لطباعة أوراق المراحل.',
          isArabic,
        )
      : label(
          'Use Pick, Pack, and Dispatch sections for stage-specific print sheets.',
          'استخدم أقسام التقاط والتغليف والإرسال لطباعة أوراق المراحل.',
          isArabic,
        );

  return (
    <div className="space-y-4">
      <OrderDocumentsCard
        referenceType={referenceType}
        referenceId={orderId}
        companyIdOverride={props.companyId}
      />
      <div className="rounded-lg border border-border bg-surface-card p-4">
        <h3 className="text-sm font-semibold text-text-strong">
          {label('Print worksheets', 'طباعة أوراق العمل', isArabic)}
        </h3>
        <p className="mt-1 text-xs text-text-muted">{stagePrintHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void printCompletePacket()}>
            {label('Print complete order packet', 'طباعة حزمة الطلب الكاملة', isArabic)}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { TASK_PRINT_PAGE_STYLES };
