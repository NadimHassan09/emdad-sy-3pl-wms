import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { InboundApi, type InboundOrderLine } from '../../../api/inbound';
import type { Location } from '../../../api/locations';
import { LocationsApi } from '../../../api/locations';
import { ProductsApi, type ProductLot } from '../../../api/products';
import { TasksApi } from '../../../api/tasks';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Combobox } from '../../../components/Combobox';
import { useToast } from '../../../components/ToastProvider';
import { QK } from '../../../constants/query-keys';
import { locationTypeLabel } from '../../../lib/location-types';
import { Alert } from '@ds';
import type {
  PutawayExecutionDraft,
  PutawayLineDraft,
  PutawayLineRow,
  PutawayScanStep,
} from './putaway-types';
import {
  computeLineStatus,
  computePutawaySummary,
  lineStatusClass,
  lineStatusLabel,
  locationDisplay,
  matchLocationByScan,
  matchProductScan,
  parseQty,
  scanStepLabel,
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
  taskStatus,
  executionState,
  destinationLocations,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  const savedDraft = readPutawayDraft(executionState);

  const [drafts, setDrafts] = useState<PutawayLineDraft[]>(() =>
    initialDraftRows(lines, savedDraft?.lines),
  );
  const [activeIndex, setActiveIndex] = useState(savedDraft?.activeLineIndex ?? 0);
  const [scanStep, setScanStep] = useState<PutawayScanStep>('source');
  const [scanValue, setScanValue] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(savedDraft?.collapsedRowKeys ?? []),
  );
  const [focusMode, setFocusMode] = useState(true);
  const [issueText, setIssueText] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);

  const linesFingerprint = useMemo(
    () => lines.map((l) => `${l.inbound_order_line_id}\u001f${l.quantity}`).join('\u001e'),
    [lines],
  );

  useEffect(() => {
    setDrafts(initialDraftRows(lines, undefined));
    setActiveIndex(0);
    setScanStep('source');
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

  const activeDraft = drafts[activeIndex];
  const activePayloadLine = lines[activeIndex];
  const activeOl = activeDraft ? lineById.get(activeDraft.inbound_order_line_id) : undefined;
  const activeStagingId = activePayloadLine
    ? stagingByLineId.get(activePayloadLine.inbound_order_line_id)
    : undefined;
  const stagingLoc = (allLocations.data ?? []).find((l) => l.id === activeStagingId);
  const destLoc = destinationLocations.find((l) => l.id === activeDraft?.destination_location_id);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const sums: Record<string, number> = {};
    for (const d of drafts) {
      const q = parseQty(d.putaway_quantity);
      if (q > 0) {
        sums[d.inbound_order_line_id] = (sums[d.inbound_order_line_id] ?? 0) + q;
        if (!d.destination_location_id) issues.push('Destination required for rows with quantity.');
        if (!d.sourceVerified) issues.push('Confirm source scan for active moves.');
        if (!d.destVerified) issues.push('Confirm destination scan for active moves.');
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

  const saveProgress = useMutation({
    mutationFn: () =>
      TasksApi.patchProgress(
        taskId,
        {
          putaway_draft: {
            lines: drafts,
            activeLineIndex: activeIndex,
            collapsedRowKeys: [...collapsed],
          } satisfies PutawayExecutionDraft,
        },
        companyIdOverride,
      ),
    onSuccess: () => toast.success('Progress saved'),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!readOnly && focusMode) scanRef.current?.focus();
  }, [readOnly, focusMode, activeIndex, scanStep]);

  const applyScan = useCallback(
    (raw: string) => {
      if (!activeDraft || readOnly) return;
      const code = raw.trim();
      if (!code) return;

      if (scanStep === 'source') {
        const expectedId = stagingByLineId.get(activeDraft.inbound_order_line_id);
        const hit = matchLocationByScan(code, allLocations.data ?? []);
        if (!hit || hit.id !== expectedId) {
          setScanFeedback({
            type: 'err',
            msg: `Wrong source — scan staging ${locationDisplay(stagingLoc).shortLabel}.`,
          });
          return;
        }
        patchDraft(activeDraft.rowKey, { sourceVerified: true });
        setScanFeedback({ type: 'ok', msg: `Source confirmed: ${hit.fullPath}` });
        setScanStep('destination');
        setScanValue('');
        return;
      }

      if (scanStep === 'destination') {
        const hit = matchLocationByScan(code, destinationLocations);
        if (!hit) {
          setScanFeedback({ type: 'err', msg: 'Not a valid putaway destination bin.' });
          return;
        }
        patchDraft(activeDraft.rowKey, {
          destination_location_id: hit.id,
          destVerified: true,
        });
        setScanFeedback({ type: 'ok', msg: `Destination: ${hit.fullPath}` });
        setScanStep('product');
        setScanValue('');
        return;
      }

      if (scanStep === 'product') {
        if (!matchProductScan(code, activeOl)) {
          setScanFeedback({ type: 'err', msg: 'Product barcode does not match this line.' });
          return;
        }
        patchDraft(activeDraft.rowKey, { productVerified: true });
        setScanFeedback({ type: 'ok', msg: `Product verified: ${activeOl?.product?.sku}` });
        setScanValue('');
      }
    },
    [
      activeDraft,
      activeOl,
      allLocations.data,
      destinationLocations,
      patchDraft,
      readOnly,
      scanStep,
      stagingByLineId,
      stagingLoc,
    ],
  );

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

  const title = taskType === 'putaway_quarantine' ? 'Quarantine putaway' : 'Putaway';
  const comboboxOptions = destinationLocations.map((loc) => ({
    value: loc.id,
    label: loc.fullPath,
    hint: `${locationTypeLabel(loc.type)} · ${loc.barcode}`,
  }));

  if (readOnly) {
    return (
      <div className="space-y-4">
        <PutawayHeader
          title={title}
          orderNumber={inbound.data?.orderNumber}
          companyName={inbound.data?.company?.name}
          assignedWorkerLabel={assignedWorkerLabel}
          taskStatus={taskStatus}
          warehouseId={warehouseId}
        />
        <SummaryCards summary={summary} />
        <PutawayTable
          drafts={drafts}
          lines={lines}
          lineById={lineById}
          lotsByProductId={lotsByProductId}
          stagingByLineId={stagingByLineId}
          allLocations={allLocations.data ?? []}
          destinationLocations={destinationLocations}
          targetQty={targetQty}
          readOnly
        />
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      <PutawayHeader
        title={title}
        orderNumber={inbound.data?.orderNumber}
        companyName={inbound.data?.company?.name}
        assignedWorkerLabel={assignedWorkerLabel}
        taskStatus={taskStatus}
        warehouseId={warehouseId}
        inboundHref={inboundOrderId ? `/orders/inbound/${inboundOrderId}` : undefined}
      />

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

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Movement execution</p>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={focusMode}
            onChange={(e) => setFocusMode(e.target.checked)}
            className="rounded border-slate-300"
          />
          Focus mode (one line)
        </label>
      </div>

      {focusMode && activeDraft && activePayloadLine ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Line {activeIndex + 1} of {drafts.length}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(
                computeLineStatus(activeDraft, targetQty[activeDraft.inbound_order_line_id] ?? 0),
              )}`}
            >
              {lineStatusLabel(
                computeLineStatus(activeDraft, targetQty[activeDraft.inbound_order_line_id] ?? 0),
              )}
            </span>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{activeOl?.product?.name ?? '—'}</p>
          <p className="font-mono text-sm text-slate-500">{activeOl?.product?.sku}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LocationHero label="From (staging)" loc={stagingLoc} />
            <LocationHero label="To (destination)" loc={destLoc} />
          </div>

          <div className="mt-4 rounded-xl border-2 border-emerald-400 bg-emerald-50/50 p-4">
            <p className="text-sm font-semibold text-emerald-900">{scanStepLabel(scanStep)}</p>
            <p className="mt-1 text-xs text-slate-600">
              Step {scanStep === 'source' ? 1 : scanStep === 'destination' ? 2 : 3} of 3 · Required
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                ref={scanRef}
                type="text"
                className="min-h-[52px] flex-1 rounded-xl border-2 border-emerald-400 bg-white px-4 font-mono text-lg"
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyScan(scanValue);
                  }
                }}
                placeholder="Scan barcode…"
                aria-label={scanStepLabel(scanStep)}
              />
              <Button type="button" className="min-h-[52px]" onClick={() => applyScan(scanValue)}>
                Apply
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[52px]"
                onClick={() => setScanModalOpen(true)}
              >
                Camera
              </Button>
            </div>
            {scanFeedback ? (
              <p
                className={`mt-2 text-sm font-medium ${scanFeedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {scanFeedback.msg}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {(['source', 'destination', 'product'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScanStep(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    scanStep === s ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {s === 'source' ? 'Source' : s === 'destination' ? 'Dest' : 'Product'}
                  {s === 'source' && activeDraft.sourceVerified ? ' ✓' : ''}
                  {s === 'destination' && activeDraft.destVerified ? ' ✓' : ''}
                  {s === 'product' && activeDraft.productVerified ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Destination (pick list)</label>
              <Combobox
                value={activeDraft.destination_location_id}
                onChange={(v) =>
                  patchDraft(activeDraft.rowKey, {
                    destination_location_id: v,
                    destVerified: !!v,
                  })
                }
                options={comboboxOptions}
                placeholder="Select bin…"
                emptyMessage="No locations"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Quantity to move</label>
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg"
                value={activeDraft.putaway_quantity}
                onChange={(e) => patchDraft(activeDraft.rowKey, { putaway_quantity: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Line target {targetQty[activeDraft.inbound_order_line_id] ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={activeIndex <= 0}
              onClick={() => {
                setActiveIndex((i) => Math.max(0, i - 1));
                setScanStep('source');
                setScanFeedback(null);
              }}
            >
              Previous line
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => splitRow(activeDraft.rowKey)}
            >
              Split quantity
            </Button>
            <Button
              type="button"
              disabled={activeIndex >= drafts.length - 1}
              onClick={() => {
                const st = computeLineStatus(activeDraft, targetQty[activeDraft.inbound_order_line_id] ?? 0);
                if (st === 'complete') {
                  setCollapsed((c) => new Set(c).add(activeDraft.rowKey));
                }
                setActiveIndex((i) => Math.min(drafts.length - 1, i + 1));
                setScanStep('source');
                setScanFeedback(null);
              }}
            >
              Next line
            </Button>
          </div>
        </section>
      ) : null}

      {!focusMode ? (
        <PutawayTable
          drafts={drafts}
          lines={lines}
          lineById={lineById}
          lotsByProductId={lotsByProductId}
          stagingByLineId={stagingByLineId}
          allLocations={allLocations.data ?? []}
          destinationLocations={destinationLocations}
          targetQty={targetQty}
          comboboxOptions={comboboxOptions}
          onPatch={patchDraft}
          onSplit={splitRow}
        />
      ) : null}

      {focusMode ? (
        <div className="hidden md:block">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">All movement lines</h2>
          <PutawayTable
            drafts={drafts}
            lines={lines}
            lineById={lineById}
            lotsByProductId={lotsByProductId}
            stagingByLineId={stagingByLineId}
            allLocations={allLocations.data ?? []}
            destinationLocations={destinationLocations}
            targetQty={targetQty}
            comboboxOptions={comboboxOptions}
            onPatch={patchDraft}
            onSplit={splitRow}
          />
        </div>
      ) : null}

      {focusMode ? (
        <section className="space-y-2 md:hidden">
          <h2 className="text-sm font-semibold text-slate-800">All lines</h2>
          {drafts.map((d, i) => {
            if (collapsed.has(d.rowKey)) return null;
            const ol = lineById.get(d.inbound_order_line_id);
            const st = computeLineStatus(d, targetQty[d.inbound_order_line_id] ?? 0);
            return (
              <button
                key={d.rowKey}
                type="button"
                onClick={() => {
                  setActiveIndex(i);
                  setFocusMode(true);
                }}
                className="w-full rounded-xl border border-slate-100 bg-white p-3 text-start shadow-sm"
              >
                <p className="font-medium text-slate-900">{ol?.product?.name}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${lineStatusClass(st)}`}>
                  {lineStatusLabel(st)}
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      {showIssueForm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium">Report exception</p>
          <textarea
            className="mt-2 min-h-[80px] w-full rounded-lg border border-slate-300 p-2 text-sm"
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (issueText.trim() && activeDraft) {
                  patchDraft(activeDraft.rowKey, {
                    notes: issueText.trim(),
                  });
                }
                setShowIssueForm(false);
                setIssueText('');
              }}
            >
              Save note
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowIssueForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            loading={saveProgress.isPending}
            onClick={() => saveProgress.mutate()}
          >
            Save progress
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            onClick={() => setShowIssueForm(true)}
          >
            Report exception
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            Complete putaway
          </Button>
        </div>
      </div>

      <BarcodeScanModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onScan={(text) => {
          applyScan(text);
          setScanModalOpen(false);
        }}
      />
    </form>
  );
}

function PutawayHeader({
  title,
  orderNumber,
  companyName,
  assignedWorkerLabel,
  taskStatus,
  warehouseId,
  inboundHref,
}: {
  title: string;
  orderNumber?: string;
  companyName?: string;
  assignedWorkerLabel: string;
  taskStatus: string;
  warehouseId: string;
  inboundHref?: string;
}) {
  return (
    <header className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{title}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {orderNumber ? (
              inboundHref ? (
                <Link to={inboundHref} className="hover:text-emerald-700">
                  {orderNumber}
                </Link>
              ) : (
                orderNumber
              )
            ) : (
              'Inbound putaway'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{companyName ?? '—'}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {taskStatus.replace(/_/g, ' ')}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Worker</dt>
          <dd className="font-medium text-slate-900">{assignedWorkerLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Warehouse</dt>
          <dd className="font-mono text-xs text-slate-800">{warehouseId.slice(0, 8)}…</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Zone</dt>
          <dd className="text-slate-700">Staging → storage</dd>
        </div>
      </dl>
    </header>
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

function LocationHero({ label, loc }: { label: string; loc?: Location }) {
  const d = locationDisplay(loc);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-slate-900">{d.shortLabel}</p>
      {d.segments.length > 1 ? (
        <p className="mt-1 text-xs text-slate-600">{d.segments.join(' › ')}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">{d.fullPath}</p>
      )}
      {loc ? (
        <p className="mt-1 text-[10px] text-slate-400">
          {locationTypeLabel(loc.type)} · {loc.barcode || 'no barcode'}
        </p>
      ) : null}
    </div>
  );
}

function PutawayTable({
  drafts,
  lineById,
  lotsByProductId: _lotsByProductId,
  stagingByLineId,
  allLocations,
  destinationLocations,
  targetQty,
  readOnly,
  comboboxOptions,
  onPatch,
  onSplit,
}: {
  drafts: PutawayLineDraft[];
  lines: PutawayLineRow[];
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
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="min-w-[1100px] w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <th className="px-3 py-3">Product</th>
            <th className="px-3 py-3">SKU</th>
            <th className="px-3 py-3">Source</th>
            <th className="px-3 py-3">Destination</th>
            <th className="px-3 py-3">Qty</th>
            <th className="px-3 py-3">Moved</th>
            <th className="px-3 py-3">Scan</th>
            <th className="px-3 py-3">Status</th>
            {!readOnly ? <th className="px-3 py-3">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => {
            const ol = lineById.get(d.inbound_order_line_id);
            const src = allLocations.find((l) => l.id === stagingByLineId.get(d.inbound_order_line_id));
            const dest = destinationLocations.find((l) => l.id === d.destination_location_id);
            const st = computeLineStatus(d, targetQty[d.inbound_order_line_id] ?? 0);
            const scanBits = [
              d.sourceVerified ? 'S✓' : 'S—',
              d.destVerified ? 'D✓' : 'D—',
              d.productVerified ? 'P✓' : 'P—',
            ].join(' ');
            return (
              <tr key={d.rowKey} className="border-b border-slate-100 align-top">
                <td className="px-3 py-3 text-xs font-medium">{ol?.product?.name ?? '—'}</td>
                <td className="px-3 py-3 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                <td className="px-3 py-3 text-xs">
                  <span className="font-mono font-semibold text-slate-800">
                    {locationDisplay(src).shortLabel}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {readOnly ? (
                    <span className="font-mono text-xs">{locationDisplay(dest).fullPath}</span>
                  ) : (
                    <Combobox
                      value={d.destination_location_id}
                      onChange={(v) =>
                        onPatch?.(d.rowKey, { destination_location_id: v, destVerified: !!v })
                      }
                      options={comboboxOptions ?? []}
                      placeholder="Bin…"
                    />
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{targetQty[d.inbound_order_line_id] ?? 0}</td>
                <td className="px-3 py-3">
                  {readOnly ? (
                    d.putaway_quantity
                  ) : (
                    <input
                      className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                      value={d.putaway_quantity}
                      onChange={(e) => onPatch?.(d.rowKey, { putaway_quantity: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-[10px] text-slate-600">{scanBits}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(st)}`}>
                    {lineStatusLabel(st)}
                  </span>
                </td>
                {!readOnly ? (
                  <td className="px-3 py-3">
                    <Button type="button" size="sm" variant="secondary" onClick={() => onSplit?.(d.rowKey)}>
                      Split
                    </Button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
