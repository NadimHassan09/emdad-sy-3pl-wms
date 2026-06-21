import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Location } from '../../../api/locations';
import { useResolvedLocations } from '../../../hooks/useResolvedLocations';
import { useTypedLocationLookup } from '../../../hooks/useTypedLocationLookup';
import { TaskDetailsCard } from '../../../components/tasks/TaskDetailsCard';
import type { OutboundOrder, OutboundOrderLine } from '../../../api/outbound';
import { TasksApi } from '../../../api/tasks';
import { WorkflowsApi } from '../../../api/workflows';
import { Button } from '../../../components/Button';
import { Combobox } from '../../../components/Combobox';
import { TextField } from '../../../components/TextField';
import { QK } from '../../../constants/query-keys';
import { TaskLinesFilterCard } from '../../../components/tasks/TaskLinesFilterCard';
import {
  DEFAULT_TASK_LINE_FILTERS,
  taskLineFiltersWithSearch,
} from '../../../lib/task-line-filters';
import type { TaskLineFilters } from '../../../lib/task-line-filters';
import { useTaskProgressSave } from '../../../hooks/useTaskProgressSave';
import { useToast } from '../../../components/ToastProvider';
import {
  displayWarehouseLabel,
  formatTaskDateOnly,
  outboundOrderTitle,
} from '../../../lib/task-details-helpers';
import { taskTypeIconClass } from '../../../lib/task-type-icons';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import {
  localizedDispatchDestinationLocationHint,
  localizedDispatchLineStatusFilterOptions,
  localizedDispatchSourceLocationHint,
  localizedTaskLineSearchPlaceholder,
  localizedTaskTypeTitle,
} from '../../../lib/ui-labels/task-execution';
import { dispatchLocationLabel, openDispatchPrintPdf } from './dispatch-print';
import { DispatchAddToShipmentModal } from './DispatchAddToShipmentModal';
import type { DispatchExecutionDraft, DispatchPackageDraft } from './dispatch-types';
import {
  buildDispatchCompletePayload,
  defaultPackages,
  filterDispatchLines,
  resolveDispatchDestinationFromQueue,
  findLocationById,
  findWorkflowTimelineTask,
  initialDispatchLines,
  readTaskExecutionState,
  locationDisplay,
  parseQty,
  readDispatchDraft,
  readDispatchPayloadSourceLocationId,
  readPackDraftPackages,
  readPickDraftPackingDestinationId,
  readPackDraftPackingStationId,
  resolveDispatchSourceLocationId,
  eligibleDispatchDockLocations,
} from './dispatch-utils';

type Props = {
  taskId: string;
  outbound: OutboundOrder | undefined;
  outboundOrderId?: string;
  lineIds: string[];
  requiresPacking: boolean;
  warehouseId: string;
  companyIdOverride?: string;
  assignedWorkerLabel: string;
  taskOperatorNotes?: string;
  showExportPdf?: boolean;
  taskStatus: string;
  executionState?: unknown;
  packExecutionState?: unknown;
  pickExecutionState?: unknown;
  taskPayload?: unknown;
  submit: (body: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
};

export function DispatchExecutionPanel({
  taskId,
  outbound,
  outboundOrderId,
  lineIds,
  requiresPacking,
  warehouseId,
  companyIdOverride,
  assignedWorkerLabel,
  taskOperatorNotes = '',
  showExportPdf = true,
  taskStatus,
  executionState,
  packExecutionState,
  pickExecutionState,
  taskPayload,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const savedDraft = readDispatchDraft(executionState);
  const packPackagesFromSibling = readPackDraftPackages(packExecutionState);

  const lineMeta = useMemo(() => {
    const m = new Map<string, OutboundOrderLine>();
    for (const ol of outbound?.lines ?? []) m.set(ol.id, ol);
    return m;
  }, [outbound?.lines]);

  const workflowTimelineQuery = useQuery({
    queryKey: QK.workflows.workflowTimelineByRef(outboundOrderId ?? ''),
    queryFn: () =>
      WorkflowsApi.getTimeline('outbound_order', outboundOrderId!, companyIdOverride),
    enabled: !!outboundOrderId,
  });

  const pickExecutionFromWorkflow = useMemo(() => {
    const pickTask = findWorkflowTimelineTask(workflowTimelineQuery.data?.tasks, 'pick');
    return readTaskExecutionState(pickTask);
  }, [workflowTimelineQuery.data?.tasks]);

  const packExecutionFromWorkflow = useMemo(() => {
    const packTask = findWorkflowTimelineTask(workflowTimelineQuery.data?.tasks, 'pack');
    return readTaskExecutionState(packTask);
  }, [workflowTimelineQuery.data?.tasks]);

  const effectivePickExecutionState = pickExecutionState ?? pickExecutionFromWorkflow;
  const effectivePackExecutionState = packExecutionState ?? packExecutionFromWorkflow;

  const packingLookup = useTypedLocationLookup(warehouseId, 'packing', !!warehouseId);
  const outputLookup = useTypedLocationLookup(warehouseId, 'output', !!warehouseId);
  const packingLocations = packingLookup.data?.items ?? [];
  const outputDocks = outputLookup.data?.items ?? [];

  const payloadSourceLocationId = readDispatchPayloadSourceLocationId(taskPayload);

  const systemSourceId = useMemo(
    () =>
      resolveDispatchSourceLocationId(
        requiresPacking,
        effectivePackExecutionState,
        effectivePickExecutionState,
        packingLocations,
        outputDocks,
        savedDraft?.sourceLocationId,
        payloadSourceLocationId,
      ),
    [
      requiresPacking,
      effectivePackExecutionState,
      effectivePickExecutionState,
      packingLocations,
      outputDocks,
      savedDraft?.sourceLocationId,
      payloadSourceLocationId,
    ],
  );

  const dispatchQueueQuery = useQuery({
    queryKey: [...QK.tasks.list({ warehouseId, taskType: 'dispatch', limit: '200' }), 'dock-queue'],
    queryFn: () => TasksApi.list({ warehouseId, taskType: 'dispatch', limit: '200' }, companyIdOverride),
    enabled: !!warehouseId,
  });

  const activeDispatchTaskIds = useMemo(() => {
    const items = dispatchQueueQuery.data?.items ?? [];
    return items
      .filter(
        (t) =>
          t.taskType === 'dispatch' &&
          t.status !== 'completed' &&
          t.status !== 'cancelled',
      )
      .map((t) => t.id);
  }, [dispatchQueueQuery.data?.items]);

  const systemDestinationId = useMemo(
    () =>
      resolveDispatchDestinationFromQueue(
        outputDocks,
        taskId,
        activeDispatchTaskIds,
        savedDraft?.destinationLocationId,
      ),
    [outputDocks, taskId, activeDispatchTaskIds, savedDraft?.destinationLocationId],
  );

  const [draft, setDraft] = useState<DispatchExecutionDraft>(() => ({
    sourceLocationId: savedDraft?.sourceLocationId ?? systemSourceId ?? '',
    destinationLocationId: savedDraft?.destinationLocationId ?? systemDestinationId ?? '',
    sourceVerified: true,
    destVerified: savedDraft?.destVerified ?? false,
    packages: defaultPackages(savedDraft?.packages ?? packPackagesFromSibling ?? undefined),
    lines: initialDispatchLines(lineIds, lineMeta, savedDraft?.lines),
    carrier: savedDraft?.carrier ?? outbound?.carrier ?? '',
    tracking: savedDraft?.tracking ?? outbound?.trackingNumber ?? '',
    driverName: savedDraft?.driverName ?? '',
    vehicleInfo: savedDraft?.vehicleInfo ?? '',
    dispatchNotes: savedDraft?.dispatchNotes ?? '',
  }));

  const [draftLineFilters, setDraftLineFilters] = useState<TaskLineFilters>(
    DEFAULT_TASK_LINE_FILTERS,
  );
  const [appliedLineFilters, setAppliedLineFilters] = useState<TaskLineFilters>(
    DEFAULT_TASK_LINE_FILTERS,
  );
  const [addModalOpen, setAddModalOpen] = useState(false);

  const patchDraft = useCallback((patch: Partial<DispatchExecutionDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchPackage = useCallback((pkgId: string, patch: Partial<DispatchPackageDraft>) => {
    setDraft((prev) => ({
      ...prev,
      packages: prev.packages.map((p) => (p.id === pkgId ? { ...p, ...patch } : p)),
    }));
  }, []);

  const patchLine = useCallback((lineId: string, patch: Partial<(typeof draft.lines)[0]>) => {
    setDraft((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.outboundOrderLineId === lineId ? { ...l, ...patch } : l)),
    }));
  }, []);

  useEffect(() => {
    if (!systemSourceId) return;
    setDraft((prev) => {
      if (prev.sourceLocationId === systemSourceId && prev.sourceVerified) return prev;
      return {
        ...prev,
        sourceLocationId: systemSourceId,
        sourceVerified: true,
      };
    });
  }, [systemSourceId]);

  useEffect(() => {
    if (!systemDestinationId) return;
    setDraft((prev) => {
      if (prev.destinationLocationId === systemDestinationId && prev.destVerified) return prev;
      return {
        ...prev,
        destinationLocationId: systemDestinationId,
        destVerified: true,
      };
    });
  }, [systemDestinationId]);

  const effectiveSourceId = systemSourceId ?? draft.sourceLocationId;
  const effectiveDestId = systemDestinationId ?? draft.destinationLocationId;

  const resolvedIds = useMemo(() => {
    const ids = [
      effectiveSourceId,
      effectiveDestId,
      readPickDraftPackingDestinationId(effectivePickExecutionState),
      readPackDraftPackingStationId(effectivePackExecutionState),
    ];
    return ids.filter((id): id is string => !!id?.trim());
  }, [effectiveSourceId, effectiveDestId, effectivePickExecutionState, effectivePackExecutionState]);

  const { locationById } = useResolvedLocations(resolvedIds);
  const sourceLoc = findLocationById(locationById, effectiveSourceId);
  const destLoc = findLocationById(locationById, effectiveDestId);

  const filteredDispatchLines = useMemo(
    () => filterDispatchLines(draft.lines, appliedLineFilters, lineMeta),
    [draft.lines, appliedLineFilters, lineMeta],
  );

  const lineFiltersCard = (
    <TaskLinesFilterCard
      draft={draftLineFilters}
      onDraftChange={setDraftLineFilters}
      onApply={() => setAppliedLineFilters({ ...draftLineFilters })}
      onReset={() => {
        setDraftLineFilters(DEFAULT_TASK_LINE_FILTERS);
        setAppliedLineFilters(DEFAULT_TASK_LINE_FILTERS);
      }}
      resultCount={filteredDispatchLines.length}
      totalCount={draft.lines.length}
      statusOptions={localizedDispatchLineStatusFilterOptions(t)}
      searchPlaceholder={localizedTaskLineSearchPlaceholder(t)}
      onBarcodeScan={(code) => {
        const next = taskLineFiltersWithSearch(draftLineFilters, code);
        setDraftLineFilters(next);
        setAppliedLineFilters(next);
      }}
    />
  );

  const saveProgress = useTaskProgressSave({
    taskId,
    warehouseId,
    outboundOrderId,
    companyIdOverride,
  });

  useEffect(() => {
    const server = readDispatchDraft(executionState);
    if (!server) return;
    setDraft((prev) => ({
      ...prev,
      sourceLocationId: server.sourceLocationId || prev.sourceLocationId,
      destinationLocationId: server.destinationLocationId || prev.destinationLocationId,
      carrier: server.carrier || prev.carrier,
      tracking: server.tracking || prev.tracking,
    }));
  }, [executionState]);

  const addProductToShipment = useCallback(
    (lineId: string, qty: number): boolean => {
      const line = draft.lines.find((l) => l.outboundOrderLineId === lineId);
      if (!line) return false;
      const picked = parseQty(line.pickedQty);
      const current = parseQty(line.shipQty);
      const next = Math.min(picked, current + qty);
      if (qty <= 0) {
        toast.error(t(['Enter a positive quantity.', 'أدخل كمية موجبة.']));
        return false;
      }
      if (next <= current) {
        toast.error(t([`Cannot ship more than picked (${picked}).`, `لا يمكن شحن أكثر من المُلتقط (${picked}).`]));
        return false;
      }
      patchLine(lineId, { shipQty: String(next), verified: true });
      toast.success(t(['Product added to shipment', 'أُضيف المنتج إلى الشحنة']));
      return true;
    },
    [draft.lines, patchLine, toast],
  );

  const addPackageToShipment = useCallback(
    (pkgId: string): boolean => {
      const pkg = draft.packages.find((p) => p.id === pkgId);
      if (!pkg) return false;
      if (pkg.scanned) {
        toast.error(t(['Package already loaded.', 'الطرد محمّل مسبقاً.']));
        return false;
      }
      patchPackage(pkgId, { scanned: true, ready: true });
      toast.success(t([`Package ${pkg.label} loaded`, `تم تحميل الطرد ${pkg.label}`]));
      return true;
    },
    [draft.packages, patchPackage, toast],
  );

  function completeBlockers(): string[] {
    const issues: string[] = [];
    const sourceId = effectiveSourceId ?? draft.sourceLocationId;
    const destId = effectiveDestId ?? draft.destinationLocationId;
    if (!sourceId) {
      issues.push(
        requiresPacking
          ? t([
              'Source packing location is not available from pack/pick tasks yet.',
              'موقع التغليف المصدر غير متاح من مهام التغليف/التقاط بعد.',
            ])
          : t([
              'Source delivery location is not available from the pick task yet.',
              'موقع التسليم المصدر غير متاح من مهمة التقاط بعد.',
            ]),
      );
    }
    if (!destId) {
      issues.push(
        t([
          'Dispatch dock is not available from the location queue yet.',
          'رصيف الإرسال غير متاح من طابور المواقع بعد.',
        ]),
      );
    }
    for (const l of draft.lines) {
      const picked = parseQty(l.pickedQty);
      const ship = parseQty(l.shipQty);
      if (ship > picked + 1e-6) {
        issues.push(
          t([
            'Ship quantity cannot exceed picked quantity.',
            'لا يمكن أن تتجاوز كمية الشحن الكمية المُلتقطة.',
          ]),
        );
      }
      if (ship > 0 && !l.verified) {
        issues.push(
          t([
            'Verify all shipment lines with quantity before dispatch.',
            'تحقق من كل أسطر الشحنة ذات الكمية قبل الإرسال.',
          ]),
        );
      }
    }
    const hasShipment =
      draft.lines.some((l) => l.verified && parseQty(l.shipQty) > 0) ||
      draft.packages.some((p) => p.scanned);
    if (!hasShipment) {
      issues.push(
        t([
          'Add at least one product or package to the shipment.',
          'أضف منتجاً واحداً أو طرداً واحداً على الأقل إلى الشحنة.',
        ]),
      );
    }
    return [...new Set(issues)];
  }

  function handleComplete(e: FormEvent) {
    e.preventDefault();
    const issues = completeBlockers();
    if (issues.length > 0) {
      toast.error(issues[0] ?? t(['Complete dispatch checks before finishing.', 'أكمل فحوصات الإرسال قبل الإنهاء.']));
      return;
    }
    submit(buildDispatchCompletePayload(draft.lines, draft.carrier, draft.tracking), e);
  }

  const dispatchDetailsCard = (
    <TaskDetailsCard
      taskTypeLabel={localizedTaskTypeTitle('dispatch', t)}
      iconClass={taskTypeIconClass('dispatch')}
      primaryTitle={outboundOrderTitle(
        outbound?.orderNumber,
        outboundOrderId ? `/orders/outbound/${outboundOrderId}` : undefined,
        t(['Dispatch task', 'مهمة الإرسال']),
      )}
      subtitle={outbound?.company?.name ?? '—'}
      status={taskStatus}
      fields={[
        {
          iconClass: 'fa-solid fa-building',
          label: t(['Client', 'العميل']),
          value: outbound?.company?.name ?? '—',
        },
        {
          iconClass: 'fa-solid fa-user',
          label: t(['Dispatcher', 'مُرسِل']),
          value: assignedWorkerLabel,
        },
        {
          iconClass: 'fa-solid fa-truck',
          label: t(['Carrier', 'الناقل']),
          value: (draft.carrier || outbound?.carrier)?.trim() || '—',
        },
        {
          iconClass: 'fa-solid fa-calendar',
          label: t(['Ship by', 'الشحن قبل']),
          value: formatTaskDateOnly(outbound?.requiredShipDate),
        },
        {
          iconClass: 'fa-solid fa-warehouse',
          label: t(['Warehouse', 'المستودع']),
          value: displayWarehouseLabel(warehouseId),
        },
      ]}
      summary={outbound?.destinationAddress?.trim() || undefined}
      summaryTitle={t(['Ship to', 'الشحن إلى'])}
    />
  );

  const handleExportPrint = () => {
    if (draft.lines.length === 0) {
      toast.error(t(['No lines to export.', 'لا توجد أسطر للتصدير.']));
      return;
    }
    const ok = openDispatchPrintPdf({
      orderNumber: outbound?.orderNumber ?? outboundOrderId ?? '—',
      companyName: outbound?.company?.name ?? '—',
      assignedWorker: assignedWorkerLabel,
      sourceLocation: dispatchLocationLabel(sourceLoc),
      destinationLocation: dispatchLocationLabel(destLoc),
      carrier: draft.carrier,
      tracking: draft.tracking,
      driverName: draft.driverName,
      vehicleInfo: draft.vehicleInfo,
      operatorNotes: taskOperatorNotes,
      dispatchNotes: draft.dispatchNotes,
      lines: draft.lines,
      lineMeta,
      draft,
    });
    if (!ok) toast.error(t(['Allow pop-ups to print or save as PDF.', 'اسمح بالنوافذ المنبثقة للطباعة أو حفظ PDF.']));
  };

  if (readOnly) {
    return (
      <div className="space-y-4">
        {dispatchDetailsCard}
        <MovementHero
          requiresPacking={requiresPacking}
          sourceLoc={sourceLoc}
          destLoc={destLoc}
          sourceHint={localizedDispatchSourceLocationHint(requiresPacking, t)}
          destHint={localizedDispatchDestinationLocationHint(t)}
        />
        {showExportPdf ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={draft.lines.length === 0}
              onClick={handleExportPrint}
            >
              {t(['Export PDF', 'تصدير PDF'])}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      {dispatchDetailsCard}

      <MovementHero
        requiresPacking={requiresPacking}
        sourceLoc={sourceLoc}
        destLoc={destLoc}
        sourceHint={localizedDispatchSourceLocationHint(requiresPacking, t)}
        destHint={localizedDispatchDestinationLocationHint(t)}
      />

      {!effectiveSourceId && (requiresPacking ? packingLocations : outputDocks).length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm font-semibold text-amber-950">
            {requiresPacking
              ? t(['Select packing source', 'اختر موقع التغليف المصدر'])
              : t(['Select delivery source', 'اختر موقع التسليم المصدر'])}
          </p>
          <div className="mt-2">
            <Combobox
              value={draft.sourceLocationId}
              onChange={(id) => patchDraft({ sourceLocationId: id, sourceVerified: true })}
              options={(requiresPacking ? packingLocations : outputDocks)
                .filter((l) => l.status !== 'blocked' && l.status !== 'archived')
                .map((l) => ({
                  value: l.id,
                  label: l.fullPath,
                  hint: l.barcode,
                }))}
              placeholder={
                requiresPacking
                  ? t(['Packing location…', 'موقع التغليف…'])
                  : t(['Delivery area…', 'منطقة التسليم…'])
              }
              emptyMessage={t(['No locations match.', 'لا مواقع مطابقة.'])}
            />
          </div>
        </section>
      ) : null}

      {!effectiveDestId && eligibleDispatchDockLocations(outputDocks).length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm font-semibold text-amber-950">
            {t(['Select dispatch dock', 'اختر رصيف الإرسال'])}
          </p>
          <div className="mt-2">
            <Combobox
              value={draft.destinationLocationId}
              onChange={(id) => patchDraft({ destinationLocationId: id, destVerified: true })}
              options={eligibleDispatchDockLocations(outputDocks).map((l) => ({
                value: l.id,
                label: l.fullPath,
                hint: l.barcode,
              }))}
              placeholder={t(['Shipping dock…', 'رصيف الشحن…'])}
              emptyMessage={t(['No docks match.', 'لا أرصفة مطابقة.'])}
            />
          </div>
        </section>
      ) : null}

      {lineFiltersCard}

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">
            {t(['Shipment verification', 'التحقق من الشحنة'])}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="brand" onClick={() => setAddModalOpen(true)}>
              {t(['Add', 'إضافة'])}
            </Button>
            {showExportPdf ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={draft.lines.length === 0}
                onClick={handleExportPrint}
              >
                {t(['Export PDF', 'تصدير PDF'])}
              </Button>
            ) : null}
          </div>
        </div>
        {draft.packages.some((p) => p.scanned) ? (
          <p className="mt-2 text-xs text-emerald-700">
            {t([
              `${draft.packages.filter((p) => p.scanned).length} of ${draft.packages.length} package(s) loaded`,
              `تم تحميل ${draft.packages.filter((p) => p.scanned).length} من ${draft.packages.length} طرد`,
            ])}
          </p>
        ) : null}
        {filteredDispatchLines.length === 0 && draft.lines.length > 0 ? (
          <p className="mt-3 text-center text-sm text-slate-500">
            {t(['No lines match the current filters.', 'لا أسطر تطابق الفلاتر الحالية.'])}
          </p>
        ) : null}
        <div className="-mx-1 mt-3 overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-3 py-2">{t(['Product', 'المنتج'])}</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">{t(['Picked', 'مُلتقط'])}</th>
                <th className="px-3 py-2">{t(['Ship', 'شحن'])}</th>
                <th className="px-3 py-2">{t(['Verify', 'تحقق'])}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatchLines.map((l) => {
                const ol = lineMeta.get(l.outboundOrderLineId);
                return (
                  <tr key={l.outboundOrderLineId} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-xs font-medium">{ol?.product?.name ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.pickedQty}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                        value={l.shipQty}
                        onChange={(e) => patchLine(l.outboundOrderLineId, { shipQty: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={l.verified}
                        onChange={(e) =>
                          patchLine(l.outboundOrderLineId, { verified: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">{t(['Carrier handoff', 'تسليم الناقل'])}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label={t(['Carrier', 'الناقل'])} value={draft.carrier} onChange={(e) => patchDraft({ carrier: e.target.value })} />
          <TextField
            label={t(['Tracking Number', 'رقم التتبع'])}
            value={draft.tracking}
            onChange={(e) => patchDraft({ tracking: e.target.value })}
          />
          <TextField
            label={t(['Driver (optional)', 'السائق (اختياري)'])}
            value={draft.driverName}
            onChange={(e) => patchDraft({ driverName: e.target.value })}
          />
          <TextField
            label={t(['Vehicle (optional)', 'المركبة (اختياري)'])}
            value={draft.vehicleInfo}
            onChange={(e) => patchDraft({ vehicleInfo: e.target.value })}
          />
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-600">
          {t(['Dispatch notes', 'ملاحظات الإرسال'])}
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-300 p-2 text-sm"
            value={draft.dispatchNotes}
            onChange={(e) => patchDraft({ dispatchNotes: e.target.value })}
          />
        </label>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            loading={saveProgress.isPending}
            onClick={() => saveProgress.mutate({ dispatch_draft: draft })}
          >
            {t(['Save progress', 'حفظ التقدم'])}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            onClick={() => {
              const w = window.open('', '_blank');
              if (!w) {
                toast.error(t(['Allow pop-ups to print', 'اسمح بالنوافذ المنبثقة للطباعة']));
                return;
              }
              w.document.write(
                `<html><body style="font-family:system-ui;padding:16px"><h1>Dispatch ${outbound?.orderNumber ?? ''}</h1><p>Carrier: ${draft.carrier}</p><p>Tracking: ${draft.tracking}</p></body></html>`,
              );
              w.document.close();
              w.print();
            }}
          >
            {t(['Print documents', 'طباعة المستندات'])}
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            {t(['Complete dispatch', 'إكمال الإرسال'])}
          </Button>
        </div>
      </div>

      <DispatchAddToShipmentModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        lineIds={lineIds}
        lines={draft.lines}
        lineMeta={lineMeta}
        packages={draft.packages}
        onAddProduct={addProductToShipment}
        onAddPackage={addPackageToShipment}
      />
    </form>
  );
}

function MovementHero({
  requiresPacking,
  sourceLoc,
  destLoc,
  sourceHint,
  destHint,
}: {
  requiresPacking: boolean;
  sourceLoc?: Location;
  destLoc?: Location;
  sourceHint: string;
  destHint: string;
}) {
  const { t } = useWmsTranslation();
  const src = sourceLoc ? locationDisplay(sourceLoc) : null;
  const dst = destLoc ? locationDisplay(destLoc) : null;
  const sourceTitle = requiresPacking
    ? t(['Source · Packing', 'المصدر · تغليف'])
    : t(['Source · Delivery area', 'المصدر · منطقة التسليم']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-emerald-50 p-4 shadow-sm">
      <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {t(['Movement path', 'مسار الحركة'])}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-xl border border-violet-200 bg-white p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-violet-800">{sourceTitle}</p>
          {src ? (
            <>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{src.shortLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{src.fullPath}</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {t(['To be selected by the system', 'سيُختار تلقائياً من النظام'])}
              </p>
              <p className="mt-2 text-[10px] text-slate-500">{sourceHint}</p>
            </>
          )}
        </div>
        <div className="hidden text-3xl text-emerald-600 sm:block" aria-hidden>
          →
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-emerald-800">
            {t(['Destination · Dispatch', 'الوجهة · إرسال'])}
          </p>
          {dst ? (
            <>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{dst.shortLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{dst.fullPath}</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {t(['To be selected by the system', 'سيُختار تلقائياً من النظام'])}
              </p>
              <p className="mt-2 text-[10px] text-slate-500">{destHint}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
