import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';

import { InboundApi, type InboundOrderLine } from '../../../api/inbound';
import { LocationsApi } from '../../../api/locations';
import { ProductsApi } from '../../../api/products';
import { TasksApi } from '../../../api/tasks';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/ToastProvider';
import { QK } from '../../../constants/query-keys';
import { Alert } from '@ds';
import { ProductAttributeValidationCard } from './ProductAttributeValidationCard';
import type {
  LineReceiveDraft,
  ProductAttributeDraft,
  ReceivingExecutionDraft,
  ReceivingLineRow,
} from './receiving-types';
import {
  buildDiscrepancyNotes,
  computeLineStatus,
  computeReceivingSummary,
  isLikelyFirstInbound,
  lineStatusClass,
  lineStatusLabel,
  matchScanToLine,
  parseQty,
  receivingExpectedLotDisplay,
} from './receiving-utils';

function emptyLineDraft(): LineReceiveDraft {
  return { receivedQty: '', damagedQty: '', notes: '', expiry: '' };
}

function emptyAttributeDraft(product?: {
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  weightKg?: string | number | null;
}): ProductAttributeDraft {
  return {
    lengthCm: product?.lengthCm != null ? String(product.lengthCm) : '',
    widthCm: product?.widthCm != null ? String(product.widthCm) : '',
    heightCm: product?.heightCm != null ? String(product.heightCm) : '',
    weightKg: product?.weightKg != null ? String(product.weightKg) : '',
    confirmedMatch: false,
    notes: '',
    completed: false,
  };
}

function readExecutionDraft(raw: unknown): ReceivingExecutionDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const recv = r.receiving_draft ?? r.receivingDraft;
  if (!recv || typeof recv !== 'object') return null;
  return recv as ReceivingExecutionDraft;
}

type Props = {
  taskId: string;
  lines: ReceivingLineRow[];
  inboundOrderId?: string;
  warehouseId: string;
  companyIdOverride?: string;
  taskOperatorNotes: string;
  assignedWorkerLabel: string;
  taskStatus: string;
  executionState?: unknown;
  submit: (body: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
};

export function ReceivingExecutionPanel({
  taskId,
  lines,
  inboundOrderId,
  warehouseId,
  companyIdOverride,
  taskOperatorNotes: _taskOperatorNotes,
  assignedWorkerLabel,
  taskStatus,
  executionState,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const [scanValue, setScanValue] = useState('');
  const [highlightLineId, setHighlightLineId] = useState<string | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [issueBanner, setIssueBanner] = useState<string | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueText, setIssueText] = useState('');

  const initialDraft = readExecutionDraft(executionState);
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineReceiveDraft>>(() => {
    const base: Record<string, LineReceiveDraft> = {};
    for (const l of lines) {
      const lid = l.inbound_order_line_id;
      base[lid] = initialDraft?.lines?.[lid] ?? emptyLineDraft();
    }
    return base;
  });
  const [attrDrafts, setAttrDrafts] = useState<Record<string, ProductAttributeDraft>>(
    () => initialDraft?.attributes ?? {},
  );

  const inbound = useQuery({
    queryKey: [...QK.inboundOrders, inboundOrderId ?? ''],
    queryFn: () => InboundApi.get(inboundOrderId!),
    enabled: !!inboundOrderId,
  });

  const locationsForDock = useQuery({
    queryKey: [...QK.locationsFlatAll(false), warehouseId, 'recv-dock'],
    queryFn: () => LocationsApi.list(warehouseId, false),
    enabled: !!warehouseId && lines.length > 0,
  });

  const priorInbound = useQuery({
    queryKey: [...QK.inboundOrders, 'prior', inbound.data?.companyId],
    queryFn: () =>
      InboundApi.list({
        companyId: inbound.data!.companyId,
        limit: 200,
      }),
    enabled: !!inbound.data?.companyId,
  });

  const lineMap = useMemo(() => {
    const m = new Map<string, InboundOrderLine>();
    for (const ol of inbound.data?.lines ?? []) m.set(ol.id, ol);
    return m;
  }, [inbound.data?.lines]);

  const productIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of lines) {
      const ol = lineMap.get(l.inbound_order_line_id);
      if (ol?.productId) ids.add(ol.productId);
    }
    return [...ids];
  }, [lines, lineMap]);

  const productQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['products', id, 'receiving-exec'],
      queryFn: () => ProductsApi.get(id),
      enabled: productIds.length > 0,
    })),
  });

  const lotsQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['products', id, 'lots', 'receiving-first'],
      queryFn: () => ProductsApi.listLots(id),
      enabled: productIds.length > 0,
    })),
  });

  const productsById = useMemo(() => {
    const m = new Map<string, (typeof productQueries)[0]['data']>();
    productIds.forEach((id, i) => {
      const p = productQueries[i]?.data;
      if (p) m.set(id, p);
    });
    return m;
  }, [productIds, productQueries]);

  const firstInboundProductIds = useMemo(() => {
    const orders = priorInbound.data?.items ?? [];
    const out: string[] = [];
    productIds.forEach((pid, i) => {
      const product = productsById.get(pid);
      const lots = lotsQueries[i]?.data ?? [];
      if (
        isLikelyFirstInbound(pid, product, lots.length, orders, inboundOrderId ?? '')
      ) {
        out.push(pid);
      }
    });
    return out;
  }, [productIds, productsById, lotsQueries, priorInbound.data, inboundOrderId]);

  const dockPath = useMemo(() => {
    const sid = lines[0]?.staging_location_id?.trim();
    if (!sid) return '—';
    const loc = (locationsForDock.data ?? []).find((x) => x.id === sid);
    return loc ? `${loc.fullPath}${loc.barcode ? ` · ${loc.barcode}` : ''}` : sid.slice(0, 8) + '…';
  }, [lines, locationsForDock.data]);

  const summary = useMemo(
    () => computeReceivingSummary(lines, lineDrafts),
    [lines, lineDrafts],
  );

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    for (const row of lines) {
      const lid = row.inbound_order_line_id;
      const expected = parseQty(row.expected_qty);
      const d = lineDrafts[lid] ?? emptyLineDraft();
      const received = parseQty(d.receivedQty);
      const damaged = parseQty(d.damagedQty);
      const status = computeLineStatus(expected, received, damaged);
      if (status === 'overage') issues.push(`Overage on line ${lid.slice(0, 8)}…`);
      if (status === 'shortage' && received + damaged > 0) issues.push(`Shortage on ${olLabel(lineMap, lid)}`);
    }
    for (const pid of firstInboundProductIds) {
      const ad = attrDrafts[pid];
      if (!ad?.completed) {
        const p = productsById.get(pid);
        issues.push(`Attribute validation required: ${p?.sku ?? pid.slice(0, 8)}`);
      }
    }
    return issues;
  }, [lines, lineDrafts, lineMap, firstInboundProductIds, attrDrafts, productsById]);

  function olLabel(map: Map<string, InboundOrderLine>, lid: string): string {
    return map.get(lid)?.product?.sku ?? lid.slice(0, 8);
  }

  const saveProgress = useMutation({
    mutationFn: () =>
      TasksApi.patchProgress(
        taskId,
        {
          receiving_draft: {
            lines: lineDrafts,
            attributes: attrDrafts,
          } satisfies ReceivingExecutionDraft,
        },
        companyIdOverride,
      ),
    onSuccess: () => toast.success('Progress saved'),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!readOnly) scanRef.current?.focus();
  }, [readOnly, lines.length]);

  useEffect(() => {
    if (!highlightLineId) return;
    const t = window.setTimeout(() => setHighlightLineId(null), 2500);
    return () => window.clearTimeout(t);
  }, [highlightLineId]);

  const applyScan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.code === code.toLowerCase() &&
        now - lastScanRef.current.at < 1500
      ) {
        setScanFeedback({ type: 'err', msg: 'Duplicate scan — wait a moment.' });
        return;
      }
      lastScanRef.current = { code: code.toLowerCase(), at: now };

      const hit = matchScanToLine(code, lines, lineMap);
      if (!hit) {
        setScanFeedback({ type: 'err', msg: `No matching product for “${code}”.` });
        return;
      }

      setHighlightLineId(hit.lineId);
      setLineDrafts((prev) => {
        const cur = prev[hit.lineId] ?? emptyLineDraft();
        const nextReceived = parseQty(cur.receivedQty) + 1;
        return {
          ...prev,
          [hit.lineId]: { ...cur, receivedQty: String(nextReceived) },
        };
      });
      setScanFeedback({
        type: 'ok',
        msg: `${hit.orderLine?.product?.name ?? 'Product'} +1`,
      });
      setScanValue('');
      scanRef.current?.focus();
    },
    [lines, lineMap],
  );

  function patchLine(lid: string, patch: Partial<LineReceiveDraft>) {
    setLineDrafts((prev) => ({
      ...prev,
      [lid]: { ...(prev[lid] ?? emptyLineDraft()), ...patch },
    }));
  }

  function handleComplete(e: FormEvent) {
    e.preventDefault();
    if (validationIssues.length > 0) {
      toast.error('Resolve validation issues before completing.');
      return;
    }

    for (const pl of lines) {
      const lid = pl.inbound_order_line_id;
      const ol = lineMap.get(lid);
      if (!ol || ol.product?.trackingType !== 'lot') continue;
      if (!ol.expectedLotNumber?.trim()) {
        toast.error(
          `Missing expected lot on inbound line for ${ol.product?.sku ?? 'lot-tracked product'}.`,
        );
        return;
      }
    }

    const hasShortage = lines.some((l) => {
      const expected = parseQty(l.expected_qty);
      const d = lineDrafts[l.inbound_order_line_id] ?? emptyLineDraft();
      return parseQty(d.receivedQty) + parseQty(d.damagedQty) < expected;
    });
    const hasDamage = lines.some((l) => parseQty((lineDrafts[l.inbound_order_line_id] ?? emptyLineDraft()).damagedQty) > 0);

    submit({
      task_type: 'receiving',
      allow_short_close: hasShortage,
      ...(hasShortage || hasDamage
        ? { short_close_reason_code: hasDamage ? 'damage' : 'not_found' }
        : {}),
      lines: lines.map((l) => {
        const lid = l.inbound_order_line_id;
        const ol = lineMap.get(lid);
        const d = lineDrafts[lid] ?? emptyLineDraft();
        const lotPayload =
          ol?.product?.trackingType === 'lot' && ol.expectedLotNumber?.trim()
            ? { capture_lot_number: ol.expectedLotNumber.trim() }
            : {};
        const attr = ol?.productId ? attrDrafts[ol.productId] : undefined;
        const attrNote =
          attr?.completed && attr.notes.trim()
            ? `attr-validated:${attr.notes.trim()}`
            : attr?.completed
              ? 'attr-validated:match'
              : '';
        const disc = buildDiscrepancyNotes(d);
        const mergedDisc = [disc, attrNote].filter(Boolean).join(' · ');
        return {
          inbound_order_line_id: lid,
          received_qty: (d.receivedQty ?? '0').trim() || '0',
          ...lotPayload,
          ...(mergedDisc ? { discrepancy_notes: mergedDisc } : {}),
        };
      }),
    });
  }

  const arrivalLabel = inbound.data?.expectedArrivalDate
    ? new Date(inbound.data.expectedArrivalDate).toLocaleString()
    : '—';

  const isUrgent =
    inbound.data?.expectedArrivalDate &&
    new Date(inbound.data.expectedArrivalDate).getTime() < Date.now();

  if (readOnly) {
    return (
      <div className="space-y-4">
        <ReceivingHeader
          orderNumber={inbound.data?.orderNumber}
          companyName={inbound.data?.company?.name}
          dockPath={dockPath}
          assignedWorkerLabel={assignedWorkerLabel}
          arrivalLabel={arrivalLabel}
          taskStatus={taskStatus}
          isUrgent={!!isUrgent}
          notes={inbound.data?.notes}
        />
        <SummaryCards summary={summary} />
        <div className="-mx-1 overflow-x-auto overscroll-x-contain">
          <ReceivingTable
            lines={lines}
            lineMap={lineMap}
            lineDrafts={lineDrafts}
            highlightLineId={null}
            readOnly
          />
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      <ReceivingHeader
        orderNumber={inbound.data?.orderNumber}
        companyName={inbound.data?.company?.name}
        dockPath={dockPath}
        assignedWorkerLabel={assignedWorkerLabel}
        arrivalLabel={arrivalLabel}
        taskStatus={taskStatus}
        isUrgent={!!isUrgent}
        notes={inbound.data?.notes}
        inboundHref={inboundOrderId ? `/orders/inbound/${inboundOrderId}` : undefined}
      />

      {validationIssues.length > 0 ? (
        <Alert variant="warning" title="Validation attention needed">
          <ul className="mt-1 list-inside list-disc text-sm">
            {validationIssues.slice(0, 5).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {issueBanner ? (
        <Alert
          variant="info"
          title="Issue reported"
          description={issueBanner}
          onDismiss={() => setIssueBanner(null)}
        />
      ) : null}

      <SummaryCards summary={summary} />

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Scan to receive</p>
        <p className="mt-1 text-sm text-slate-600">
          Scan product barcode or SKU — matching line highlights and quantity increments.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            ref={scanRef}
            type="text"
            inputMode="none"
            autoComplete="off"
            className="min-h-[52px] flex-1 rounded-xl border-2 border-emerald-400 bg-white px-4 text-lg font-mono shadow-inner outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            placeholder="Scan barcode…"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyScan(scanValue);
              }
            }}
            aria-label="Barcode scan input"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              className="min-h-[52px] flex-1 sm:flex-none"
              onClick={() => applyScan(scanValue)}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[52px] flex-1 sm:flex-none"
              onClick={() => setScanModalOpen(true)}
            >
              Camera
            </Button>
          </div>
        </div>
        {scanFeedback ? (
          <p
            className={`mt-2 text-sm font-medium ${scanFeedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}
            role="status"
          >
            {scanFeedback.msg}
          </p>
        ) : null}
      </section>

      {firstInboundProductIds.map((pid) => {
        const product = productsById.get(pid);
        if (!product) return null;
        const draft = attrDrafts[pid] ?? emptyAttributeDraft(product);
        return (
          <ProductAttributeValidationCard
            key={pid}
            product={product}
            draft={draft}
            onChange={(patch) =>
              setAttrDrafts((prev) => ({
                ...prev,
                [pid]: { ...(prev[pid] ?? emptyAttributeDraft(product)), ...patch },
              }))
            }
            onConfirm={() => {
              setAttrDrafts((prev) => ({
                ...prev,
                [pid]: { ...(prev[pid] ?? emptyAttributeDraft(product)), completed: true },
              }));
              toast.success(`Attributes validated for ${product.sku}`);
            }}
          />
        );
      })}

      <section className="space-y-3 md:hidden">
        <h2 className="text-sm font-semibold text-slate-800">Receive lines</h2>
        {lines.map((l) => {
          const lid = l.inbound_order_line_id;
          const ol = lineMap.get(lid);
          const d = lineDrafts[lid] ?? emptyLineDraft();
          const expected = parseQty(l.expected_qty);
          const status = computeLineStatus(expected, parseQty(d.receivedQty), parseQty(d.damagedQty));
          const highlighted = highlightLineId === lid;
          return (
            <div
              key={lid}
              className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                highlighted ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{ol?.product?.name ?? '—'}</p>
                  <p className="font-mono text-xs text-slate-500">{ol?.product?.sku}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(status)}`}>
                  {lineStatusLabel(status)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Expected</span>
                  <p className="font-mono font-medium">{l.expected_qty}</p>
                </div>
                <div>
                  <span className="text-slate-500">Received</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-mono"
                    value={d.receivedQty}
                    onChange={(e) => patchLine(lid, { receivedQty: e.target.value })}
                  />
                </div>
                <div>
                  <span className="text-slate-500">Damaged</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-mono"
                    value={d.damagedQty}
                    onChange={(e) => patchLine(lid, { damagedQty: e.target.value })}
                  />
                </div>
                <div>
                  <span className="text-slate-500">Missing</span>
                  <p className="font-mono font-medium text-slate-700">
                    {Math.max(0, expected - parseQty(d.receivedQty) - parseQty(d.damagedQty))}
                  </p>
                </div>
              </div>
              {ol?.product?.expiryTracking ? (
                <label className="mt-2 block text-xs text-slate-600">
                  Expiry
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    value={d.expiry}
                    onChange={(e) => patchLine(lid, { expiry: e.target.value })}
                  />
                </label>
              ) : null}
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
                placeholder="Line notes / damage detail"
                value={d.notes}
                onChange={(e) => patchLine(lid, { notes: e.target.value })}
              />
            </div>
          );
        })}
      </section>

      <section className="hidden md:block">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Receive lines</h2>
        <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-100 bg-white shadow-sm">
          <ReceivingTable
            lines={lines}
            lineMap={lineMap}
            lineDrafts={lineDrafts}
            highlightLineId={highlightLineId}
            onPatchLine={patchLine}
          />
        </div>
      </section>

      {showIssueForm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-800">Report issue</p>
          <textarea
            className="mt-2 min-h-[80px] w-full rounded-lg border border-slate-300 p-2 text-sm"
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            placeholder="Describe shortage, damage, wrong SKU…"
          />
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const msg = issueText.trim();
                if (msg) {
                  setIssueBanner(msg);
                  void saveProgress.mutate();
                }
                setShowIssueForm(false);
                setIssueText('');
              }}
            >
              Save issue note
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowIssueForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
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
            Report issue
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            Complete receiving
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-slate-500 sm:text-start">
          Completing stages inventory at the dock and unlocks putaway.
        </p>
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

function ReceivingHeader({
  orderNumber,
  companyName,
  dockPath,
  assignedWorkerLabel,
  arrivalLabel,
  taskStatus,
  isUrgent,
  notes,
  inboundHref,
}: {
  orderNumber?: string;
  companyName?: string;
  dockPath: string;
  assignedWorkerLabel: string;
  arrivalLabel: string;
  taskStatus: string;
  isUrgent: boolean;
  notes?: string | null;
  inboundHref?: string;
}) {
  return (
    <header className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Receiving</p>
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
              'Inbound shipment'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{companyName ?? '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {taskStatus.replace(/_/g, ' ')}
          </span>
          {isUrgent ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              SLA · due
            </span>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Dock</dt>
          <dd className="font-medium text-slate-900">{dockPath}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Worker</dt>
          <dd className="font-medium text-slate-900">{assignedWorkerLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Expected arrival</dt>
          <dd className="font-medium text-slate-900">{arrivalLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Notes</dt>
          <dd className="text-slate-700">{notes?.trim() || '—'}</dd>
        </div>
      </dl>
    </header>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof computeReceivingSummary> }) {
  const cards = [
    { label: 'SKUs', value: String(summary.totalSkus) },
    { label: 'Expected', value: String(summary.expectedTotal) },
    { label: 'Received', value: String(summary.receivedTotal), accent: true },
    { label: 'Damaged', value: String(summary.damagedTotal) },
    { label: 'Remaining', value: String(summary.remainingTotal) },
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

function ReceivingTable({
  lines,
  lineMap,
  lineDrafts,
  highlightLineId,
  readOnly,
  onPatchLine,
}: {
  lines: ReceivingLineRow[];
  lineMap: Map<string, InboundOrderLine>;
  lineDrafts: Record<string, LineReceiveDraft>;
  highlightLineId: string | null;
  readOnly?: boolean;
  onPatchLine?: (lid: string, patch: Partial<LineReceiveDraft>) => void;
}) {
  return (
    <table className="min-w-[960px] w-full text-left text-sm">
      <thead>
        <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
          <th className="px-4 py-3">Product</th>
          <th className="px-4 py-3">SKU</th>
          <th className="px-4 py-3">Barcode</th>
          <th className="px-4 py-3">Lot</th>
          <th className="px-4 py-3">Expected</th>
          <th className="px-4 py-3">Received</th>
          <th className="px-4 py-3">Damaged</th>
          <th className="px-4 py-3">Missing</th>
          <th className="px-4 py-3">Status</th>
          {!readOnly ? <th className="px-4 py-3">Notes</th> : null}
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          const lid = l.inbound_order_line_id;
          const ol = lineMap.get(lid);
          const d = lineDrafts[lid] ?? emptyLineDraft();
          const expected = parseQty(l.expected_qty);
          const received = parseQty(d.receivedQty);
          const damaged = parseQty(d.damagedQty);
          const missing = Math.max(0, expected - received - damaged);
          const status = computeLineStatus(expected, received, damaged);
          const hi = highlightLineId === lid;
          return (
            <tr
              key={lid}
              className={`border-b border-slate-100 ${hi ? 'bg-emerald-50' : ''}`}
            >
              <td className="px-4 py-3 text-xs font-medium">{ol?.product?.name ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-xs">{receivingExpectedLotDisplay(ol)}</td>
              <td className="px-4 py-3 font-mono">{l.expected_qty}</td>
              <td className="px-4 py-3">
                {readOnly ? (
                  <span className="font-mono">{d.receivedQty || '—'}</span>
                ) : (
                  <input
                    className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                    value={d.receivedQty}
                    onChange={(e) => onPatchLine?.(lid, { receivedQty: e.target.value })}
                  />
                )}
              </td>
              <td className="px-4 py-3">
                {readOnly ? (
                  <span className="font-mono">{d.damagedQty || '—'}</span>
                ) : (
                  <input
                    className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                    value={d.damagedQty}
                    onChange={(e) => onPatchLine?.(lid, { damagedQty: e.target.value })}
                  />
                )}
              </td>
              <td className="px-4 py-3 font-mono">{missing}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(status)}`}>
                  {lineStatusLabel(status)}
                </span>
              </td>
              {!readOnly ? (
                <td className="px-4 py-3">
                  <input
                    className="min-w-[120px] rounded border border-slate-300 px-2 py-1 text-xs"
                    value={d.notes}
                    onChange={(e) => onPatchLine?.(lid, { notes: e.target.value })}
                  />
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
