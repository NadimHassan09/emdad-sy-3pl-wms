import { useQueries, useQuery } from '@tanstack/react-query';
import { useTaskProgressSave } from '../../../hooks/useTaskProgressSave';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { InboundApi, type InboundOrderLine } from '../../../api/inbound';
import { Column, DataTable } from '../../../components/DataTable';
import { TaskDetailsCard } from '../../../components/tasks/TaskDetailsCard';
import type { Location } from '../../../api/locations';
import { ProductsApi, type ProductLot } from '../../../api/products';
import { BarcodeScanIcon } from '../../../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { PutawayDestinationPicker } from './PutawayDestinationPicker';
import { useResolvedLocations } from '../../../hooks/useResolvedLocations';
import { TaskLinesFilterCard } from '../../../components/tasks/TaskLinesFilterCard';
import {
  DEFAULT_TASK_LINE_FILTERS,
  taskLineFiltersWithSearch,
} from '../../../lib/task-line-filters';
import type { TaskLineFilters } from '../../../lib/task-line-filters';
import { useToast } from '../../../components/ToastProvider';
import { QK } from '../../../constants/query-keys';
import { resolveLocationByScan } from '../../../lib/location-resolve';
import {
  isAllowedPutawayDestination,
  putawayDestinationTypes,
} from '../../../lib/location-types';
import { inboundOrderTitle } from '../../../lib/task-details-helpers';
import { useWarehouseLabel } from '../../../hooks/useWarehouseLabel';
import { taskTypeIconClass } from '../../../lib/task-type-icons';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import {
  localizedPutawayLineStatus,
  localizedPutawayStatusFilterOptions,
  localizedTaskLineSearchPlaceholder,
  localizedTaskTypeTitle,
} from '../../../lib/ui-labels/task-execution';
import { Alert } from '@ds';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
  openPutawayPrintPdf,
  putawayDestinationSummary,
  putawaySourceSummary,
} from './putaway-print';
import type {
  PutawayExecutionDraft,
  PutawayLineDraft,
  PutawayLineRow,
} from './putaway-types';
import {
  computeLineStatus,
  computePutawaySummary,
  filterPutawayDrafts,
  lineStatusClass,
  locationDisplay,
  parseQty,
} from './putaway-utils';

function readPutawayDraft(raw: unknown): PutawayExecutionDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const d = r.putaway_draft ?? r.putawayDraft;
  if (!d || typeof d !== 'object') return null;
  return d as PutawayExecutionDraft;
}

function initialDraftRows(lines: PutawayLineRow[], saved?: PutawayLineDraft[]): PutawayLineDraft[] {
  if (saved?.length) {
    const byKey = new Map(saved.map((s) => [s.rowKey, s]));
    return lines.map((l, i) => {
      const key = `${l.inbound_order_line_id}-${i}`;
      return (
        byKey.get(key) ?? {
          rowKey: key,
          inbound_order_line_id: l.inbound_order_line_id,
          putaway_quantity: l.quantity,
          destination_location_id: '',
          lot_id: l.lot_id ?? null,
          sourceVerified: false,
          destVerified: false,
          productVerified: false,
          notes: '',
        }
      );
    });
  }
  return lines.map((l, i) => ({
    rowKey: `${l.inbound_order_line_id}-${i}`,
    inbound_order_line_id: l.inbound_order_line_id,
    putaway_quantity: l.quantity,
    destination_location_id: '',
    lot_id: l.lot_id ?? null,
    sourceVerified: false,
    destVerified: false,
    productVerified: false,
    notes: '',
  }));
}

type Props = {
  taskId: string;
  taskType: 'putaway' | 'putaway_quarantine';
  lines: PutawayLineRow[];
  inboundOrderId?: string;
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

export function PutawayExecutionPanel({
  taskId,
  taskType,
  lines,
  inboundOrderId,
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
  const { warehouseLabel } = useWarehouseLabel();
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const savedDraft = readPutawayDraft(executionState);

  const [drafts, setDrafts] = useState<PutawayLineDraft[]>(() =>
    initialDraftRows(lines, savedDraft?.lines),
  );
  const [draftLineFilters, setDraftLineFilters] = useState<TaskLineFilters>(
    DEFAULT_TASK_LINE_FILTERS,
  );
  const [appliedLineFilters, setAppliedLineFilters] = useState<TaskLineFilters>(
    DEFAULT_TASK_LINE_FILTERS,
  );

  const linesFingerprint = useMemo(
    () => lines.map((l) => `${l.inbound_order_line_id}\u001f${l.quantity}`).join('\u001e'),
    [lines],
  );

  useEffect(() => {
    setDrafts(initialDraftRows(lines, undefined));
  }, [linesFingerprint]);

  const inbound = useQuery({
    queryKey: [...QK.inboundOrders, inboundOrderId ?? ''],
    queryFn: () => InboundApi.get(inboundOrderId!),
    enabled: !!inboundOrderId,
  });

  const lineById = useMemo(() => {
    const m = new Map<string, InboundOrderLine>();
    for (const ol of inbound.data?.lines ?? []) m.set(ol.id, ol);
    return m;
  }, [inbound.data?.lines]);

  const stagingByLineId = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lines) {
      if (l.source_staging_location_id) m.set(l.inbound_order_line_id, l.source_staging_location_id);
    }
    return m;
  }, [lines]);

  const productIdsForLots = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const pl of lines) {
      const ol = lineById.get(pl.inbound_order_line_id);
      if (ol?.product?.trackingType === 'lot' && ol.productId && !seen.has(ol.productId)) {
        seen.add(ol.productId);
        ids.push(ol.productId);
      }
    }
    return ids;
  }, [lines, lineById]);

  const lotsQueries = useQueries({
    queries: productIdsForLots.map((productId) => ({
      queryKey: ['products', productId, 'lots', 'putaway'] as const,
      queryFn: () => ProductsApi.listLots(productId),
      enabled: !!inboundOrderId && productIdsForLots.length > 0,
    })),
  });

  const lotsByProductId = useMemo(() => {
    const map = new Map<string, ProductLot[]>();
    productIdsForLots.forEach((pid, i) => {
      map.set(pid, lotsQueries[i]?.data ?? []);
    });
    return map;
  }, [productIdsForLots, lotsQueries]);

  const resolvedLocationIds = useMemo(() => {
    const ids: string[] = [];
    for (const l of lines) {
      const sid = l.source_staging_location_id?.trim();
      if (sid) ids.push(sid);
    }
    for (const d of drafts) {
      const did = d.destination_location_id?.trim();
      if (did) ids.push(did);
    }
    return ids;
  }, [lines, drafts]);

  const { locationById } = useResolvedLocations(resolvedLocationIds);

  const targetQty = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.inbound_order_line_id, parseQty(l.quantity)])),
    [lines],
  );

  const summary = useMemo(() => computePutawaySummary(lines, drafts), [lines, drafts]);

  const filteredDrafts = useMemo(
    () =>
      filterPutawayDrafts(
        drafts,
        appliedLineFilters,
        lineById,
        targetQty,
        lotsByProductId,
      ),
    [drafts, appliedLineFilters, lineById, targetQty, lotsByProductId],
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
      resultCount={filteredDrafts.length}
      totalCount={drafts.length}
      statusOptions={localizedPutawayStatusFilterOptions(t)}
      searchPlaceholder={localizedTaskLineSearchPlaceholder(t)}
      onBarcodeScan={(code) => {
        const next = taskLineFiltersWithSearch(draftLineFilters, code);
        setDraftLineFilters(next);
        setAppliedLineFilters(next);
      }}
    />
  );

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const sums: Record<string, number> = {};
    for (const d of drafts) {
      const q = parseQty(d.putaway_quantity);
      if (q > 0) {
        sums[d.inbound_order_line_id] = (sums[d.inbound_order_line_id] ?? 0) + q;
      }
    }
    for (const l of lines) {
      const target = targetQty[l.inbound_order_line_id] ?? 0;
      const sum = sums[l.inbound_order_line_id] ?? 0;
      if (Math.abs(sum - target) > 1e-6 && sum > 0) {
        issues.push(
          t([
            `Line ${l.inbound_order_line_id.slice(0, 8)}… qty must sum to ${target}.`,
            `السطر ${l.inbound_order_line_id.slice(0, 8)}… يجب أن تساوي الكميات ${target}.`,
          ]),
        );
      }
    }
    return [...new Set(issues)];
  }, [drafts, lines, targetQty, t]);

  const patchDraft = useCallback((rowKey: string, patch: Partial<PutawayLineDraft>) => {
    setDrafts((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  }, []);

  const saveProgress = useTaskProgressSave({
    taskId,
    warehouseId,
    inboundOrderId,
    companyIdOverride,
  });

  function handleComplete(e: FormEvent) {
    e.preventDefault();
    if (validationIssues.length > 0) {
      toast.error(t(['Resolve validation issues before completing.', 'عالج مشاكل التحقق قبل الإكمال.']));
      return;
    }
    const submitRows = drafts.filter((r) => parseQty(r.putaway_quantity) > 0);
    if (submitRows.length === 0) {
      toast.error(t(['Enter quantities for at least one move.', 'أدخل كميات لحركة واحدة على الأقل.']));
      return;
    }
    for (const r of submitRows) {
      if (!r.destination_location_id.trim()) {
        toast.error(t(['Each row needs a destination.', 'كل سطر يحتاج وجهة.']));
        return;
      }
    }
    const sums: Record<string, number> = {};
    for (const r of submitRows) {
      sums[r.inbound_order_line_id] = (sums[r.inbound_order_line_id] ?? 0) + parseQty(r.putaway_quantity);
    }
    for (const l of lines) {
      if (Math.abs((sums[l.inbound_order_line_id] ?? 0) - (targetQty[l.inbound_order_line_id] ?? 0)) > 1e-6) {
        toast.error(t(['Quantities must sum to task line targets.', 'يجب أن تساوي الكميات أهداف أسطر المهمة.']));
        return;
      }
    }
    submit({
      task_type: taskType,
      lines: submitRows.map((r) => ({
        inbound_order_line_id: r.inbound_order_line_id,
        putaway_quantity: (r.putaway_quantity ?? '0').trim() || '0',
        destination_location_id: r.destination_location_id,
        lot_id: r.lot_id ?? null,
      })),
    });
  }

  function splitRow(rowKey: string) {
    setDrafts((prev) => {
      const idx = prev.findIndex((r) => r.rowKey === rowKey);
      if (idx < 0) return prev;
      const row = prev[idx]!;
      const copy = [...prev];
      copy.splice(idx + 1, 0, {
        rowKey: `${row.inbound_order_line_id}-split-${Date.now()}`,
        inbound_order_line_id: row.inbound_order_line_id,
        putaway_quantity: '',
        destination_location_id: '',
        lot_id: row.lot_id ?? null,
        sourceVerified: false,
        destVerified: false,
        productVerified: false,
        notes: '',
      });
      return copy;
    });
  }

  const putawayDetailsCard = (
    <TaskDetailsCard
      taskTypeLabel={localizedTaskTypeTitle(taskType, t)}
      iconClass={taskTypeIconClass(taskType)}
      primaryTitle={inboundOrderTitle(
        inbound.data?.orderNumber,
        inboundOrderId ? `/orders/inbound/${inboundOrderId}` : undefined,
        taskType === 'putaway_quarantine'
          ? t(['Quarantine putaway', 'تخزين حجر'])
          : t(['Inbound putaway', 'تخزين وارد']),
      )}
      subtitle={inbound.data?.company?.name ?? '—'}
      status={taskStatus}
      fields={[
        {
          iconClass: 'fa-solid fa-building',
          label: t(['Client', 'العميل']),
          value: inbound.data?.company?.name ?? '—',
        },
        {
          iconClass: 'fa-solid fa-user',
          label: t(['Worker', 'العامل']),
          value: assignedWorkerLabel,
        },
        {
          iconClass: 'fa-solid fa-warehouse',
          label: t(['Warehouse', 'المستودع']),
          value: warehouseLabel(warehouseId),
        },
        {
          iconClass: 'fa-solid fa-arrows-turn-right',
          label: t(['Movement', 'الحركة']),
          value: t(['Staging → storage', 'تجهيز → تخزين']),
        },
      ]}
      summary={inbound.data?.notes ?? undefined}
    />
  );

  const handleExportPrint = () => {
    if (drafts.length === 0) {
      toast.error(t(['No lines to export.', 'لا توجد أسطر للتصدير.']));
      return;
    }
    const ok = openPutawayPrintPdf({
      taskLabel: taskType === 'putaway_quarantine' ? 'Quarantine putaway' : 'Putaway',
      orderNumber: inbound.data?.orderNumber ?? inboundOrderId ?? '—',
      companyName: inbound.data?.company?.name ?? '—',
      assignedWorker: assignedWorkerLabel,
      sourceSummary: putawaySourceSummary(drafts, stagingByLineId, locationById),
      destinationSummary: putawayDestinationSummary(drafts, locationById),
      operatorNotes: taskOperatorNotes,
      drafts,
      lineById,
      stagingByLineId,
      locationById,
      targetQty,
    });
    if (!ok) toast.error(t(['Allow pop-ups to print or save as PDF.', 'اسمح بالنوافذ المنبثقة للطباعة أو حفظ PDF.']));
  };

  if (readOnly) {
    return (
      <div className="space-y-4">
        {putawayDetailsCard}
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
        <PutawayLinesTable
          drafts={filteredDrafts}
          totalLineCount={drafts.length}
          lineById={lineById}
          stagingByLineId={stagingByLineId}
          locationById={locationById}
          warehouseId={warehouseId}
          taskType={taskType}
          targetQty={targetQty}
          onExportPrint={showExportPdf ? handleExportPrint : undefined}
          readOnly
        />
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      {putawayDetailsCard}

      {validationIssues.length > 0 ? (
        <Alert variant="warning" title={t(['Validation attention needed', 'يلزم انتباه للتحقق'])}>
          <ul className="mt-1 list-inside list-disc text-sm">
            {validationIssues.slice(0, 4).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

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

      <PutawayLinesTable
        drafts={filteredDrafts}
        totalLineCount={drafts.length}
        lineById={lineById}
        stagingByLineId={stagingByLineId}
        locationById={locationById}
        warehouseId={warehouseId}
        taskType={taskType}
        targetQty={targetQty}
        onExportPrint={showExportPdf ? handleExportPrint : undefined}
        onPatch={patchDraft}
        onSplit={splitRow}
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
                putaway_draft: { lines: drafts } satisfies PutawayExecutionDraft,
              })
            }
          >
            {t(['Save progress', 'حفظ التقدم'])}
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            {t(['Complete putaway', 'إكمال التخزين'])}
          </Button>
        </div>
      </div>

    </form>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof computePutawaySummary> }) {
  const { t } = useWmsTranslation();
  const cards = [
    { label: 'SKU', value: String(summary.totalSkus) },
    { label: t(['Units', 'وحدات']), value: String(summary.totalUnits) },
    { label: t(['Done', 'منجز']), value: String(summary.completedMoves), accent: true },
    { label: t(['Remaining', 'المتبقي']), value: String(summary.remainingMoves) },
    { label: t(['Complete', 'مكتمل']), value: `${summary.completionPct}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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

function PutawayLinesTable({
  drafts,
  totalLineCount,
  lineById,
  stagingByLineId,
  locationById,
  warehouseId,
  taskType,
  targetQty,
  readOnly,
  onExportPrint,
  onPatch,
  onSplit,
}: {
  drafts: PutawayLineDraft[];
  totalLineCount: number;
  onExportPrint?: () => void;
  lineById: Map<string, InboundOrderLine>;
  stagingByLineId: Map<string, string>;
  locationById: Map<string, Location>;
  warehouseId: string;
  taskType: 'putaway' | 'putaway_quarantine';
  targetQty: Record<string, number>;
  readOnly?: boolean;
  onPatch?: (rowKey: string, patch: Partial<PutawayLineDraft>) => void;
  onSplit?: (rowKey: string) => void;
}) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const [scanRowKey, setScanRowKey] = useState<string | null>(null);

  const applyDestinationScan = useCallback(
    async (rowKey: string, code: string) => {
      const trimmed = code.trim();
      if (!trimmed) {
        toast.error(t(['Scan a location barcode.', 'امسح barcode الموقع.']));
        return;
      }
      const hit = await resolveLocationByScan(warehouseId, trimmed, {
        types: putawayDestinationTypes(taskType),
      });
      if (!hit || !isAllowedPutawayDestination(hit.type, taskType)) {
        toast.error(
          t([
            'No eligible storage bin matches this barcode.',
            'لا يوجد صندوق تخزين مطابق لهذا barcode.',
          ]),
        );
        return;
      }
      onPatch?.(rowKey, { destination_location_id: hit.id, destVerified: true });
      toast.success(
        t([`Destination: ${hit.fullPath}`, `الوجهة: ${hit.fullPath}`]),
      );
      setScanRowKey(null);
    },
    [onPatch, taskType, toast, t, warehouseId],
  );

  const columns: Column<PutawayLineDraft>[] = [
    {
      header: t(['Product', 'المنتج']),
      accessor: (d) => {
        const ol = lineById.get(d.inbound_order_line_id);
        return <span className="font-medium text-slate-800">{ol?.product?.name ?? '—'}</span>;
      },
      width: '160px',
    },
    {
      header: 'SKU',
      accessor: (d) => {
        const ol = lineById.get(d.inbound_order_line_id);
        return <span className="font-mono text-xs">{ol?.product?.sku ?? '—'}</span>;
      },
      width: '110px',
    },
    {
      header: t(['Source', 'المصدر']),
      accessor: (d) => {
        const src = locationById.get(stagingByLineId.get(d.inbound_order_line_id) ?? '');
        return (
          <span className="font-mono text-xs font-semibold text-slate-800">
            {locationDisplay(src).shortLabel}
          </span>
        );
      },
      width: '100px',
    },
    {
      header: t(['Destination', 'الوجهة']),
      accessor: (d) => {
        const dest = locationById.get(d.destination_location_id);
        return readOnly ? (
          <span className="font-mono text-xs">{locationDisplay(dest).fullPath}</span>
        ) : (
          <PutawayDestinationPicker
            warehouseId={warehouseId}
            taskType={taskType}
            value={d.destination_location_id}
            dropdownInFlow
            onChange={(v) => onPatch?.(d.rowKey, { destination_location_id: v, destVerified: !!v })}
          />
        );
      },
      width: '200px',
    },
    {
      header: t(['Qty', 'الكمية']),
      accessor: (d) => (
        <span className="font-mono tabular-nums text-xs">{targetQty[d.inbound_order_line_id] ?? 0}</span>
      ),
      width: '70px',
    },
    {
      header: t(['Moved', 'منقول']),
      accessor: (d) =>
        readOnly ? (
          <span className="font-mono tabular-nums">{d.putaway_quantity}</span>
        ) : (
          <input
            className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            value={d.putaway_quantity}
            onChange={(e) => onPatch?.(d.rowKey, { putaway_quantity: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      width: '90px',
    },
    {
      header: t(['Status', 'الحالة']),
      accessor: (d) => {
        const st = computeLineStatus(d, targetQty[d.inbound_order_line_id] ?? 0);
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(st)}`}>
            {localizedPutawayLineStatus(st, t)}
          </span>
        );
      },
      className: 'whitespace-nowrap',
    },
    ...(!readOnly
      ? [
          {
            header: t(['Scan', 'مسح']),
            accessor: (d: PutawayLineDraft) => (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                aria-label={t(['Scan destination barcode', 'مسح barcode الوجهة'])}
                onClick={(e) => {
                  e.stopPropagation();
                  setScanRowKey(d.rowKey);
                }}
              >
                <BarcodeScanIcon className="h-5 w-5" />
              </button>
            ),
            width: '56px',
            className: 'text-center',
          } satisfies Column<PutawayLineDraft>,
          {
            header: t(['Actions', 'إجراءات']),
            accessor: (d: PutawayLineDraft) => (
              <Button type="button" size="sm" variant="secondary" onClick={() => onSplit?.(d.rowKey)}>
                {t(['Split', 'تقسيم'])}
              </Button>
            ),
            width: '90px',
          } satisfies Column<PutawayLineDraft>,
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        title={t(['Movement lines', 'أسطر الحركة'])}
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
            ? t(['No putaway lines.', 'لا أسطر تخزين.'])
            : t(['No lines match the current filters.', 'لا أسطر تطابق الفلاتر الحالية.'])
        }
      />
      {!readOnly ? (
        <BarcodeScanModal
          open={scanRowKey !== null}
          onClose={() => setScanRowKey(null)}
          onScan={(code) => {
            if (scanRowKey) void applyDestinationScan(scanRowKey, code);
          }}
        />
      ) : null}
    </>
  );
}
