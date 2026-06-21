import { useQueries } from '@tanstack/react-query';
import { useTaskMutationCacheRefresh, useTaskProgressSave } from '../../../hooks/useTaskProgressSave';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Location, LocationType } from '../../../api/locations';
import { Column, DataTable } from '../../../components/DataTable';
import { useResolvedLocations } from '../../../hooks/useResolvedLocations';
import { useTypedLocationLookup } from '../../../hooks/useTypedLocationLookup';
import { resolveLocationByScan } from '../../../lib/location-resolve';
import { TaskDetailsCard } from '../../../components/tasks/TaskDetailsCard';
import type { OutboundOrder, OutboundOrderLine } from '../../../api/outbound';
import { ProductsApi } from '../../../api/products';
import { TasksApi } from '../../../api/tasks';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Combobox } from '../../../components/Combobox';
import { PickLinesFilterCard } from './PickLinesFilterCard';
import { useToast } from '../../../components/ToastProvider';
import { locationTypeLabel } from '../../../lib/location-types';
import {
  displayWarehouseLabel,
  formatTaskDateOnly,
  formatTaskDateTime,
  outboundOrderTitle,
} from '../../../lib/task-details-helpers';
import { taskTypeIconClass } from '../../../lib/task-type-icons';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import { localizedPickLineStatus, localizedTaskTypeTitle } from '../../../lib/ui-labels/task-execution';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { openPickPrintPdf } from './pick-print';
import type { PickExecutionDraft, PickLineDraft, PickReservationRow } from './pick-types';
import {
  buildPickCompletePayload,
  computePickLineStatus,
  computePickSummary,
  DEFAULT_PICK_LINE_FILTERS,
  filterPickDrafts,
  initialPickDrafts,
  pickLineFiltersAfterScan,
  locationDisplay,
  parseQty,
  pickLineStatusClass,
  sortDraftsByLocationPath,
  type PickLineFilters,
} from './pick-utils';

function readPickDraft(raw: unknown): PickExecutionDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const d = r.pick_draft ?? r.pickDraft;
  if (!d || typeof d !== 'object') return null;
  return d as PickExecutionDraft;
}

type Props = {
  taskId: string;
  reservations: PickReservationRow[];
  outbound: OutboundOrder | undefined;
  outboundOrderId?: string;
  requiresPacking: boolean;
  warehouseId: string;
  companyIdOverride?: string;
  assignedWorkerLabel: string;
  taskOperatorNotes?: string;
  showExportPdf?: boolean;
  taskStatus: string;
  executionState?: unknown;
  submit: (body: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
};

export function PickExecutionPanel({
  taskId,
  reservations,
  outbound,
  outboundOrderId,
  requiresPacking,
  warehouseId,
  companyIdOverride,
  assignedWorkerLabel,
  taskOperatorNotes = '',
  showExportPdf = true,
  taskStatus,
  executionState,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const savedDraft = readPickDraft(executionState);

  const reservationsFingerprint = useMemo(
    () =>
      reservations
        .map((r) => `${r.outboundOrderLineId}\u001f${r.locationId}\u001f${r.lotId ?? ''}\u001f${r.quantity}`)
        .join('\u001e'),
    [reservations],
  );

  const [drafts, setDrafts] = useState<PickLineDraft[]>(() =>
    initialPickDrafts(reservations, savedDraft?.lines),
  );
  const [packingScanOpen, setPackingScanOpen] = useState(false);
  const [draftLineFilters, setDraftLineFilters] = useState<PickLineFilters>(
    DEFAULT_PICK_LINE_FILTERS,
  );
  const [appliedLineFilters, setAppliedLineFilters] = useState<PickLineFilters>(
    DEFAULT_PICK_LINE_FILTERS,
  );
  const [packingDestinationId, setPackingDestinationId] = useState(savedDraft?.packingDestinationId ?? '');
  const [packingBarcodeDraft, setPackingBarcodeDraft] = useState('');

  const reservationLocationIds = useMemo(
    () => [...new Set(reservations.map((r) => r.locationId))],
    [reservations],
  );

  const { locationById } = useResolvedLocations([
    ...reservationLocationIds,
    packingDestinationId,
  ]);

  const dropOffType: LocationType = requiresPacking ? 'packing' : 'output';
  const dropOffLookup = useTypedLocationLookup(warehouseId, dropOffType, !!warehouseId);
  const dropOffLocations = useMemo(() => {
    const items = dropOffLookup.data?.items ?? [];
    return items.filter((l) => l.status !== 'blocked' && l.status !== 'archived');
  }, [dropOffLookup.data?.items]);

  useEffect(() => {
    if (packingDestinationId.trim() || dropOffLocations.length !== 1) return;
    setPackingDestinationId(dropOffLocations[0]!.id);
  }, [dropOffLocations, packingDestinationId]);

  const skipReservationReset = useRef(true);
  useEffect(() => {
    if (skipReservationReset.current) {
      skipReservationReset.current = false;
      return;
    }
    setDrafts(
      sortDraftsByLocationPath(
        initialPickDrafts(reservations, savedDraft?.lines),
        locationById,
      ),
    );
  }, [reservationsFingerprint, locationById]);

  useEffect(() => {
    if (locationById.size === 0) return;
    setDrafts((prev) => sortDraftsByLocationPath(prev, locationById));
  }, [locationById]);

  const lineMeta = useMemo(() => {
    const m = new Map<string, OutboundOrderLine>();
    for (const ol of outbound?.lines ?? []) m.set(ol.id, ol);
    return m;
  }, [outbound?.lines]);

  const productIdsForLots = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const r of reservations) {
      if (!seen.has(r.productId)) {
        seen.add(r.productId);
        ids.push(r.productId);
      }
    }
    return ids;
  }, [reservations]);

  const lotsQueries = useQueries({
    queries: productIdsForLots.map((productId) => ({
      queryKey: ['products', productId, 'lots', 'pick-exec'] as const,
      queryFn: () => ProductsApi.listLots(productId),
      enabled: productIdsForLots.length > 0,
    })),
  });

  const lotNumberById = useMemo(() => {
    const m = new Map<string, string>();
    productIdsForLots.forEach((_, i) => {
      for (const lot of lotsQueries[i]?.data ?? []) m.set(lot.id, lot.lotNumber);
    });
    return m;
  }, [productIdsForLots, lotsQueries]);

  const summary = useMemo(() => computePickSummary(reservations, drafts), [reservations, drafts]);

  const filteredDrafts = useMemo(
    () =>
      filterPickDrafts(drafts, appliedLineFilters, lineMeta, locationById, lotNumberById),
    [drafts, appliedLineFilters, lineMeta, locationById, lotNumberById],
  );

  const lineFiltersCard = (
    <PickLinesFilterCard
      draft={draftLineFilters}
      onDraftChange={setDraftLineFilters}
      onApply={() => setAppliedLineFilters({ ...draftLineFilters })}
      onReset={() => {
        setDraftLineFilters(DEFAULT_PICK_LINE_FILTERS);
        setAppliedLineFilters(DEFAULT_PICK_LINE_FILTERS);
      }}
      onScanApply={(field, code) => {
        void (async () => {
          if (field === 'location') {
            const hit = await resolveLocationByScan(warehouseId, code);
            const next = pickLineFiltersAfterScan(
              draftLineFilters,
              field,
              code,
              hit?.fullPath,
            );
            setDraftLineFilters(next);
            setAppliedLineFilters(next);
          } else {
            const next = pickLineFiltersAfterScan(draftLineFilters, field, code);
            setDraftLineFilters(next);
            setAppliedLineFilters(next);
          }
        })();
      }}
      resultCount={filteredDrafts.length}
      totalCount={drafts.length}
    />
  );

  const nextIncompleteIndex = useMemo(() => {
    const idx = drafts.findIndex((d) => computePickLineStatus(d) !== 'complete');
    return idx >= 0 ? idx : drafts.length - 1;
  }, [drafts]);

  const nextLocDraft = drafts[nextIncompleteIndex];
  const nextLoc = nextLocDraft
    ? locationById.get(nextLocDraft.locationId)
    : undefined;

  const patchDraft = useCallback((rowKey: string, patch: Partial<PickLineDraft>) => {
    setDrafts((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  }, []);

  const saveProgress = useTaskProgressSave({
    taskId,
    warehouseId,
    outboundOrderId,
    companyIdOverride,
  });

  const { refreshFromEnvelope, showError: showCacheError } = useTaskMutationCacheRefresh({
    taskId,
    warehouseId,
    outboundOrderId,
    companyIdOverride,
  });

  const applyPackingBarcode = (raw: string) => {
    void (async () => {
      const code = raw.trim();
      if (!code) {
        toast.error(
          requiresPacking
            ? t(['Enter or scan a packing location barcode.', 'أدخل أو امسح Barcode موقع التغليف.'])
            : t(['Enter or scan a delivery area barcode.', 'أدخل أو امسح Barcode منطقة التسليم.']),
        );
        return;
      }
      const hit = await resolveLocationByScan(warehouseId, code, {
        types: [dropOffType],
      });
      if (!hit) {
        toast.error(
          requiresPacking
            ? t(['No packing location matches this barcode.', 'لا يوجد موقع تغليف يطابق هذا Barcode.'])
            : t(['No delivery area location matches this barcode.', 'لا يوجد موقع تسليم يطابق هذا Barcode.']),
        );
        return;
      }
      setPackingDestinationId(hit.id);
      setPackingBarcodeDraft('');
      toast.success(
        requiresPacking
          ? t([`Packing staging: ${hit.fullPath}`, `تجهيز التغليف: ${hit.fullPath}`])
          : t([`Delivery area: ${hit.fullPath}`, `منطقة التسليم: ${hit.fullPath}`]),
      );
    })();
  };

  const packingComboOptions = dropOffLocations.map((loc) => ({
    value: loc.id,
    label: loc.fullPath,
    hint: `${locationTypeLabel(loc.type)} · ${loc.barcode}`,
  }));

  const dropOffLoc = dropOffLocations.find((l) => l.id === packingDestinationId);

  const handleExportPrint = () => {
    if (drafts.length === 0) {
      toast.error(t(['No lines to export.', 'لا توجد أسطر للتصدير.']));
      return;
    }
    const ok = openPickPrintPdf({
      orderNumber: outbound?.orderNumber ?? outboundOrderId ?? '—',
      companyName: outbound?.company?.name ?? '—',
      assignedWorker: assignedWorkerLabel,
      dropOffLabel: requiresPacking ? 'Drop-off (packing)' : 'Drop-off (delivery area)',
      dropOffLocation: dropOffLoc
        ? `${dropOffLoc.fullPath}${dropOffLoc.barcode ? ` · ${dropOffLoc.barcode}` : ''}`
        : '—',
      shipBy: formatTaskDateOnly(outbound?.requiredShipDate),
      operatorNotes: taskOperatorNotes,
      drafts,
      lineMeta,
      locationById,
      lotNumberById,
    });
    if (!ok) toast.error(t(['Allow pop-ups to print or save as PDF.', 'اسمح بالنوافذ المنبثقة للطباعة أو حفظ PDF.']));
  };

  async function handleComplete(e: FormEvent) {
    e.preventDefault();
    const hasShort = drafts.some((d) => computePickLineStatus(d) === 'short');
    if (hasShort) {
      toast.error(t(['Resolve short picks before completing.', 'عالج نقص التقاط قبل الإكمال.']));
      return;
    }
    if (!reservations.length) {
      toast.error(t(['No pick reservations on this task.', 'لا توجد حجوزات تقاط لهذه المهمة.']));
      return;
    }
    const dropOffId = packingDestinationId.trim();
    if (!dropOffId) {
      toast.error(
        requiresPacking
          ? t([
              'Select a packing drop-off location before completing.',
              'اختر موقع تسليم التغليف قبل الإكمال.',
            ])
          : t([
              'Select a delivery area before completing.',
              'اختر منطقة التسليم قبل الإكمال.',
            ]),
      );
      return;
    }
    try {
      const env = await TasksApi.patchProgress(
        taskId,
        {
          pick_draft: {
            lines: drafts,
            packingDestinationId: dropOffId,
          } satisfies PickExecutionDraft,
        },
        companyIdOverride,
      );
      refreshFromEnvelope(env);
    } catch (err) {
      showCacheError(
        err instanceof Error
          ? err
          : new Error(t(['Could not save drop-off location.', 'تعذّر حفظ موقع التسليم.'])),
      );
      return;
    }
    submit(buildPickCompletePayload(reservations), e);
  }

  const pickDetailsCard = (
    <TaskDetailsCard
      taskTypeLabel={localizedTaskTypeTitle('pick', t)}
      iconClass={taskTypeIconClass('pick')}
      primaryTitle={outboundOrderTitle(
        outbound?.orderNumber,
        outboundOrderId ? `/orders/outbound/${outboundOrderId}` : undefined,
        t(['Pick task', 'مهمة التقاط']),
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
          label: t(['Picker', 'المُلتقط']),
          value: assignedWorkerLabel,
        },
        {
          iconClass: 'fa-solid fa-truck',
          label: t(['Carrier', 'الناقل']),
          value: outbound?.carrier?.trim() || '—',
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
      summary={
        outbound?.createdAt
          ? t([
              `Order created ${formatTaskDateTime(outbound.createdAt)}`,
              `تاريخ إنشاء الطلب ${formatTaskDateTime(outbound.createdAt)}`,
            ])
          : undefined
      }
      summaryTitle={t(['Order context', 'سياق الطلب'])}
    />
  );

  if (readOnly) {
    if (!reservations.length) {
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t([
            'No pick reservation snapshot is available for this task.',
            'لا توجد لقطة حجز تقاط متاحة لهذه المهمة.',
          ])}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {pickDetailsCard}
        <SummaryCards summary={summary} />
        {lineFiltersCard}
        {showExportPdf && !isMdUp ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={drafts.length === 0}
              onClick={handleExportPrint}
            >
              {t(['Export PDF', 'تصدير PDF'])}
            </Button>
          </div>
        ) : null}
        <PickLinesTable
          drafts={filteredDrafts}
          totalLineCount={drafts.length}
          lineMeta={lineMeta}
          locationById={locationById}
          lotNumberById={lotNumberById}
          onExportPrint={showExportPdf ? handleExportPrint : undefined}
          readOnly
        />
      </div>
    );
  }

  if (!reservations.length) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        {t([
          'No pick reservations yet. Start the task to allocate inventory (FEFO/FIFO).',
          'لا توجد حجوزات تقاط بعد. ابدأ المهمة لتخصيص المخزون (FEFO/FIFO).',
        ])}
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      {pickDetailsCard}

      {nextLoc && computePickLineStatus(drafts[nextIncompleteIndex]!) !== 'complete' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            {t(['Next bin', 'Bin التالي'])}
          </p>
          <p className="font-mono text-2xl font-bold text-slate-900">{locationDisplay(nextLoc).shortLabel}</p>
          <p className="text-xs text-slate-600">{locationDisplay(nextLoc).fullPath}</p>
        </div>
      ) : null}

      <SummaryCards summary={summary} />

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {requiresPacking
            ? t(['Drop-off (packing)', 'تسليم (تغليف)'])
            : t(['Drop-off (delivery area)', 'تسليم (منطقة التسليم)'])}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {requiresPacking
            ? t([
                'Where picked units are consolidated before the pack task.',
                'حيث تُجمَّع الوحدات المُلتقطة قبل مهمة التغليف.',
              ])
            : t([
                'Where picked units are staged for dispatch (no pack step).',
                'حيث تُجهَّز الوحدات المُلتقطة للإرسال (بدون تغليف).',
              ])}
        </p>
        {dropOffLocations.length === 0 ? (
          <p className="mt-2 text-xs text-amber-800">
            {requiresPacking
              ? t(['No packing locations in this warehouse.', 'لا توجد مواقع تغليف في هذا المستودع.'])
              : t([
                  'No delivery area (output) locations in this warehouse.',
                  'لا توجد مواقع تسليم (مخرج) في هذا المستودع.',
                ])}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <Combobox
              value={packingDestinationId}
              onChange={setPackingDestinationId}
              options={packingComboOptions}
              placeholder={
                requiresPacking
                  ? t(['Select packing location…', 'اختر موقع التغليف…'])
                  : t(['Select delivery area…', 'اختر منطقة التسليم…'])
              }
              emptyMessage={
                requiresPacking
                  ? t(['No packing locations', 'لا مواقع تغليف'])
                  : t(['No delivery areas', 'لا مناطق تسليم'])
              }
            />
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                placeholder={
                  requiresPacking
                    ? t(['Packing location Barcode', 'Barcode موقع التغليف'])
                    : t(['Delivery area Barcode', 'Barcode منطقة التسليم'])
                }
                value={packingBarcodeDraft}
                onChange={(e) => setPackingBarcodeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPackingBarcode(packingBarcodeDraft);
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={() => applyPackingBarcode(packingBarcodeDraft)}>
                {t(['Apply', 'تطبيق'])}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPackingScanOpen(true)}>
                {t(['Scan', 'مسح'])}
              </Button>
            </div>
          </div>
        )}
      </div>

      {lineFiltersCard}

      {showExportPdf && !isMdUp ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={drafts.length === 0}
            onClick={handleExportPrint}
          >
            {t(['Export PDF', 'تصدير PDF'])}
          </Button>
        </div>
      ) : null}

      <PickLinesTable
        drafts={filteredDrafts}
        totalLineCount={drafts.length}
        lineMeta={lineMeta}
        locationById={locationById}
        lotNumberById={lotNumberById}
        onExportPrint={showExportPdf ? handleExportPrint : undefined}
        onPatch={patchDraft}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            loading={saveProgress.isPending}
            onClick={() =>
              saveProgress.mutate({
                pick_draft: {
                  lines: drafts,
                  packingDestinationId: packingDestinationId || undefined,
                } satisfies PickExecutionDraft,
              })
            }
          >
            {t(['Save progress', 'حفظ التقدم'])}
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            {t(['Complete picking', 'إكمال التقاط'])}
          </Button>
        </div>
      </div>

      <BarcodeScanModal
        open={packingScanOpen}
        onClose={() => setPackingScanOpen(false)}
        onScan={(text) => {
          applyPackingBarcode(text);
          setPackingScanOpen(false);
        }}
      />
    </form>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof computePickSummary> }) {
  const { t } = useWmsTranslation();
  const cards = [
    { label: 'SKU', value: String(summary.totalSkus) },
    { label: t(['Units', 'وحدات']), value: String(summary.totalUnits) },
    { label: t(['Done', 'منجز']), value: String(summary.completedPicks), accent: true },
    { label: t(['Remaining', 'المتبقي']), value: String(summary.remainingPicks) },
    { label: t(['Bins', 'Bins']), value: String(summary.uniqueLocations) },
    { label: t(['Complete', 'مكتمل']), value: `${summary.completionPct}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border p-3 ${c.accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white'}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
          <p className={`mt-1 text-lg font-semibold ${c.accent ? 'text-emerald-800' : 'text-slate-900'}`}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PickLinesTable({
  drafts,
  totalLineCount,
  lineMeta,
  locationById,
  lotNumberById,
  readOnly,
  onExportPrint,
  onPatch,
}: {
  drafts: PickLineDraft[];
  totalLineCount: number;
  lineMeta: Map<string, OutboundOrderLine>;
  locationById: Map<string, Location>;
  lotNumberById: Map<string, string>;
  readOnly?: boolean;
  onExportPrint?: () => void;
  onPatch?: (rowKey: string, patch: Partial<PickLineDraft>) => void;
}) {
  const { t } = useWmsTranslation();
  const columns: Column<PickLineDraft>[] = [
    {
      header: 'SKU',
      accessor: (d) => {
        const ol = lineMeta.get(d.outboundOrderLineId);
        return <span className="font-mono text-xs">{ol?.product?.sku ?? '—'}</span>;
      },
      width: '110px',
    },
    {
      header: t(['Product', 'المنتج']),
      accessor: (d) => {
        const ol = lineMeta.get(d.outboundOrderLineId);
        return <span className="font-medium text-slate-800">{ol?.product?.name ?? '—'}</span>;
      },
      width: '160px',
    },
    {
      header: 'Barcode',
      accessor: (d) => {
        const ol = lineMeta.get(d.outboundOrderLineId);
        return <span className="font-mono text-xs">{ol?.product?.barcode ?? '—'}</span>;
      },
      width: '120px',
    },
    {
      header: t(['Source bin', 'Bin المصدر']),
      accessor: (d) => {
        const loc = locationById.get(d.locationId);
        return (
          <div>
            <span className="font-mono text-sm font-bold text-slate-900">
              {locationDisplay(loc).shortLabel}
            </span>
            <p className="text-[10px] text-slate-500">{locationDisplay(loc).fullPath}</p>
          </div>
        );
      },
      width: '140px',
    },
    {
      header: 'Lot',
      accessor: (d) => {
        const lotNum = d.lotId ? lotNumberById.get(d.lotId) ?? `${d.lotId.slice(0, 8)}…` : '—';
        return <span className="font-mono text-xs">{lotNum}</span>;
      },
      width: '90px',
    },
    {
      header: t(['Required', 'المطلوب']),
      accessor: (d) => <span className="font-mono tabular-nums text-xs">{d.requiredQty}</span>,
      width: '80px',
    },
    {
      header: t(['Picked', 'مُلتقط']),
      accessor: (d) =>
        readOnly ? (
          <span className="font-mono tabular-nums">{d.pickedQty}</span>
        ) : (
          <input
            className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            value={d.pickedQty}
            onChange={(e) => {
              const n = parseQty(e.target.value);
              onPatch?.(d.rowKey, {
                pickedQty: e.target.value,
                exceptionType: n < parseQty(d.requiredQty) - 1e-6 ? 'short' : 'none',
              });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      width: '90px',
    },
    {
      header: t(['Remaining', 'المتبقي']),
      accessor: (d) => {
        const remaining = Math.max(0, parseQty(d.requiredQty) - parseQty(d.pickedQty));
        return <span className="font-mono tabular-nums text-xs">{remaining}</span>;
      },
      width: '90px',
    },
    {
      header: t(['Status', 'الحالة']),
      accessor: (d) => {
        const st = computePickLineStatus(d);
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pickLineStatusClass(st)}`}>
            {localizedPickLineStatus(st, t)}
          </span>
        );
      },
      className: 'whitespace-nowrap',
    },
  ];

  return (
    <DataTable
      title={t(['Pick lines', 'أسطر التقاط'])}
      actions={
        onExportPrint ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={drafts.length === 0}
            onClick={() => onExportPrint()}
          >
            {t(['Export PDF', 'تصدير PDF'])}
          </Button>
        ) : undefined
      }
      columns={columns}
      rows={drafts}
      rowKey={(d) => d.rowKey}
      empty={
        totalLineCount === 0
          ? t(['No pick lines.', 'لا أسطر تقاط.'])
          : t(['No lines match the current filters.', 'لا أسطر تطابق الفلاتر الحالية.'])
      }
    />
  );
}
