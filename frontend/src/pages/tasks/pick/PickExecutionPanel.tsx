import { useMutation, useQueries } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Location } from '../../../api/locations';
import type { OutboundOrder, OutboundOrderLine } from '../../../api/outbound';
import { ProductsApi } from '../../../api/products';
import { TasksApi } from '../../../api/tasks';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Combobox } from '../../../components/Combobox';
import { useToast } from '../../../components/ToastProvider';
import { locationTypeLabel } from '../../../lib/location-types';
import { Alert } from '@ds';
import type { PickExecutionDraft, PickLineDraft, PickReservationRow, PickScanStep } from './pick-types';
import {
  buildPickCompletePayload,
  computePickLineStatus,
  computePickSummary,
  initialPickDrafts,
  locationDisplay,
  matchReservationLocationScan,
  matchReservationProductScan,
  parseQty,
  pickLineStatusClass,
  pickLineStatusLabel,
  pickScanStepLabel,
  sortDraftsByLocationPath,
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
  allLocations: Location[];
  packingLocations: Location[];
  warehouseId: string;
  companyIdOverride?: string;
  assignedWorkerLabel: string;
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
  allLocations,
  packingLocations,
  warehouseId,
  companyIdOverride,
  assignedWorkerLabel,
  taskStatus,
  executionState,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  const savedDraft = readPickDraft(executionState);

  const reservationsFingerprint = useMemo(
    () =>
      reservations
        .map((r) => `${r.outboundOrderLineId}\u001f${r.locationId}\u001f${r.lotId ?? ''}\u001f${r.quantity}`)
        .join('\u001e'),
    [reservations],
  );

  const [drafts, setDrafts] = useState<PickLineDraft[]>(() =>
    sortDraftsByLocationPath(initialPickDrafts(reservations, savedDraft?.lines), allLocations),
  );
  const [activeIndex, setActiveIndex] = useState(savedDraft?.activeLineIndex ?? 0);
  const [scanStep, setScanStep] = useState<PickScanStep>('location');
  const [scanValue, setScanValue] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [packingScanOpen, setPackingScanOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(savedDraft?.collapsedRowKeys ?? []),
  );
  const [focusMode, setFocusMode] = useState(true);
  const [packingDestinationId, setPackingDestinationId] = useState(savedDraft?.packingDestinationId ?? '');
  const [packingBarcodeDraft, setPackingBarcodeDraft] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueText, setIssueText] = useState('');

  const skipReservationReset = useRef(true);
  useEffect(() => {
    if (skipReservationReset.current) {
      skipReservationReset.current = false;
      return;
    }
    setDrafts(
      sortDraftsByLocationPath(initialPickDrafts(reservations, savedDraft?.lines), allLocations),
    );
    setActiveIndex(0);
    setScanStep('location');
  }, [reservationsFingerprint]);

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

  const activeDraft = drafts[activeIndex];
  const activeOl = activeDraft ? lineMeta.get(activeDraft.outboundOrderLineId) : undefined;
  const activeLoc = allLocations.find((l) => l.id === activeDraft?.locationId);

  const nextIncompleteIndex = useMemo(() => {
    const idx = drafts.findIndex((d) => computePickLineStatus(d) !== 'complete');
    return idx >= 0 ? idx : drafts.length - 1;
  }, [drafts]);

  const nextLocDraft = drafts[nextIncompleteIndex];
  const nextLoc = nextLocDraft
    ? allLocations.find((l) => l.id === nextLocDraft.locationId)
    : undefined;

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    for (const d of drafts) {
      const st = computePickLineStatus(d);
      if (st === 'short') {
        issues.push('Short pick recorded — resolve or adjust before completing.');
      }
      if (st !== 'complete' && parseQty(d.pickedQty) > 0) {
        issues.push('Finish location and product scans for in-progress lines.');
      }
    }
    const incomplete = drafts.filter((d) => computePickLineStatus(d) !== 'complete').length;
    if (incomplete > 0) issues.push(`${incomplete} pick line(s) still open.`);
    return [...new Set(issues)];
  }, [drafts]);

  const patchDraft = useCallback((rowKey: string, patch: Partial<PickLineDraft>) => {
    setDrafts((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  }, []);

  const saveProgress = useMutation({
    mutationFn: () =>
      TasksApi.patchProgress(
        taskId,
        {
          pick_draft: {
            lines: drafts,
            activeLineIndex: activeIndex,
            collapsedRowKeys: [...collapsed],
            packingDestinationId: packingDestinationId || undefined,
          } satisfies PickExecutionDraft,
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

      if (scanStep === 'location') {
        if (!matchReservationLocationScan(code, activeDraft.locationId, allLocations)) {
          setScanFeedback({
            type: 'err',
            msg: `Wrong bin — scan ${locationDisplay(activeLoc).shortLabel}.`,
          });
          return;
        }
        patchDraft(activeDraft.rowKey, { locationVerified: true });
        setScanFeedback({ type: 'ok', msg: `Bin confirmed: ${activeLoc?.fullPath}` });
        setScanStep('product');
        setScanValue('');
        return;
      }

      if (scanStep === 'product') {
        if (
          !matchReservationProductScan(
            code,
            activeDraft.productId,
            lineMeta,
            activeDraft.outboundOrderLineId,
          )
        ) {
          setScanFeedback({ type: 'err', msg: 'Product barcode does not match this pick line.' });
          return;
        }
        patchDraft(activeDraft.rowKey, { productVerified: true });
        setScanFeedback({ type: 'ok', msg: `Product verified: ${activeOl?.product?.sku}` });
        setScanStep('quantity');
        setScanValue('');
        return;
      }

      if (scanStep === 'quantity') {
        const n = parseQty(code);
        if (n <= 0) {
          setScanFeedback({ type: 'err', msg: 'Enter a positive quantity or use the stepper.' });
          return;
        }
        const required = parseQty(activeDraft.requiredQty);
        const exceptionType = n < required - 1e-6 ? 'short' : 'none';
        patchDraft(activeDraft.rowKey, {
          pickedQty: String(n),
          exceptionType,
        });
        if (exceptionType === 'short') {
          setScanFeedback({ type: 'err', msg: `Short by ${required - n} — add a note or adjust qty.` });
        } else {
          setScanFeedback({ type: 'ok', msg: `Quantity confirmed: ${n}` });
        }
        setScanValue('');
      }
    },
    [activeDraft, activeLoc, activeOl?.product?.sku, allLocations, lineMeta, patchDraft, readOnly, scanStep],
  );

  const applyPackingBarcode = (raw: string) => {
    const code = raw.trim().toLowerCase();
    if (!code) {
      toast.error('Enter or scan a packing location barcode.');
      return;
    }
    const hit = packingLocations.find((l) => (l.barcode ?? '').trim().toLowerCase() === code);
    if (!hit) {
      toast.error('No packing location matches this barcode.');
      return;
    }
    setPackingDestinationId(hit.id);
    setPackingBarcodeDraft('');
    toast.success(`Packing staging: ${hit.fullPath}`);
  };

  const packingComboOptions = packingLocations.map((loc) => ({
    value: loc.id,
    label: loc.fullPath,
    hint: `${locationTypeLabel(loc.type)} · ${loc.barcode}`,
  }));

  function handleComplete(e: FormEvent) {
    e.preventDefault();
    if (validationIssues.length > 0) {
      toast.error('Resolve all pick lines before completing.');
      return;
    }
    if (!reservations.length) {
      toast.error('No pick reservations on this task.');
      return;
    }
    submit(buildPickCompletePayload(reservations), e);
  }

  const shipDeadline = outbound?.requiredShipDate
    ? new Date(outbound.requiredShipDate)
  : null;
  const slaUrgent = Boolean(
    shipDeadline && !Number.isNaN(shipDeadline.getTime()) && shipDeadline.getTime() < Date.now(),
  );

  if (readOnly) {
    if (!reservations.length) {
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          No pick reservation snapshot is available for this task.
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <PickHeader
          orderNumber={outbound?.orderNumber}
          companyName={outbound?.company?.name}
          assignedWorkerLabel={assignedWorkerLabel}
          taskStatus={taskStatus}
          carrier={outbound?.carrier}
          shipDate={outbound?.requiredShipDate}
          warehouseId={warehouseId}
        />
        <SummaryCards summary={summary} />
        <PickTable
          drafts={drafts}
          lineMeta={lineMeta}
          allLocations={allLocations}
          lotNumberById={lotNumberById}
          readOnly
        />
      </div>
    );
  }

  if (!reservations.length) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        No pick reservations yet. Start the task to allocate inventory (FEFO/FIFO).
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      <PickHeader
        orderNumber={outbound?.orderNumber}
        companyName={outbound?.company?.name}
        assignedWorkerLabel={assignedWorkerLabel}
        taskStatus={taskStatus}
        carrier={outbound?.carrier}
        shipDate={outbound?.requiredShipDate}
        warehouseId={warehouseId}
        outboundHref={outboundOrderId ? `/orders/outbound/${outboundOrderId}` : undefined}
        slaUrgent={slaUrgent}
        createdAt={outbound?.createdAt}
      />

      {validationIssues.length > 0 ? (
        <Alert variant="warning" title="Picking validation">
          <ul className="mt-1 list-inside list-disc text-sm">
            {validationIssues.slice(0, 4).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {nextLoc && computePickLineStatus(drafts[nextIncompleteIndex]!) !== 'complete' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Next bin</p>
          <p className="font-mono text-2xl font-bold text-slate-900">{locationDisplay(nextLoc).shortLabel}</p>
          <p className="text-xs text-slate-600">{locationDisplay(nextLoc).fullPath}</p>
        </div>
      ) : null}

      <SummaryCards summary={summary} />

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drop-off (packing)</p>
        <p className="mt-1 text-xs text-slate-500">Where picked units are consolidated before pack task.</p>
        {packingLocations.length === 0 ? (
          <p className="mt-2 text-xs text-amber-800">No packing locations in this warehouse.</p>
        ) : (
          <div className="mt-2 space-y-2">
            <Combobox
              value={packingDestinationId}
              onChange={setPackingDestinationId}
              options={packingComboOptions}
              placeholder="Select packing location…"
              emptyMessage="No packing locations"
            />
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                placeholder="Packing location barcode"
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
                Apply
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPackingScanOpen(true)}>
                Scan
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Picking execution</p>
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

      {focusMode && activeDraft ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Pick {activeIndex + 1} of {drafts.length}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pickLineStatusClass(
                computePickLineStatus(activeDraft),
              )}`}
            >
              {pickLineStatusLabel(computePickLineStatus(activeDraft))}
            </span>
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{activeOl?.product?.name ?? '—'}</p>
          <p className="font-mono text-sm text-slate-500">{activeOl?.product?.sku}</p>

          <LocationHero loc={activeLoc} label="Source bin" />

          <div className="mt-4 rounded-xl border-2 border-emerald-400 bg-emerald-50/50 p-4">
            <p className="text-sm font-semibold text-emerald-900">{pickScanStepLabel(scanStep)}</p>
            <p className="mt-1 text-xs text-slate-600">
              Step {scanStep === 'location' ? 1 : scanStep === 'product' ? 2 : 3} of 3
            </p>
            {scanStep === 'quantity' ? (
              <div className="mt-3 flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[52px] min-w-[52px] text-xl"
                  onClick={() => {
                    const n = Math.max(0, parseQty(activeDraft.pickedQty) - 1);
                    patchDraft(activeDraft.rowKey, {
                      pickedQty: String(n),
                      exceptionType: n < parseQty(activeDraft.requiredQty) - 1e-6 ? 'short' : 'none',
                    });
                  }}
                >
                  −
                </Button>
                <input
                  type="text"
                  inputMode="decimal"
                  className="min-h-[52px] w-24 rounded-xl border-2 border-emerald-400 bg-white text-center font-mono text-2xl"
                  value={activeDraft.pickedQty}
                  onChange={(e) => {
                    const n = parseQty(e.target.value);
                    patchDraft(activeDraft.rowKey, {
                      pickedQty: e.target.value,
                      exceptionType:
                        n < parseQty(activeDraft.requiredQty) - 1e-6 ? 'short' : 'none',
                    });
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[52px] min-w-[52px] text-xl"
                  onClick={() => {
                    const n = parseQty(activeDraft.pickedQty) + 1;
                    patchDraft(activeDraft.rowKey, {
                      pickedQty: String(n),
                      exceptionType: n < parseQty(activeDraft.requiredQty) - 1e-6 ? 'short' : 'none',
                    });
                  }}
                >
                  +
                </Button>
                <span className="text-sm text-slate-500">/ {activeDraft.requiredQty}</span>
              </div>
            ) : (
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
            )}
            {scanFeedback ? (
              <p
                className={`mt-2 text-sm font-medium ${scanFeedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {scanFeedback.msg}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {(['location', 'product', 'quantity'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScanStep(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    scanStep === s ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {s === 'location' ? 'Bin' : s === 'product' ? 'Product' : 'Qty'}
                  {s === 'location' && activeDraft.locationVerified ? ' ✓' : ''}
                  {s === 'product' && activeDraft.productVerified ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={activeIndex <= 0}
              onClick={() => {
                setActiveIndex((i) => Math.max(0, i - 1));
                setScanStep('location');
                setScanFeedback(null);
              }}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                patchDraft(activeDraft.rowKey, { exceptionType: 'damaged', notes: 'Damaged stock reported' });
                toast.push('info', 'Damaged stock flagged on line — add details in exception note.');
              }}
            >
              Report damaged
            </Button>
            <Button
              type="button"
              disabled={activeIndex >= drafts.length - 1}
              onClick={() => {
                const st = computePickLineStatus(activeDraft);
                if (st === 'complete') {
                  setCollapsed((c) => new Set(c).add(activeDraft.rowKey));
                }
                setActiveIndex((i) => Math.min(drafts.length - 1, i + 1));
                setScanStep('location');
                setScanFeedback(null);
              }}
            >
              Next pick
            </Button>
          </div>
        </section>
      ) : null}

      {!focusMode ? (
        <PickTable
          drafts={drafts}
          lineMeta={lineMeta}
          allLocations={allLocations}
          lotNumberById={lotNumberById}
          onPatch={patchDraft}
        />
      ) : null}

      {focusMode ? (
        <div className="hidden md:block">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">All pick lines</h2>
          <PickTable
            drafts={drafts}
            lineMeta={lineMeta}
            allLocations={allLocations}
            lotNumberById={lotNumberById}
            onPatch={patchDraft}
          />
        </div>
      ) : null}

      {focusMode ? (
        <section className="space-y-2 md:hidden">
          <h2 className="text-sm font-semibold text-slate-800">Pick lines</h2>
          {drafts.map((d, i) => {
            if (collapsed.has(d.rowKey)) return null;
            const ol = lineMeta.get(d.outboundOrderLineId);
            const st = computePickLineStatus(d);
            const loc = allLocations.find((l) => l.id === d.locationId);
            return (
              <button
                key={d.rowKey}
                type="button"
                onClick={() => {
                  setActiveIndex(i);
                  setFocusMode(true);
                  setScanStep('location');
                }}
                className="w-full rounded-xl border border-slate-100 bg-white p-3 text-start shadow-sm"
              >
                <p className="font-mono text-xs text-emerald-800">{locationDisplay(loc).shortLabel}</p>
                <p className="font-medium text-slate-900">{ol?.product?.name}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${pickLineStatusClass(st)}`}>
                  {pickLineStatusLabel(st)}
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
                    exceptionType: 'short',
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
            Complete picking
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

function PickHeader({
  orderNumber,
  companyName,
  assignedWorkerLabel,
  taskStatus,
  carrier,
  shipDate,
  warehouseId,
  outboundHref,
  slaUrgent,
  createdAt,
}: {
  orderNumber?: string;
  companyName?: string;
  assignedWorkerLabel: string;
  taskStatus: string;
  carrier?: string | null;
  shipDate?: string;
  warehouseId: string;
  outboundHref?: string;
  slaUrgent?: boolean;
  createdAt?: string;
}) {
  return (
    <header className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Outbound pick</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {orderNumber ? (
              outboundHref ? (
                <Link to={outboundHref} className="hover:text-emerald-700">
                  {orderNumber}
                </Link>
              ) : (
                orderNumber
              )
            ) : (
              'Pick task'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{companyName ?? '—'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {taskStatus.replace(/_/g, ' ')}
          </span>
          {slaUrgent ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
              Ship date passed
            </span>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Picker</dt>
          <dd className="font-medium text-slate-900">{assignedWorkerLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Carrier</dt>
          <dd className="text-slate-800">{carrier?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ship by</dt>
          <dd className="font-mono text-xs text-slate-800">
            {shipDate ? new Date(shipDate).toLocaleDateString() : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Warehouse</dt>
          <dd className="font-mono text-xs text-slate-800">{warehouseId.slice(0, 8)}…</dd>
        </div>
      </dl>
      {createdAt ? (
        <p className="mt-2 text-[10px] text-slate-400">
          Order created {new Date(createdAt).toLocaleString()}
        </p>
      ) : null}
    </header>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof computePickSummary> }) {
  const cards = [
    { label: 'SKUs', value: String(summary.totalSkus) },
    { label: 'Units', value: String(summary.totalUnits) },
    { label: 'Done', value: String(summary.completedPicks), accent: true },
    { label: 'Remaining', value: String(summary.remainingPicks) },
    { label: 'Bins', value: String(summary.uniqueLocations) },
    { label: 'Complete', value: `${summary.completionPct}%` },
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

function LocationHero({ loc, label }: { loc?: Location; label: string }) {
  const d = locationDisplay(loc);
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold text-slate-900">{d.shortLabel}</p>
      {d.segments.length > 1 ? (
        <p className="mt-1 text-sm text-slate-600">{d.segments.join(' › ')}</p>
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

function PickTable({
  drafts,
  lineMeta,
  allLocations,
  lotNumberById,
  readOnly,
  onPatch,
}: {
  drafts: PickLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  allLocations: Location[];
  lotNumberById: Map<string, string>;
  readOnly?: boolean;
  onPatch?: (rowKey: string, patch: Partial<PickLineDraft>) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="min-w-[1100px] w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <th className="px-3 py-3">SKU</th>
            <th className="px-3 py-3">Product</th>
            <th className="px-3 py-3">Barcode</th>
            <th className="px-3 py-3">Source bin</th>
            <th className="px-3 py-3">Lot</th>
            <th className="px-3 py-3">Required</th>
            <th className="px-3 py-3">Picked</th>
            <th className="px-3 py-3">Remaining</th>
            <th className="px-3 py-3">Scan</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => {
            const ol = lineMeta.get(d.outboundOrderLineId);
            const loc = allLocations.find((l) => l.id === d.locationId);
            const required = parseQty(d.requiredQty);
            const picked = parseQty(d.pickedQty);
            const remaining = Math.max(0, required - picked);
            const st = computePickLineStatus(d);
            const scanBits = [
              d.locationVerified ? 'L✓' : 'L—',
              d.productVerified ? 'P✓' : 'P—',
            ].join(' ');
            const lotNum = d.lotId ? lotNumberById.get(d.lotId) ?? `${d.lotId.slice(0, 8)}…` : '—';
            return (
              <tr key={d.rowKey} className="border-b border-slate-100 align-top">
                <td className="px-3 py-3 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                <td className="px-3 py-3 text-xs font-medium">{ol?.product?.name ?? '—'}</td>
                <td className="px-3 py-3 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                <td className="px-3 py-3">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {locationDisplay(loc).shortLabel}
                  </span>
                  <p className="text-[10px] text-slate-500">{locationDisplay(loc).fullPath}</p>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{lotNum}</td>
                <td className="px-3 py-3 font-mono text-xs">{d.requiredQty}</td>
                <td className="px-3 py-3">
                  {readOnly ? (
                    d.pickedQty
                  ) : (
                    <input
                      className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                      value={d.pickedQty}
                      onChange={(e) => {
                        const n = parseQty(e.target.value);
                        onPatch?.(d.rowKey, {
                          pickedQty: e.target.value,
                          exceptionType:
                            n < parseQty(d.requiredQty) - 1e-6 ? 'short' : 'none',
                        });
                      }}
                    />
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-slate-600">{remaining}</td>
                <td className="px-3 py-3 font-mono text-[10px]">{scanBits}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pickLineStatusClass(st)}`}>
                    {pickLineStatusLabel(st)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
