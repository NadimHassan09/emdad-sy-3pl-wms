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
import { formatTaskDateTime } from '../../lib/task-details-helpers';
import {
  buildPackCompletePayload,
  createEmptyPackage,
  initialPackLines,
} from '../../pages/tasks/pack/pack-utils';
import type { PackLineDraft } from '../../pages/tasks/pack/pack-types';
import { openPackPrintPdf } from '../../pages/tasks/pack/pack-print';
import { adminConfirmOrStartComplete } from '../../lib/admin-confirm-fallback';
import { OrderWorkspaceStageFooter } from './OrderWorkspaceStageFooter';

type Props = {
  order: OutboundOrder;
  companyId?: string;
  warehouseId: string;
  pickCompleted: boolean;
  onConfirmed?: () => void;
  renderFooter?: (footer: React.ReactNode) => void;
};

function tLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Complete pick first.': 'أكمل التقاط أولاً.',
    'Pack completed': 'اكتمل التغليف',
    'Save plan': 'حفظ الخطة',
    'Print pack sheet': 'طباعة ورقة التغليف',
    'Confirm pack': 'تأكيد التغليف',
    'Plan saved.': 'تم حفظ الخطة.',
    'Pack confirmed.': 'تم تأكيد التغليف.',
    SKU: 'رمز الصنف',
    Picked: 'المُلتقط',
    Packed: 'المُغلف',
  };
  return ar[label] ?? label;
}

function readPackLineIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.outbound_order_line_ids)) return [];
  return payload.outbound_order_line_ids as string[];
}

export function OutboundPackStagePanel({
  order,
  companyId,
  warehouseId,
  pickCompleted,
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

  const packTimelineTask = useMemo(() => {
    const tasks = timeline.data?.tasks ?? [];
    return (
      findTimelineTask(tasks, 'pack', { openOnly: true }) ??
      findTimelineTask(tasks, 'pack', { preferCompleted: true })
    );
  }, [timeline.data?.tasks]);

  const taskDetail = useQuery({
    queryKey: QK.tasks.detail(packTimelineTask?.id ?? ''),
    queryFn: () => TasksApi.get(packTimelineTask!.id, companyId),
    enabled: !!packTimelineTask?.id,
  });

  const lineIds = useMemo(() => readPackLineIds(taskDetail.data?.payload), [taskDetail.data?.payload]);
  const workspacePlan = useMemo(
    () => readWorkspacePlanLines(taskDetail.data?.payload),
    [taskDetail.data?.payload],
  );

  const lineMeta = useMemo(() => new Map((order.lines ?? []).map((l) => [l.id, l])), [order.lines]);

  const [lines, setLines] = useState<PackLineDraft[]>([]);

  useEffect(() => {
    const base = initialPackLines(lineIds, lineMeta);
    setLines(
      base.map((l) => {
        const saved = workspacePlan[l.outboundOrderLineId];
        return {
          ...l,
          packedQty: saved?.packed_qty ?? saved?.packedQty ?? l.pickedQty,
        };
      }),
    );
  }, [lineIds, lineMeta, workspacePlan]);

  const savePlanMut = useMutation({
    mutationFn: () =>
      TasksApi.patchPlan(
        packTimelineTask!.id,
        {
          workspace_plan: {
            lines: lines.map((l) => ({
              outbound_order_line_id: l.outboundOrderLineId,
              packed_qty: l.packedQty.trim() || '0',
            })),
          },
        },
        companyId,
      ),
    onSuccess: (env) => {
      toast.success(t('Plan saved.'));
      applyTaskMutationEnvelope(qc, {
        taskId: packTimelineTask!.id,
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
      const taskId = packTimelineTask!.id;
      const packages = [createEmptyPackage([])];
      const body = { ...buildPackCompletePayload(lineIds, lines, packages), schema_version: 1 };
      return adminConfirmOrStartComplete(taskId, body, companyId);
    },
    onSuccess: (env) => {
      toast.success(t('Pack confirmed.'));
      applyTaskMutationEnvelope(qc, {
        taskId: packTimelineTask!.id,
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
    const ok = openPackPrintPdf({
      orderNumber: order.orderNumber ?? order.id,
      companyName: order.company?.name ?? '—',
      assignedWorker: '—',
      packingStation: '—',
      shipTo: order.destinationAddress,
      shipBy: formatTaskDateTime(order.requiredShipDate),
      operatorNotes: order.notes ?? '',
      lines,
      lineMeta,
      packages: [createEmptyPackage([])],
    });
    if (!ok) toast.error('Allow pop-ups to print.');
  };

  const footer = (
    <OrderWorkspaceStageFooter
      onSavePlan={() => savePlanMut.mutate()}
      savePlanLabel={t('Save plan')}
      savePlanLoading={savePlanMut.isPending}
      savePlanDisabled={!packTimelineTask || isCompletedTaskStatus(packTimelineTask.status) || !pickCompleted}
      onPrint={handlePrint}
      printLabel={t('Print pack sheet')}
      printDisabled={!packTimelineTask}
      onConfirm={() => confirmMut.mutate()}
      confirmLabel={t('Confirm pack')}
      confirmLoading={confirmMut.isPending}
      confirmDisabled={
        !packTimelineTask ||
        !pickCompleted ||
        isCompletedTaskStatus(packTimelineTask.status) ||
        !isOpenTaskStatus(packTimelineTask.status)
      }
    />
  );

  useEffect(() => {
    renderFooter?.(footer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderFooter, savePlanMut.isPending, confirmMut.isPending, packTimelineTask?.status, pickCompleted, lines]);

  if (!pickCompleted) return <Alert variant="info" title={t('Complete pick first.')} />;
  if (timeline.isLoading) return <p className="text-sm text-text-muted">Loading workflow…</p>;
  if (!packTimelineTask) return null;

  if (isCompletedTaskStatus(packTimelineTask.status)) {
    return (
      <Alert variant="success" title={t('Pack completed')}>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
            {t('Print pack sheet')}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2">{t('SKU')}</th>
              <th className="px-3 py-2 text-end">{t('Picked')}</th>
              <th className="px-3 py-2">{t('Packed')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const ol = lineMeta.get(l.outboundOrderLineId);
              return (
                <tr key={l.outboundOrderLineId} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{ol?.product?.sku ?? '—'}</td>
                  <td className="px-3 py-2 text-end font-mono">{l.pickedQty}</td>
                  <td className="px-3 py-2">
                    <TextField
                      label=""
                      type="number"
                      min={0}
                      step="0.0001"
                      value={l.packedQty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.outboundOrderLineId === l.outboundOrderLineId
                              ? { ...row, packedQty: e.target.value }
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
