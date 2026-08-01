import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { OutboundOrder } from '../../api/outbound';
import { TasksApi } from '../../api/tasks';
import { WorkflowsApi } from '../../api/workflows';
import { Alert, Button } from '@ds';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { applyTaskMutationEnvelope } from '../../lib/task-mutation-cache';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';
import {
  findTimelineTask,
  isCompletedTaskStatus,
  isOpenTaskStatus,
  isRecord,
  readWorkspacePlanLines,
} from '../../lib/order-workspace-tasks';
import {
  buildDispatchCompletePayload,
  defaultPackages,
  initialDispatchLines,
} from '../../pages/tasks/dispatch/dispatch-utils';
import type { DispatchExecutionDraft } from '../../pages/tasks/dispatch/dispatch-types';
import { openDispatchPrintPdf } from '../../pages/tasks/dispatch/dispatch-print';
import { adminConfirmOrStartComplete } from '../../lib/admin-confirm-fallback';
import { OrderWorkspaceStageFooter } from './OrderWorkspaceStageFooter';

type Props = {
  order: OutboundOrder;
  companyId?: string;
  warehouseId: string;
  requiresPacking: boolean;
  priorStageCompleted: boolean;
  onConfirmed?: () => void;
  renderFooter?: (footer: React.ReactNode) => void;
};

function tLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Complete prior stages first.': 'أكمل المراحل السابقة أولاً.',
    'Dispatch completed': 'اكتمل الإرسال',
    'Save plan': 'حفظ الخطة',
    'Print dispatch sheet': 'طباعة ورقة الإرسال',
    'Confirm dispatch': 'تأكيد الإرسال',
    'Plan saved.': 'تم حفظ الخطة.',
    'Dispatch confirmed.': 'تم تأكيد الإرسال.',
    SKU: 'رمز الصنف',
    'Ship qty': 'كمية الشحن',
    Carrier: 'الناقل',
    Tracking: 'التتبع',
  };
  return ar[label] ?? label;
}

function readDispatchLineIds(payload: unknown, order: OutboundOrder): string[] {
  if (isRecord(payload) && Array.isArray(payload.outbound_order_line_ids)) {
    return payload.outbound_order_line_ids as string[];
  }
  return order.lines?.map((l) => l.id) ?? [];
}

export function OutboundDispatchStagePanel({
  order,
  companyId,
  warehouseId,
  requiresPacking,
  priorStageCompleted,
  onConfirmed,
  renderFooter,
}: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => tLabel(label, isArabic);

  const timeline = useQuery({
    queryKey: QK.workflows.timeline('outbound_order', order.id),
    queryFn: () => WorkflowsApi.getTimeline('outbound_order', order.id, companyId),
    enabled: !!order.id,
  });

  const dispatchTimelineTask = useMemo(() => {
    const tasks = timeline.data?.tasks ?? [];
    return (
      findTimelineTask(tasks, 'dispatch', { openOnly: true }) ??
      findTimelineTask(tasks, 'dispatch', { preferCompleted: true })
    );
  }, [timeline.data?.tasks]);

  const taskDetail = useQuery({
    queryKey: QK.tasks.detail(dispatchTimelineTask?.id ?? ''),
    queryFn: () => TasksApi.get(dispatchTimelineTask!.id, companyId),
    enabled: !!dispatchTimelineTask?.id,
  });

  const lineIds = useMemo(
    () => readDispatchLineIds(taskDetail.data?.payload, order),
    [taskDetail.data?.payload, order],
  );
  const workspacePlan = useMemo(
    () => readWorkspacePlanLines(taskDetail.data?.payload),
    [taskDetail.data?.payload],
  );

  const lineMeta = useMemo(() => new Map((order.lines ?? []).map((l) => [l.id, l])), [order.lines]);

  const [carrier, setCarrier] = useState(order.carrier ?? '');
  const [tracking, setTracking] = useState('');
  const [lines, setLines] = useState(() => initialDispatchLines(lineIds, lineMeta));

  useEffect(() => {
    const base = initialDispatchLines(lineIds, lineMeta);
    setLines(
      base.map((l) => {
        const saved = workspacePlan[l.outboundOrderLineId];
        return {
          ...l,
          shipQty: saved?.ship_qty ?? saved?.shipQty ?? l.shipQty,
        };
      }),
    );
  }, [lineIds, lineMeta, workspacePlan]);

  const draft: DispatchExecutionDraft = useMemo(
    () => ({
      lines,
      carrier,
      tracking,
      sourceLocationId: '',
      destinationLocationId: '',
      sourceVerified: false,
      destVerified: false,
      packages: defaultPackages(),
      driverName: '',
      vehicleInfo: '',
      dispatchNotes: '',
    }),
    [lines, carrier, tracking],
  );

  const savePlanMut = useMutation({
    mutationFn: () =>
      TasksApi.patchPlan(
        dispatchTimelineTask!.id,
        {
          workspace_plan: {
            lines: lines.map((l) => ({
              outbound_order_line_id: l.outboundOrderLineId,
              ship_qty: l.shipQty.trim() || '0',
            })),
            carrier: carrier.trim() || undefined,
            tracking: tracking.trim() || undefined,
          },
        },
        companyId,
      ),
    onSuccess: (env) => {
      toast.success(t('Plan saved.'));
      applyTaskMutationEnvelope(qc, {
        taskId: dispatchTimelineTask!.id,
        envelope: env,
        warehouseId,
        referenceId: order.id,
        referenceType: 'outbound_order',
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      const taskId = dispatchTimelineTask!.id;
      const body = { ...buildDispatchCompletePayload(lines, carrier, tracking), schema_version: 1 };
      return adminConfirmOrStartComplete(taskId, body, companyId);
    },
    onSuccess: (env) => {
      toast.success(t('Dispatch confirmed.'));
      applyTaskMutationEnvelope(qc, {
        taskId: dispatchTimelineTask!.id,
        envelope: env,
        warehouseId,
        referenceId: order.id,
        referenceType: 'outbound_order',
      });
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
      invalidateWorkflowTasksInventory(qc, { referenceId: order.id, referenceType: 'outbound_order' });
      onConfirmed?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePrint = () => {
    const ok = openDispatchPrintPdf({
      orderNumber: order.orderNumber ?? order.id,
      companyName: order.company?.name ?? '—',
      assignedWorker: '—',
      sourceLocation: requiresPacking ? 'Packing' : 'Output',
      destinationLocation: order.destinationAddress,
      carrier,
      tracking,
      driverName: '',
      vehicleInfo: '',
      operatorNotes: order.notes ?? '',
      dispatchNotes: '',
      lines,
      lineMeta,
      draft,
    });
    if (!ok) toast.error('Allow pop-ups to print.');
  };

  const footer = (
    <OrderWorkspaceStageFooter
      onSavePlan={() => savePlanMut.mutate()}
      savePlanLabel={t('Save plan')}
      savePlanLoading={savePlanMut.isPending}
      savePlanDisabled={
        !dispatchTimelineTask || isCompletedTaskStatus(dispatchTimelineTask.status) || !priorStageCompleted
      }
      onPrint={handlePrint}
      printLabel={t('Print dispatch sheet')}
      printDisabled={!dispatchTimelineTask}
      onConfirm={() => confirmMut.mutate()}
      confirmLabel={t('Confirm dispatch')}
      confirmLoading={confirmMut.isPending}
      confirmDisabled={
        !dispatchTimelineTask ||
        !priorStageCompleted ||
        isCompletedTaskStatus(dispatchTimelineTask.status) ||
        !isOpenTaskStatus(dispatchTimelineTask.status)
      }
    />
  );

  useEffect(() => {
    renderFooter?.(footer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    renderFooter,
    savePlanMut.isPending,
    confirmMut.isPending,
    dispatchTimelineTask?.status,
    priorStageCompleted,
    lines,
    carrier,
    tracking,
  ]);

  if (!priorStageCompleted) {
    return <Alert variant="info" title={t('Complete prior stages first.')} />;
  }

  if (timeline.isLoading) return <p className="text-sm text-text-muted">Loading workflow…</p>;
  if (!dispatchTimelineTask) return null;

  if (isCompletedTaskStatus(dispatchTimelineTask.status)) {
    return (
      <Alert variant="success" title={t('Dispatch completed')}>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
            {t('Print dispatch sheet')}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t('Carrier')} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
        <TextField label={t('Tracking')} value={tracking} onChange={(e) => setTracking(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2">{t('SKU')}</th>
              <th className="px-3 py-2">{t('Ship qty')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const ol = lineMeta.get(l.outboundOrderLineId);
              return (
                <tr key={l.outboundOrderLineId} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{ol?.product?.sku ?? '—'}</td>
                  <td className="px-3 py-2">
                    <TextField
                      label=""
                      type="number"
                      min={0}
                      step="0.0001"
                      value={l.shipQty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.outboundOrderLineId === l.outboundOrderLineId
                              ? { ...row, shipQty: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!renderFooter ? footer : null}
    </div>
  );
}
