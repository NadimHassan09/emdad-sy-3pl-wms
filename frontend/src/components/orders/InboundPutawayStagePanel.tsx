import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { InboundOrder, InboundOrderLine } from '../../api/inbound';
import { InboundApi } from '../../api/inbound';
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
import { useResolvedLocations } from '../../hooks/useResolvedLocations';
import type { InboundExecutionPlan } from '../../lib/execution-plan';
import { PutawayDestinationPicker } from '../../pages/tasks/putaway/PutawayDestinationPicker';
import type { PutawayLineDraft, PutawayLineRow } from '../../pages/tasks/putaway/putaway-types';
import {
  openPutawayPrintPdf,
  putawayDestinationSummary,
  putawaySourceSummary,
} from '../../pages/tasks/putaway/putaway-print';
import { parseQty } from '../../pages/tasks/putaway/putaway-utils';
import { adminConfirmOrStartComplete } from '../../lib/admin-confirm-fallback';
import { OrderWorkspaceStageFooter } from './OrderWorkspaceStageFooter';

type Props = {
  order: InboundOrder;
  companyId?: string;
  warehouseId: string;
  receivingCompleted: boolean;
  onConfirmed?: () => void;
  renderFooter?: (footer: React.ReactNode) => void;
};

function readPutawayLines(payload: unknown): PutawayLineRow[] {
  if (!isRecord(payload) || !Array.isArray(payload.lines)) return [];
  return payload.lines as PutawayLineRow[];
}

function workspaceLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Plan putaway now': 'خطّط الإيداع الآن',
    'Start workflow from Overview first.': 'ابدأ سير العمل من نظرة عامة أولاً.',
    'Putaway completed': 'اكتمل الإيداع',
    'Save plan': 'حفظ الخطة',
    'Print putaway sheet': 'طباعة ورقة الإيداع',
    'Confirm putaway': 'تأكيد الإيداع',
    'Plan saved.': 'تم حفظ الخطة.',
    'Putaway confirmed.': 'تم تأكيد الإيداع.',
    SKU: 'رمز الصنف',
    Product: 'المنتج',
    Quantity: 'الكمية',
    Destination: 'الوجهة',
  };
  return ar[label] ?? label;
}

export function InboundPutawayStagePanel({
  order,
  companyId,
  warehouseId,
  receivingCompleted,
  onConfirmed,
  renderFooter,
}: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => workspaceLabel(label, isArabic);

  const timeline = useQuery({
    queryKey: QK.workflows.timeline('inbound_order', order.id),
    queryFn: () => WorkflowsApi.getTimeline('inbound_order', order.id, companyId),
    enabled: !!order.id,
  });

  const putawayTimelineTask = useMemo(() => {
    const tasks = timeline.data?.tasks ?? [];
    return (
      findTimelineTask(tasks, 'putaway', { openOnly: true }) ??
      findTimelineTask(tasks, 'putaway_quarantine', { openOnly: true }) ??
      findTimelineTask(tasks, 'putaway', { preferCompleted: true })
    );
  }, [timeline.data?.tasks]);

  const taskType =
    putawayTimelineTask?.taskType === 'putaway_quarantine' ? 'putaway_quarantine' : 'putaway';

  const taskDetail = useQuery({
    queryKey: QK.tasks.detail(putawayTimelineTask?.id ?? ''),
    queryFn: () => TasksApi.get(putawayTimelineTask!.id, companyId),
    enabled: !!putawayTimelineTask?.id,
  });

  const payload = taskDetail.data?.payload;
  const putawayLines = useMemo(() => readPutawayLines(payload), [payload]);
  const workspacePlan = useMemo(() => readWorkspacePlanLines(payload), [payload]);

  const lineMap = useMemo(() => {
    const m = new Map<string, InboundOrderLine>();
    for (const l of order.lines) m.set(l.id, l);
    return m;
  }, [order.lines]);

  const [drafts, setDrafts] = useState<PutawayLineDraft[]>([]);

  useEffect(() => {
    if (putawayLines.length > 0) {
      setDrafts(
        putawayLines.map((l, i) => {
          const saved = workspacePlan[l.inbound_order_line_id];
          return {
            rowKey: `${l.inbound_order_line_id}-${i}`,
            inbound_order_line_id: l.inbound_order_line_id,
            putaway_quantity: saved?.putaway_quantity ?? saved?.putawayQuantity ?? l.quantity,
            destination_location_id:
              saved?.destination_location_id ?? saved?.destinationLocationId ?? '',
            lot_id: l.lot_id ?? null,
            sourceVerified: false,
            destVerified: false,
            productVerified: false,
            notes: '',
          };
        }),
      );
      return;
    }

    // Pre-receive: plan putaway from order lines / executionPlan (no putaway task yet).
    const plan = (order.executionPlan ?? null) as InboundExecutionPlan | null;
    const rows: PutawayLineDraft[] = [];
    for (const ol of order.lines) {
      const planLine =
        plan?.lines.find((p) => p.orderLineId === ol.id) ??
        plan?.lines.find((p) => p.productId === ol.productId);
      const splits = planLine?.putaway?.length
        ? planLine.putaway
        : [{ locationId: '', qty: Number(ol.expectedQuantity) }];
      splits.forEach((s, i) => {
        rows.push({
          rowKey: `${ol.id}-${i}`,
          inbound_order_line_id: ol.id,
          putaway_quantity: String(s.qty),
          destination_location_id: s.locationId ?? '',
          lot_id: null,
          sourceVerified: false,
          destVerified: false,
          productVerified: false,
          notes: '',
        });
      });
    }
    setDrafts(rows);
  }, [putawayLines, workspacePlan, order.lines, order.executionPlan]);

  const destinationIds = useMemo(
    () => drafts.map((d) => d.destination_location_id.trim()).filter(Boolean),
    [drafts],
  );
  const { locationById } = useResolvedLocations(destinationIds);

  const stagingByLineId = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of putawayLines) {
      if (l.source_staging_location_id) m.set(l.inbound_order_line_id, l.source_staging_location_id);
    }
    return m;
  }, [putawayLines]);

  const stagingLocationIds = useMemo(
    () => [...stagingByLineId.values()],
    [stagingByLineId],
  );
  const { locationById: stagingLocationById } = useResolvedLocations(stagingLocationIds);
  const allLocationById = useMemo(() => {
    const merged = new Map(locationById);
    for (const [k, v] of stagingLocationById) merged.set(k, v);
    return merged;
  }, [locationById, stagingLocationById]);

  const savePlanMut = useMutation({
    mutationFn: async () => {
      if (putawayTimelineTask?.id) {
        const lines = drafts.map((d) => ({
          inbound_order_line_id: d.inbound_order_line_id,
          putaway_quantity: d.putaway_quantity.trim() || '0',
          destination_location_id: d.destination_location_id.trim() || undefined,
        }));
        return TasksApi.patchPlan(
          putawayTimelineTask.id,
          { workspace_plan: { lines } },
          companyId,
        );
      }

      // Persist destinations on the order plan before receiving creates the putaway task.
      const byLine = new Map<string, Array<{ locationId: string; qty: number }>>();
      for (const d of drafts) {
        const list = byLine.get(d.inbound_order_line_id) ?? [];
        list.push({
          locationId: d.destination_location_id.trim(),
          qty: parseQty(d.putaway_quantity),
        });
        byLine.set(d.inbound_order_line_id, list);
      }
      const prev = (order.executionPlan ?? {}) as InboundExecutionPlan;
      const executionPlan: InboundExecutionPlan = {
        warehouseId: prev.warehouseId || warehouseId,
        receivingDockId: prev.receivingDockId || '',
        planUpdatedAt: new Date().toISOString(),
        lines: order.lines.map((ol) => ({
          productId: ol.productId,
          orderLineId: ol.id,
          expectedQty: Number(ol.expectedQuantity),
          putaway: (byLine.get(ol.id) ?? []).filter((s) => s.locationId && s.qty > 0),
        })),
      };
      return InboundApi.updatePlan(order.id, {
        executionMode: order.executionMode ?? 'admin',
        executionPlan,
      });
    },
    onSuccess: (env) => {
      toast.success(t('Plan saved.'));
      if (putawayTimelineTask?.id && env && typeof env === 'object' && 'task' in (env as object)) {
        applyTaskMutationEnvelope(qc, {
          taskId: putawayTimelineTask.id,
          envelope: env as Parameters<typeof applyTaskMutationEnvelope>[1]['envelope'],
          warehouseId,
          referenceId: order.id,
          referenceType: 'inbound_order',
        });
      }
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, order.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      const taskId = putawayTimelineTask!.id;
      const submitRows = drafts.filter((r) => parseQty(r.putaway_quantity) > 0);
      const body = {
        task_type: taskType as 'putaway' | 'putaway_quarantine',
        schema_version: 1,
        lines: submitRows.map((r) => ({
          inbound_order_line_id: r.inbound_order_line_id,
          putaway_quantity: (r.putaway_quantity ?? '0').trim() || '0',
          destination_location_id: r.destination_location_id,
          lot_id: r.lot_id ?? null,
        })),
      };
      return adminConfirmOrStartComplete(taskId, body, companyId);
    },
    onSuccess: (env) => {
      toast.success(t('Putaway confirmed.'));
      applyTaskMutationEnvelope(qc, {
        taskId: putawayTimelineTask!.id,
        envelope: env,
        warehouseId,
        referenceId: order.id,
        referenceType: 'inbound_order',
      });
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, order.id] });
      invalidateWorkflowTasksInventory(qc, { referenceId: order.id, referenceType: 'inbound_order' });
      onConfirmed?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePrint = () => {
    const stagingByLineId = new Map<string, string>();
    for (const l of putawayLines) {
      if (l.source_staging_location_id) {
        stagingByLineId.set(l.inbound_order_line_id, l.source_staging_location_id);
      }
    }
    const targetQty: Record<string, number> = {};
    for (const l of putawayLines) {
      targetQty[l.inbound_order_line_id] = parseQty(l.quantity);
    }
    const ok = openPutawayPrintPdf({
      taskLabel: 'Putaway',
      orderNumber: order.orderNumber ?? order.id,
      companyName: order.company?.name ?? '—',
      operatorNotes: order.notes ?? '',
      assignedWorker: '—',
      sourceSummary: putawaySourceSummary(drafts, stagingByLineId, allLocationById),
      destinationSummary: putawayDestinationSummary(drafts, allLocationById),
      drafts,
      lineById: lineMap,
      stagingByLineId,
      locationById: allLocationById,
      targetQty,
    });
    if (!ok) toast.error('Allow pop-ups to print.');
  };

  const footer = (
    <OrderWorkspaceStageFooter
      onSavePlan={() => savePlanMut.mutate()}
      savePlanLabel={t('Save plan')}
      savePlanLoading={savePlanMut.isPending}
      savePlanDisabled={
        putawayTimelineTask
          ? isCompletedTaskStatus(putawayTimelineTask.status)
          : false
      }
      onPrint={handlePrint}
      printLabel={t('Print putaway sheet')}
      printDisabled={drafts.length === 0}
      onConfirm={() => confirmMut.mutate()}
      confirmLabel={t('Confirm putaway')}
      confirmLoading={confirmMut.isPending}
      confirmDisabled={
        !receivingCompleted ||
        !putawayTimelineTask ||
        isCompletedTaskStatus(putawayTimelineTask.status) ||
        !isOpenTaskStatus(putawayTimelineTask.status)
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
    putawayTimelineTask?.id,
    putawayTimelineTask?.status,
    receivingCompleted,
    drafts,
  ]);

  if (timeline.isLoading) {
    return <p className="text-sm text-text-muted">Loading workflow…</p>;
  }

  if (putawayTimelineTask && isCompletedTaskStatus(putawayTimelineTask.status)) {
    return (
      <Alert variant="success" title={t('Putaway completed')}>
        <p className="text-sm text-text-body">
          {putawayTimelineTask.completedAt
            ? formatTaskDateTime(putawayTimelineTask.completedAt)
            : null}
        </p>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
            {t('Print putaway sheet')}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {!receivingCompleted ? (
        <Alert variant="info" title={t('Plan putaway now')}>
          You can set destinations before receiving. Confirm putaway unlocks after receiving is
          confirmed.
        </Alert>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2">{t('SKU')}</th>
              <th className="px-3 py-2">{t('Product')}</th>
              <th className="px-3 py-2">{t('Quantity')}</th>
              <th className="px-3 py-2">{t('Destination')}</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const ol = lineMap.get(d.inbound_order_line_id);
              return (
                <tr key={d.rowKey} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{ol?.product?.sku ?? '—'}</td>
                  <td className="px-3 py-2">{ol?.product?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <TextField
                      label=""
                      type="number"
                      min={0}
                      step="0.0001"
                      value={d.putaway_quantity}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev.map((row) =>
                            row.rowKey === d.rowKey
                              ? { ...row, putaway_quantity: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[220px]">
                    <PutawayDestinationPicker
                      warehouseId={warehouseId}
                      taskType={taskType}
                      value={d.destination_location_id}
                      onChange={(id) =>
                        setDrafts((prev) =>
                          prev.map((row) =>
                            row.rowKey === d.rowKey
                              ? { ...row, destination_location_id: id }
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
