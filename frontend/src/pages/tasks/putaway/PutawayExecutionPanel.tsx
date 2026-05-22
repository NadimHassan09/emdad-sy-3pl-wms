import { useQueries, useQuery } from '@tanstack/react-query';
import { useTaskProgressSave } from '../../../hooks/useTaskProgressSave';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { InboundApi, type InboundOrderLine } from '../../../api/inbound';
import { Column, DataTable } from '../../../components/DataTable';
import { TaskDetailsCard } from '../../../components/tasks/TaskDetailsCard';
import type { Location } from '../../../api/locations';
import { LocationsApi } from '../../../api/locations';
import { ProductsApi, type ProductLot } from '../../../api/products';
import { Button } from '../../../components/Button';
import { Combobox } from '../../../components/Combobox';
import { TaskLinesFilterCard } from '../../../components/tasks/TaskLinesFilterCard';
import {
  DEFAULT_TASK_LINE_FILTERS,
  taskLineFiltersWithSearch,
} from '../../../lib/task-line-filters';
import type { TaskLineFilters } from '../../../lib/task-line-filters';
import { useToast } from '../../../components/ToastProvider';
import { QK } from '../../../constants/query-keys';
import { locationTypeLabel } from '../../../lib/location-types';
import { displayWarehouseLabel, inboundOrderTitle } from '../../../lib/task-details-helpers';
import { taskTypeIconClass } from '../../../lib/task-type-icons';
import { taskTypeTitle } from '../../../workflow/task-ui-matrix';
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
  lineStatusLabel,
  locationDisplay,
  parseQty,
  putawayLineStatusFilterOptions,
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
  destinationLocations: Location[];
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
  destinationLocations,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const toast = useToast();
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

  const allLocations = useQuery({
    queryKey: [...QK.locationsFlatAll(false), warehouseId, 'putaway-all'],
    queryFn: () => LocationsApi.list(warehouseId, false),
    enabled: !!warehouseId,
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
        allLocations.data ?? [],
      ),
    [drafts, appliedLineFilters, lineById, targetQty, lotsByProductId, allLocations.data],
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
      statusOptions={putawayLineStatusFilterOptions()}
      searchPlaceholder="SKU, product name, barcode, or lot"
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
        issues.push(`Line ${l.inbound_order_line_id.slice(0, 8)}… qty must sum to ${target}.`);
      }
    }
    return [...new Set(issues)];
  }, [drafts, lines, targetQty]);

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
      toast.error('Resolve validation issues before completing.');
      return;
    }
    const submitRows = drafts.filter((r) => parseQty(r.putaway_quantity) > 0);
    if (submitRows.length === 0) {
      toast.error('Enter quantities for at least one move.');
      return;
    }
    for (const r of submitRows) {
      if (!r.destination_location_id.trim()) {
        toast.error('Each row needs a destination.');
        return;
      }
    }
    const sums: Record<string, number> = {};
    for (const r of submitRows) {
      sums[r.inbound_order_line_id] = (sums[r.inbound_order_line_id] ?? 0) + parseQty(r.putaway_quantity);
    }
    for (const l of lines) {
      if (Math.abs((sums[l.inbound_order_line_id] ?? 0) - (targetQty[l.inbound_order_line_id] ?? 0)) > 1e-6) {
        toast.error(`Quantities must sum to task line targets.`);
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

  const comboboxOptions = destinationLocations.map((loc) => ({
    value: loc.id,
    label: loc.fullPath,
    hint: `${locationTypeLabel(loc.type)} · ${loc.barcode}`,
  }));

  const putawayDetailsCard = (
    <TaskDetailsCard
      taskTypeLabel={taskTypeTitle(taskType)}
      iconClass={taskTypeIconClass(taskType)}
      primaryTitle={inboundOrderTitle(
        inbound.data?.orderNumber,
        inboundOrderId ? `/orders/inbound/${inboundOrderId}` : undefined,
        taskType === 'putaway_quarantine' ? 'Quarantine putaway' : 'Inbound putaway',
      )}
      subtitle={inbound.data?.company?.name ?? '—'}
      status={taskStatus}
      fields={[
        {
          iconClass: 'fa-solid fa-building',
          label: 'Client',
          value: inbound.data?.company?.name ?? '—',
        },
        {
          iconClass: 'fa-solid fa-user',
          label: 'Worker',
          value: assignedWorkerLabel,
        },
        {
          iconClass: 'fa-solid fa-warehouse',
          label: 'Warehouse',
          value: displayWarehouseLabel(warehouseId),
        },
        {
          iconClass: 'fa-solid fa-arrows-turn-right',
          label: 'Movement',
          value: 'Staging → storage',
        },
      ]}
      summary={inbound.data?.notes ?? undefined}
    />
  );

  const handleExportPrint = () => {
    if (drafts.length === 0) {
      toast.error('No lines to export.');
      return;
    }
    const locs = allLocations.data ?? [];
    const ok = openPutawayPrintPdf({
      taskLabel: taskType === 'putaway_quarantine' ? 'Quarantine putaway' : 'Putaway',
      orderNumber: inbound.data?.orderNumber ?? inboundOrderId ?? '—',
      companyName: inbound.data?.company?.name ?? '—',
      assignedWorker: assignedWorkerLabel,
      sourceSummary: putawaySourceSummary(drafts, stagingByLineId, locs),
      destinationSummary: putawayDestinationSummary(drafts, destinationLocations),
      operatorNotes: taskOperatorNotes,
      drafts,
      lineById,
      stagingByLineId,
      allLocations: locs,
      destinationLocations,
      targetQty,
    });
    if (!ok) toast.error('Allow pop-ups to print or save as PDF.');
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
              Export PDF
            </Button>
          </div>
        ) : null}
        <PutawayLinesTable
          drafts={filteredDrafts}
          totalLineCount={drafts.length}
          lines={lines}
          lineById={lineById}
          lotsByProductId={lotsByProductId}
          stagingByLineId={stagingByLineId}
          allLocations={allLocations.data ?? []}
          destinationLocations={destinationLocations}
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
        <Alert variant="warning" title="Validation attention needed">
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
            Export PDF
          </Button>
        </div>
      ) : null}

      <PutawayLinesTable
        drafts={filteredDrafts}
        totalLineCount={drafts.length}
        lines={lines}
        lineById={lineById}
        lotsByProductId={lotsByProductId}
        stagingByLineId={stagingByLineId}
        allLocations={allLocations.data ?? []}
        destinationLocations={destinationLocations}
        targetQty={targetQty}
        comboboxOptions={comboboxOptions}
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
            Save progress
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            Complete putaway
          </Button>
        </div>
      </div>

    </form>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof computePutawaySummary> }) {
  const cards = [
    { label: 'SKUs', value: String(summary.totalSkus) },
    { label: 'Units', value: String(summary.totalUnits) },
    { label: 'Done', value: String(summary.completedMoves), accent: true },
    { label: 'Remaining', value: String(summary.remainingMoves) },
    { label: 'Complete', value: `${summary.completionPct}%` },
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
  lotsByProductId: _lotsByProductId,
  stagingByLineId,
  allLocations,
  destinationLocations,
  targetQty,
  readOnly,
  comboboxOptions,
  onExportPrint,
  onPatch,
  onSplit,
}: {
  drafts: PutawayLineDraft[];
  totalLineCount: number;
  lines: PutawayLineRow[];
  onExportPrint?: () => void;
  lineById: Map<string, InboundOrderLine>;
  lotsByProductId: Map<string, ProductLot[]>;
  stagingByLineId: Map<string, string>;
  allLocations: Location[];
  destinationLocations: Location[];
  targetQty: Record<string, number>;
  readOnly?: boolean;
  comboboxOptions?: Array<{ value: string; label: string; hint?: string }>;
  onPatch?: (rowKey: string, patch: Partial<PutawayLineDraft>) => void;
  onSplit?: (rowKey: string) => void;
}) {
  const columns: Column<PutawayLineDraft>[] = [
    {
      header: 'Product',
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
      header: 'Source',
      accessor: (d) => {
        const src = allLocations.find((l) => l.id === stagingByLineId.get(d.inbound_order_line_id));
        return (
          <span className="font-mono text-xs font-semibold text-slate-800">
            {locationDisplay(src).shortLabel}
          </span>
        );
      },
      width: '100px',
    },
    {
      header: 'Destination',
      accessor: (d) => {
        const dest = destinationLocations.find((l) => l.id === d.destination_location_id);
        return readOnly ? (
          <span className="font-mono text-xs">{locationDisplay(dest).fullPath}</span>
        ) : (
          <Combobox
            value={d.destination_location_id}
            onChange={(v) => onPatch?.(d.rowKey, { destination_location_id: v, destVerified: !!v })}
            options={comboboxOptions ?? []}
            placeholder="Bin…"
          />
        );
      },
      width: '200px',
    },
    {
      header: 'Qty',
      accessor: (d) => (
        <span className="font-mono tabular-nums text-xs">{targetQty[d.inbound_order_line_id] ?? 0}</span>
      ),
      width: '70px',
    },
    {
      header: 'Moved',
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
      header: 'Status',
      accessor: (d) => {
        const st = computeLineStatus(d, targetQty[d.inbound_order_line_id] ?? 0);
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(st)}`}>
            {lineStatusLabel(st)}
          </span>
        );
      },
      className: 'whitespace-nowrap',
    },
    ...(!readOnly
      ? [
          {
            header: 'Actions',
            accessor: (d: PutawayLineDraft) => (
              <Button type="button" size="sm" variant="secondary" onClick={() => onSplit?.(d.rowKey)}>
                Split
              </Button>
            ),
            width: '90px',
          } satisfies Column<PutawayLineDraft>,
        ]
      : []),
  ];

  return (
    <DataTable
      title="Movement lines"
      actions={
        onExportPrint ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={drafts.length === 0}
            onClick={() => onExportPrint()}
          >
            Export PDF
          </Button>
        ) : undefined
      }
      columns={columns}
      rows={drafts}
      rowKey={(d) => d.rowKey}
      empty={
        totalLineCount === 0
          ? 'No putaway lines.'
          : 'No lines match the current filters.'
      }
    />
  );
}
