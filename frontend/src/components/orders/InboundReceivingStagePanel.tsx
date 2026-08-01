import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { InboundOrder, InboundOrderLine } from '../../api/inbound';
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
import type { LineReceiveDraft, ReceivingLineRow } from '../../pages/tasks/receiving/receiving-types';
import {
  buildReceivingPrintInput,
  openReceivingPrintPdf,
} from '../../pages/tasks/receiving/receiving-print';
import { adminConfirmOrStartComplete } from '../../lib/admin-confirm-fallback';
import { OrderWorkspaceStageFooter } from './OrderWorkspaceStageFooter';

type LineDraft = {
  receivedQty: string;
  lotNumber: string;
  expiry: string;
};

type Props = {
  order: InboundOrder;
  companyId?: string;
  warehouseId: string;
  onConfirmed?: () => void;
  renderFooter?: (footer: React.ReactNode) => void;
};

function emptyDraft(): LineDraft {
  return { receivedQty: '', lotNumber: '', expiry: '' };
}

function readReceivingLines(payload: unknown): ReceivingLineRow[] {
  if (!isRecord(payload) || !Array.isArray(payload.lines)) return [];
  return payload.lines as ReceivingLineRow[];
}

function workspaceLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Start workflow from Overview first.': 'ابدأ سير العمل من نظرة عامة أولاً.',
    'Receiving completed': 'اكتمل الاستلام',
    'Save plan': 'حفظ الخطة',
    'Print receiving sheet': 'طباعة ورقة الاستلام',
    'Confirm receiving': 'تأكيد الاستلام',
    'Plan saved.': 'تم حفظ الخطة.',
    'Receiving confirmed.': 'تم تأكيد الاستلام.',
    SKU: 'رمز الصنف',
    Product: 'المنتج',
    Expected: 'المتوقع',
    Received: 'المستلم',
    Lot: 'الدفعة',
    Expiry: 'الانتهاء',
  };
  return ar[label] ?? label;
}

export function InboundReceivingStagePanel({
  order,
  companyId,
  warehouseId,
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

  const receivingTimelineTask = useMemo(() => {
    const tasks = timeline.data?.tasks ?? [];
    return (
      findTimelineTask(tasks, 'receiving', { openOnly: true }) ??
      findTimelineTask(tasks, 'receiving', { preferCompleted: true })
    );
  }, [timeline.data?.tasks]);

  const taskDetail = useQuery({
    queryKey: QK.tasks.detail(receivingTimelineTask?.id ?? ''),
    queryFn: () => TasksApi.get(receivingTimelineTask!.id, companyId),
    enabled: !!receivingTimelineTask?.id,
  });

  const payload = taskDetail.data?.payload;
  const receivingLines = useMemo(() => readReceivingLines(payload), [payload]);
  const workspacePlan = useMemo(() => readWorkspacePlanLines(payload), [payload]);

  const lineMap = useMemo(() => {
    const m = new Map<string, InboundOrderLine>();
    for (const l of order.lines) m.set(l.id, l);
    return m;
  }, [order.lines]);

  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});

  useEffect(() => {
    const next: Record<string, LineDraft> = {};
    const rows = receivingLines.length
      ? receivingLines
      : order.lines.map((ol) => ({
          inbound_order_line_id: ol.id,
          expected_qty: ol.expectedQuantity,
          staging_location_id: '',
        }));
    for (const row of rows) {
      const ol = lineMap.get(row.inbound_order_line_id);
      const saved = workspacePlan[row.inbound_order_line_id];
      next[row.inbound_order_line_id] = {
        receivedQty: saved?.received_qty ?? saved?.receivedQty ?? row.expected_qty ?? '',
        lotNumber: saved?.lot_number ?? saved?.lotNumber ?? ol?.expectedLotNumber ?? '',
        expiry:
          saved?.expiry ??
          (ol?.expectedExpiryDate ? ol.expectedExpiryDate.slice(0, 10) : ''),
      };
    }
    setDrafts(next);
  }, [receivingLines, lineMap, order.lines, workspacePlan]);

  const stagingLocationIds = useMemo(
    () => receivingLines.map((l) => l.staging_location_id?.trim() ?? '').filter(Boolean),
    [receivingLines],
  );
  const { locationById: stagingLocationsById } = useResolvedLocations(stagingLocationIds);

  const savePlanMut = useMutation({
    mutationFn: () => {
      const taskId = receivingTimelineTask!.id;
      const rows = receivingLines.length
        ? receivingLines
        : order.lines.map((ol) => ({
            inbound_order_line_id: ol.id,
            expected_qty: ol.expectedQuantity,
            staging_location_id: '',
          }));
      const lines = rows.map((row) => {
        const d = drafts[row.inbound_order_line_id] ?? emptyDraft();
        return {
          inbound_order_line_id: row.inbound_order_line_id,
          received_qty: d.receivedQty.trim() || '0',
          lot_number: d.lotNumber.trim() || undefined,
          expiry: d.expiry.trim() || undefined,
        };
      });
      return TasksApi.patchPlan(taskId, { workspace_plan: { lines } }, companyId);
    },
    onSuccess: (env) => {
      toast.success(t('Plan saved.'));
      applyTaskMutationEnvelope(qc, {
        taskId: receivingTimelineTask!.id,
        envelope: env,
        warehouseId,
        referenceId: order.id,
        referenceType: 'inbound_order',
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      const taskId = receivingTimelineTask!.id;
      const rows = receivingLines.length
        ? receivingLines
        : order.lines.map((ol) => ({
            inbound_order_line_id: ol.id,
            expected_qty: ol.expectedQuantity,
            staging_location_id: '',
          }));

      const hasShortage = rows.some((l) => {
        const expected = Number(l.expected_qty);
        const d = drafts[l.inbound_order_line_id] ?? emptyDraft();
        const received = Number((d.receivedQty ?? '0').trim() || '0');
        return received < expected;
      });

      const body = {
        task_type: 'receiving' as const,
        allow_short_close: hasShortage,
        lines: rows.map((l) => {
          const lid = l.inbound_order_line_id;
          const ol = lineMap.get(lid);
          const d = drafts[lid] ?? emptyDraft();
          const lotPayload =
            ol?.product?.trackingType === 'lot' && (d.lotNumber.trim() || ol.expectedLotNumber?.trim())
              ? { capture_lot_number: (d.lotNumber.trim() || ol.expectedLotNumber!.trim()) }
              : {};
          return {
            inbound_order_line_id: lid,
            received_qty: (d.receivedQty ?? '0').trim() || '0',
            ...lotPayload,
          };
        }),
      };

      return adminConfirmOrStartComplete(taskId, body, companyId);
    },
    onSuccess: (env) => {
      toast.success(t('Receiving confirmed.'));
      applyTaskMutationEnvelope(qc, {
        taskId: receivingTimelineTask!.id,
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
    const lineDrafts: Record<string, LineReceiveDraft> = {};
    for (const [lid, d] of Object.entries(drafts)) {
      lineDrafts[lid] = {
        receivedQty: d.receivedQty,
        damagedQty: '',
        notes: '',
        expiry: d.expiry,
      };
    }
    const printLines: ReceivingLineRow[] = receivingLines.length
      ? receivingLines
      : order.lines.map((ol) => ({
          inbound_order_line_id: ol.id,
          expected_qty: ol.expectedQuantity,
          staging_location_id: '',
        }));
    const ok = openReceivingPrintPdf(
      buildReceivingPrintInput({
        orderNumber: order.orderNumber ?? order.id,
        companyName: order.company?.name ?? '—',
        operatorNotes: order.notes ?? '',
        assignedWorker: '—',
        expectedArrival: formatTaskDateTime(order.expectedArrivalDate),
        firstInboundProductIds: [],
        productsById: new Map(),
        lines: printLines,
        lineMap,
        lineDrafts,
        locations: [...stagingLocationsById.values()],
      }),
    );
    if (!ok) toast.error('Allow pop-ups to print.');
  };

  const footer = (
    <OrderWorkspaceStageFooter
      onSavePlan={() => savePlanMut.mutate()}
      savePlanLabel={t('Save plan')}
      savePlanLoading={savePlanMut.isPending}
      savePlanDisabled={!receivingTimelineTask || isCompletedTaskStatus(receivingTimelineTask.status)}
      onPrint={handlePrint}
      printLabel={t('Print receiving sheet')}
      printDisabled={!receivingTimelineTask}
      onConfirm={() => confirmMut.mutate()}
      confirmLabel={t('Confirm receiving')}
      confirmLoading={confirmMut.isPending}
      confirmDisabled={
        !receivingTimelineTask ||
        isCompletedTaskStatus(receivingTimelineTask.status) ||
        !isOpenTaskStatus(receivingTimelineTask.status)
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
    receivingTimelineTask?.id,
    receivingTimelineTask?.status,
    drafts,
  ]);

  if (timeline.isLoading) {
    return <p className="text-sm text-text-muted">Loading workflow…</p>;
  }

  if (!receivingTimelineTask) {
    return <Alert variant="info" title={t('Start workflow from Overview first.')} />;
  }

  if (isCompletedTaskStatus(receivingTimelineTask.status)) {
    return (
      <Alert variant="success" title={t('Receiving completed')}>
        <p className="text-sm text-text-body">
          {receivingTimelineTask.completedAt
            ? formatTaskDateTime(receivingTimelineTask.completedAt)
            : null}
        </p>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
            {t('Print receiving sheet')}
          </Button>
        </div>
      </Alert>
    );
  }

  const displayLines = receivingLines.length
    ? receivingLines
    : order.lines.map((ol) => ({
        inbound_order_line_id: ol.id,
        expected_qty: ol.expectedQuantity,
        staging_location_id: '',
      }));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2">{t('SKU')}</th>
              <th className="px-3 py-2">{t('Product')}</th>
              <th className="px-3 py-2 text-end">{t('Expected')}</th>
              <th className="px-3 py-2">{t('Received')}</th>
              <th className="px-3 py-2">{t('Lot')}</th>
              <th className="px-3 py-2">{t('Expiry')}</th>
            </tr>
          </thead>
          <tbody>
            {displayLines.map((row) => {
              const ol = lineMap.get(row.inbound_order_line_id);
              const d = drafts[row.inbound_order_line_id] ?? emptyDraft();
              const isLot = ol?.product?.trackingType === 'lot';
              return (
                <tr key={row.inbound_order_line_id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{ol?.product?.sku ?? '—'}</td>
                  <td className="px-3 py-2">{ol?.product?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-end font-mono">
                    {Number(row.expected_qty).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-3 py-2">
                    <TextField
                      label=""
                      type="number"
                      min={0}
                      step="0.0001"
                      value={d.receivedQty}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.inbound_order_line_id]: { ...d, receivedQty: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    {isLot ? (
                      <TextField
                        label=""
                        value={d.lotNumber}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.inbound_order_line_id]: { ...d, lotNumber: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isLot && (ol?.product?.expiryTracking ?? false) ? (
                      <TextField
                        label=""
                        type="date"
                        value={d.expiry}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.inbound_order_line_id]: { ...d, expiry: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      '—'
                    )}
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
