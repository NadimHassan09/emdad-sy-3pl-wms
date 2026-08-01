import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { OutboundOrder } from '../../api/outbound';
import { TasksApi } from '../../api/tasks';
import { WorkflowsApi } from '../../api/workflows';
import { Alert, Button } from '@ds';
import { Combobox } from '../Combobox';
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
} from '../../lib/order-workspace-tasks';
import { formatTaskDateTime } from '../../lib/task-details-helpers';
import { useResolvedLocations } from '../../hooks/useResolvedLocations';
import { useTypedLocationLookup } from '../../hooks/useTypedLocationLookup';
import type { PickLineDraft } from '../../pages/tasks/pick/pick-types';
import {
  buildPickCompletePayload,
  initialPickDrafts,
  locationDisplay,
  parsePickReservationsFromExecutionState,
} from '../../pages/tasks/pick/pick-utils';
import { openPickPrintPdf } from '../../pages/tasks/pick/pick-print';
import { adminConfirmOrStartComplete } from '../../lib/admin-confirm-fallback';
import { OrderWorkspaceStageFooter } from './OrderWorkspaceStageFooter';

type Props = {
  order: OutboundOrder;
  companyId?: string;
  warehouseId: string;
  requiresPacking: boolean;
  workflowStarted: boolean;
  onConfirmed?: () => void;
  renderFooter?: (footer: React.ReactNode) => void;
};

function tLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Start workflow from Overview first.': 'ابدأ سير العمل من نظرة عامة أولاً.',
    'Pick completed': 'اكتمل التقاط',
    'Save plan': 'حفظ الخطة',
    'Print pick sheet': 'طباعة ورقة التقاط',
    'Confirm pick': 'تأكيد التقاط',
    'Plan saved.': 'تم حفظ الخطة.',
    'Pick confirmed.': 'تم تأكيد التقاط.',
    SKU: 'رمز الصنف',
    Location: 'الموقع',
    Required: 'المطلوب',
    Picked: 'المُلتقط',
    'Drop-off location': 'موقع التسليم',
  };
  return ar[label] ?? label;
}

export function OutboundPickStagePanel({
  order,
  companyId,
  warehouseId,
  requiresPacking,
  workflowStarted,
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

  const pickTimelineTask = useMemo(() => {
    const tasks = timeline.data?.tasks ?? [];
    return (
      findTimelineTask(tasks, 'pick', { openOnly: true }) ??
      findTimelineTask(tasks, 'pick', { preferCompleted: true })
    );
  }, [timeline.data?.tasks]);

  const taskDetail = useQuery({
    queryKey: QK.tasks.detail(pickTimelineTask?.id ?? ''),
    queryFn: () => TasksApi.get(pickTimelineTask!.id, companyId),
    enabled: !!pickTimelineTask?.id,
  });

  const reservations = useMemo(
    () => parsePickReservationsFromExecutionState(taskDetail.data?.executionState),
    [taskDetail.data?.executionState],
  );

  const lineMeta = useMemo(() => {
    const m = new Map((order.lines ?? []).map((l) => [l.id, l]));
    return m;
  }, [order.lines]);

  const [drafts, setDrafts] = useState<PickLineDraft[]>([]);
  const [packingDestinationId, setPackingDestinationId] = useState('');

  useEffect(() => {
    setDrafts(initialPickDrafts(reservations));
    const payload = taskDetail.data?.payload;
    if (isRecord(payload)) {
      const wp = payload.workspace_plan ?? payload.workspacePlan;
      if (isRecord(wp) && isRecord(wp.dropoff)) {
        const dropId = wp.dropoff.destination_location_id ?? wp.dropoff.destinationLocationId;
        if (typeof dropId === 'string') setPackingDestinationId(dropId);
      }
    }
  }, [reservations, taskDetail.data?.payload]);

  const reservationLocationIds = useMemo(
    () => [...new Set(reservations.map((r) => r.locationId))],
    [reservations],
  );
  const { locationById } = useResolvedLocations([...reservationLocationIds, packingDestinationId]);

  const dropOffType = requiresPacking ? 'packing' : 'output';
  const dropOffLookup = useTypedLocationLookup(warehouseId, dropOffType, !!warehouseId);

  const savePlanMut = useMutation({
    mutationFn: () =>
      TasksApi.patchPlan(
        pickTimelineTask!.id,
        {
          workspace_plan: {
            lines: drafts.map((d) => ({
              outbound_order_line_id: d.outboundOrderLineId,
              location_id: d.locationId,
              picked_qty: d.pickedQty.trim() || '0',
            })),
            dropoff: { destination_location_id: packingDestinationId.trim() || undefined },
          },
        },
        companyId,
      ),
    onSuccess: (env) => {
      toast.success(t('Plan saved.'));
      applyTaskMutationEnvelope(qc, {
        taskId: pickTimelineTask!.id,
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
      const taskId = pickTimelineTask!.id;
      if (packingDestinationId.trim()) {
        await TasksApi.patchProgress(
          taskId,
          { pick_draft: { lines: drafts, packingDestinationId: packingDestinationId.trim() } },
          companyId,
        );
      }
      const body = { ...buildPickCompletePayload(reservations), schema_version: 1 };
      return adminConfirmOrStartComplete(taskId, body, companyId);
    },
    onSuccess: (env) => {
      toast.success(t('Pick confirmed.'));
      applyTaskMutationEnvelope(qc, {
        taskId: pickTimelineTask!.id,
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
    const dropLoc = locationById.get(packingDestinationId);
    const ok = openPickPrintPdf({
      orderNumber: order.orderNumber ?? order.id,
      companyName: order.company?.name ?? '—',
      assignedWorker: '—',
      dropOffLabel: locationDisplay(dropLoc).shortLabel,
      dropOffLocation: locationDisplay(dropLoc).fullPath,
      shipBy: formatTaskDateTime(order.requiredShipDate),
      operatorNotes: order.notes ?? '',
      drafts,
      lineMeta,
      locationById,
      lotNumberById: new Map(),
    });
    if (!ok) toast.error('Allow pop-ups to print.');
  };

  const footer = (
    <OrderWorkspaceStageFooter
      onSavePlan={() => savePlanMut.mutate()}
      savePlanLabel={t('Save plan')}
      savePlanLoading={savePlanMut.isPending}
      savePlanDisabled={!pickTimelineTask || isCompletedTaskStatus(pickTimelineTask.status)}
      onPrint={handlePrint}
      printLabel={t('Print pick sheet')}
      printDisabled={!pickTimelineTask || drafts.length === 0}
      onConfirm={() => confirmMut.mutate()}
      confirmLabel={t('Confirm pick')}
      confirmLoading={confirmMut.isPending}
      confirmDisabled={
        !pickTimelineTask ||
        !workflowStarted ||
        isCompletedTaskStatus(pickTimelineTask.status) ||
        !isOpenTaskStatus(pickTimelineTask.status)
      }
    />
  );

  useEffect(() => {
    renderFooter?.(footer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderFooter, savePlanMut.isPending, confirmMut.isPending, pickTimelineTask?.status, drafts, packingDestinationId]);

  if (!workflowStarted) {
    return <Alert variant="info" title={t('Start workflow from Overview first.')} />;
  }

  if (timeline.isLoading) return <p className="text-sm text-text-muted">Loading workflow…</p>;

  if (!pickTimelineTask) {
    return <Alert variant="info" title={t('Start workflow from Overview first.')} />;
  }

  if (isCompletedTaskStatus(pickTimelineTask.status)) {
    return (
      <Alert variant="success" title={t('Pick completed')}>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
            {t('Print pick sheet')}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Combobox
        label={t('Drop-off location')}
        required
        value={packingDestinationId}
        onChange={setPackingDestinationId}
        options={(dropOffLookup.data?.items ?? [])
          .filter((l) => l.status !== 'blocked' && l.status !== 'archived')
          .map((l) => ({ value: l.id, label: l.fullPath, hint: l.barcode }))}
        placeholder="Select location…"
      />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2">{t('SKU')}</th>
              <th className="px-3 py-2">{t('Location')}</th>
              <th className="px-3 py-2 text-end">{t('Required')}</th>
              <th className="px-3 py-2">{t('Picked')}</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const ol = lineMeta.get(d.outboundOrderLineId);
              const loc = locationById.get(d.locationId);
              return (
                <tr key={d.rowKey} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{ol?.product?.sku ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{locationDisplay(loc).shortLabel}</td>
                  <td className="px-3 py-2 text-end font-mono">{d.requiredQty}</td>
                  <td className="px-3 py-2">
                    <TextField
                      label=""
                      type="number"
                      min={0}
                      step="0.0001"
                      value={d.pickedQty}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev.map((row) =>
                            row.rowKey === d.rowKey ? { ...row, pickedQty: e.target.value } : row,
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
