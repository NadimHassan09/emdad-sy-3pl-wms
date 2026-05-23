import { useQueries, useQuery } from '@tanstack/react-query';
import { useTaskProgressSave } from '../../../hooks/useTaskProgressSave';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { InboundApi, type InboundOrderLine } from '../../../api/inbound';
import { Column, DataTable } from '../../../components/DataTable';
import { TaskDetailsCard } from '../../../components/tasks/TaskDetailsCard';
import { formatTaskDateTime, inboundOrderTitle } from '../../../lib/task-details-helpers';
import { taskTypeIconClass } from '../../../lib/task-type-icons';
import { taskTypeTitle } from '../../../workflow/task-ui-matrix';
import { LocationsApi } from '../../../api/locations';
import { ProductsApi } from '../../../api/products';
import { AnchoredDropdown } from '../../../components/AnchoredDropdown';
import { Button } from '../../../components/Button';
import { TaskLinesFilterCard } from '../../../components/tasks/TaskLinesFilterCard';
import { useToast } from '../../../components/ToastProvider';
import { QK } from '../../../constants/query-keys';
import { Alert } from '@ds';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { ProductSpecsValidationModal } from './ProductSpecsValidationModal';
import type {
  LineReceiveDraft,
  ProductAttributeDraft,
  ReceivingExecutionDraft,
  ReceivingLineFilters,
  ReceivingLineRow,
  ReceivingLineStatus,
} from './receiving-types';
import { DEFAULT_RECEIVING_LINE_FILTERS } from './receiving-types';
import type { Product, ProductLot } from '../../../api/products';
import {
  buildDiscrepancyNotes,
  computeLineStatus,
  computeReceivingSummary,
  filterReceivingLines,
  isLikelyFirstInbound,
  lineDraftFromInboundOrderLine,
  lineStatusClass,
  lineStatusLabel,
  parseQty,
  productRequiresExpiry,
  receivingExpectedLotDisplay,
  resolveLineExpiryDisplay,
} from './receiving-utils';
import { buildReceivingPrintInput, openReceivingPrintPdf } from './receiving-print';

function emptyLineDraft(): LineReceiveDraft {
  return { receivedQty: '', damagedQty: '', notes: '', expiry: '' };
}

function lineDraftForOrderLine(
  ol: InboundOrderLine | undefined,
  saved?: LineReceiveDraft,
  lots?: ProductLot[],
): LineReceiveDraft {
  const base = saved ?? emptyLineDraft();
  if (base.expiry.trim()) return base;
  const resolved = resolveLineExpiryDisplay(ol, base, lots);
  return resolved ? { ...base, expiry: resolved } : base;
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
  showExportPdf?: boolean;
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
  taskOperatorNotes,
  showExportPdf = true,
  assignedWorkerLabel,
  taskStatus,
  executionState,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const toast = useToast();
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const [openLineActionId, setOpenLineActionId] = useState<string | null>(null);
  const [specsModalProductId, setSpecsModalProductId] = useState<string | null>(null);
  const [draftLineFilters, setDraftLineFilters] = useState<ReceivingLineFilters>(
    DEFAULT_RECEIVING_LINE_FILTERS,
  );
  const [appliedLineFilters, setAppliedLineFilters] = useState<ReceivingLineFilters>(
    DEFAULT_RECEIVING_LINE_FILTERS,
  );

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

  const lotsByProductId = useMemo(() => {
    const m = new Map<string, ProductLot[]>();
    productIds.forEach((id, i) => {
      const lots = lotsQueries[i]?.data;
      if (lots) m.set(id, lots);
    });
    return m;
  }, [productIds, lotsQueries]);

  useEffect(() => {
    const orderLines = inbound.data?.lines;
    if (!orderLines?.length) return;
    setLineDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const ol of orderLines) {
        const cur = next[ol.id] ?? emptyLineDraft();
        const lots = lotsByProductId.get(ol.productId);
        if (readOnly) {
          const hydrated = lineDraftFromInboundOrderLine(ol, lots);
          if (
            hydrated.receivedQty !== cur.receivedQty ||
            hydrated.damagedQty !== cur.damagedQty ||
            hydrated.expiry !== cur.expiry ||
            hydrated.notes !== cur.notes
          ) {
            next[ol.id] = hydrated;
            changed = true;
          }
          continue;
        }
        if (
          parseQty(cur.receivedQty) === 0 &&
          parseQty(ol.receivedQuantity) > 0
        ) {
          next[ol.id] = lineDraftFromInboundOrderLine(ol, lots);
          changed = true;
          continue;
        }
        if (!cur.expiry.trim()) {
          const withExpiry = lineDraftForOrderLine(ol, cur, lots);
          if (withExpiry.expiry !== cur.expiry) {
            next[ol.id] = withExpiry;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [inbound.data?.lines, readOnly, lotsByProductId]);

  const filteredLines = useMemo(
    () => filterReceivingLines(lines, appliedLineFilters, lineMap, lineDrafts),
    [lines, appliedLineFilters, lineMap, lineDrafts],
  );

  const lineExpiryByLineId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const row of lines) {
      const lid = row.inbound_order_line_id;
      const ol = lineMap.get(lid);
      const d = lineDrafts[lid] ?? emptyLineDraft();
      const lots = ol?.productId ? lotsByProductId.get(ol.productId) : undefined;
      m[lid] = resolveLineExpiryDisplay(ol, d, lots);
    }
    return m;
  }, [lines, lineMap, lineDrafts, lotsByProductId]);

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

  const firstInboundProductIdSet = useMemo(
    () => new Set(firstInboundProductIds),
    [firstInboundProductIds],
  );

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
      const ol = lineMap.get(lid);
      const lots = ol?.productId ? lotsByProductId.get(ol.productId) : undefined;
      if (
        productRequiresExpiry(ol, ol?.productId ? productsById.get(ol.productId) : undefined) &&
        received + damaged > 0 &&
        !resolveLineExpiryDisplay(ol, d, lots).trim()
      ) {
        issues.push(`Expiry date required for ${olLabel(lineMap, lid)}`);
      }
    }
    return issues;
  }, [lines, lineDrafts, lineMap, lotsByProductId, productsById]);

  function olLabel(map: Map<string, InboundOrderLine>, lid: string): string {
    return map.get(lid)?.product?.sku ?? lid.slice(0, 8);
  }

  const saveProgress = useTaskProgressSave({
    taskId,
    warehouseId,
    inboundOrderId,
    companyIdOverride,
  });

  function patchLine(lid: string, patch: Partial<LineReceiveDraft>) {
    setLineDrafts((prev) => ({
      ...prev,
      [lid]: { ...(prev[lid] ?? emptyLineDraft()), ...patch },
    }));
  }

  useEffect(() => {
    if (!openLineActionId) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('[data-receiving-line-action-trigger="true"]') ||
        target.closest('[data-receiving-line-action-menu="true"]') ||
        target.closest('[data-receiving-line-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenLineActionId(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openLineActionId]);

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

  const arrivalLabel = formatTaskDateTime(inbound.data?.expectedArrivalDate);

  const handleExportPrint = () => {
    if (lines.length === 0) {
      toast.error('No lines to export.');
      return;
    }
    const ok = openReceivingPrintPdf(
      buildReceivingPrintInput({
        orderNumber: inbound.data?.orderNumber ?? inboundOrderId ?? '—',
        companyName: inbound.data?.company?.name ?? '—',
        operatorNotes: taskOperatorNotes,
        assignedWorker: assignedWorkerLabel,
        expectedArrival: arrivalLabel,
        firstInboundProductIds,
        productsById,
        lines,
        lineMap,
        lineDrafts,
        locations: locationsForDock.data ?? [],
      }),
    );
    if (!ok) toast.error('Allow pop-ups to print or save as PDF.');
  };

  const receivingDetailsCard = (
    <TaskDetailsCard
      taskTypeLabel={taskTypeTitle('receiving')}
      iconClass={taskTypeIconClass('receiving')}
      primaryTitle={inboundOrderTitle(
        inbound.data?.orderNumber,
        inboundOrderId ? `/orders/inbound/${inboundOrderId}` : undefined,
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
          label: 'Dock',
          value: dockPath,
        },
        {
          iconClass: 'fa-solid fa-calendar',
          label: 'Expected arrival',
          value: arrivalLabel,
        },
      ]}
      summary={inbound.data?.notes ?? undefined}
    />
  );

  const lineFiltersCard = (
    <TaskLinesFilterCard
      draft={draftLineFilters}
      onDraftChange={(next) =>
        setDraftLineFilters({
          search: next.search,
          status: (next.status || '') as ReceivingLineFilters['status'],
        })
      }
      onApply={() => setAppliedLineFilters({ ...draftLineFilters })}
      onReset={() => {
        setDraftLineFilters(DEFAULT_RECEIVING_LINE_FILTERS);
        setAppliedLineFilters(DEFAULT_RECEIVING_LINE_FILTERS);
      }}
      onBarcodeScan={(code) => {
        const next: ReceivingLineFilters = {
          ...draftLineFilters,
          search: code.trim(),
        };
        setDraftLineFilters(next);
        setAppliedLineFilters(next);
      }}
      resultCount={filteredLines.length}
      totalCount={lines.length}
      statusOptions={RECEIVING_LINE_STATUS_OPTIONS}
      searchPlaceholder="SKU, product name, barcode, or lot"
    />
  );

  if (readOnly) {
    return (
      <div className="space-y-4">
        {receivingDetailsCard}
        <SummaryCards summary={summary} />
        {lineFiltersCard}
        <ReceivingLinesTable
          lines={filteredLines}
          totalLineCount={lines.length}
          lineMap={lineMap}
          lineDrafts={lineDrafts}
          lineExpiryByLineId={lineExpiryByLineId}
          productsById={productsById}
          firstInboundProductIdSet={firstInboundProductIdSet}
          onExportPrint={showExportPdf ? handleExportPrint : undefined}
          readOnly
        />
      </div>
    );
  }

  return (
    <form className="w-full min-w-0 space-y-4 pb-32" onSubmit={handleComplete}>
      {receivingDetailsCard}

      {validationIssues.length > 0 ? (
        <Alert variant="warning" title="Validation attention needed">
          <ul className="mt-1 list-inside list-disc text-sm">
            {validationIssues.slice(0, 5).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <SummaryCards summary={summary} />
      {showExportPdf && !isMdUp ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={lines.length === 0}
            onClick={handleExportPrint}
          >
            Export PDF
          </Button>
        </div>
      ) : null}

      {lineFiltersCard}

      {!isMdUp ? (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Receive lines</h2>
        {filteredLines.length === 0 ? (
          <p className="rounded-xl border border-slate-100 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
            No lines match the current filters.
          </p>
        ) : null}
        {filteredLines.map((l) => {
          const lid = l.inbound_order_line_id;
          const ol = lineMap.get(lid);
          const d = lineDrafts[lid] ?? emptyLineDraft();
          const expected = parseQty(l.expected_qty);
          const status = computeLineStatus(expected, parseQty(d.receivedQty), parseQty(d.damagedQty));
          return (
            <div
              key={lid}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{ol?.product?.name ?? '—'}</p>
                  <p className="font-mono text-xs text-slate-500">{ol?.product?.sku}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(status)}`}
                  >
                    {lineStatusLabel(status)}
                  </span>
                  <ReceivingLineActionsMenu
                    lineLabel={ol?.product?.sku ?? 'line'}
                    expectedQty={l.expected_qty}
                    draft={d}
                    showValidateSpecs={
                      !!ol?.productId && firstInboundProductIdSet.has(ol.productId)
                    }
                    onValidateSpecs={() => {
                      if (ol?.productId) {
                        setOpenLineActionId(null);
                        setSpecsModalProductId(ol.productId);
                      }
                    }}
                    open={openLineActionId === lid}
                    onToggle={() =>
                      setOpenLineActionId((cur) => (cur === lid ? null : lid))
                    }
                    onClose={() => setOpenLineActionId(null)}
                    onPatch={(patch) => patchLine(lid, patch)}
                  />
                </div>
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
              {productRequiresExpiry(ol, ol?.productId ? productsById.get(ol.productId) : undefined) ? (
                <label className="mt-2 block text-xs text-slate-600">
                  Expiry date <span className="text-rose-600">*</span>
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    value={d.expiry || lineExpiryByLineId[lid] || ''}
                    onChange={(e) => patchLine(lid, { expiry: e.target.value })}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </section>
      ) : null}

      {isMdUp ? (
        <ReceivingLinesTable
          lines={filteredLines}
          totalLineCount={lines.length}
          lineMap={lineMap}
          lineDrafts={lineDrafts}
          lineExpiryByLineId={lineExpiryByLineId}
          productsById={productsById}
          firstInboundProductIdSet={firstInboundProductIdSet}
          onExportPrint={showExportPdf ? handleExportPrint : undefined}
          openLineActionId={openLineActionId}
          onOpenLineActionId={setOpenLineActionId}
          onOpenSpecsModal={setSpecsModalProductId}
          onPatchLine={patchLine}
        />
      ) : null}

      <ProductSpecsValidationModal
        open={!!specsModalProductId}
        product={specsModalProductId ? productsById.get(specsModalProductId) : undefined}
        draft={
          specsModalProductId
            ? attrDrafts[specsModalProductId] ??
              emptyAttributeDraft(productsById.get(specsModalProductId))
            : emptyAttributeDraft()
        }
        onChange={(patch) => {
          if (!specsModalProductId) return;
          const product = productsById.get(specsModalProductId);
          setAttrDrafts((prev) => ({
            ...prev,
            [specsModalProductId]: {
              ...(prev[specsModalProductId] ?? emptyAttributeDraft(product)),
              ...patch,
            },
          }));
        }}
        onConfirm={() => {
          if (!specsModalProductId) return;
          const product = productsById.get(specsModalProductId);
          setAttrDrafts((prev) => ({
            ...prev,
            [specsModalProductId]: {
              ...(prev[specsModalProductId] ?? emptyAttributeDraft(product)),
              completed: true,
            },
          }));
          toast.success(`Attributes validated for ${product?.sku ?? 'product'}`);
        }}
        onClose={() => setSpecsModalProductId(null)}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            loading={saveProgress.isPending}
            onClick={() =>
              saveProgress.mutate({
                receiving_draft: {
                  lines: lineDrafts,
                  attributes: attrDrafts,
                } satisfies ReceivingExecutionDraft,
              })
            }
          >
            Save progress
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            Complete receiving
          </Button>
        </div>
      </div>
    </form>
  );
}

const RECEIVING_LINE_STATUS_OPTIONS: { value: ReceivingLineStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: lineStatusLabel('pending') },
  { value: 'partial', label: lineStatusLabel('partial') },
  { value: 'complete', label: lineStatusLabel('complete') },
  { value: 'shortage', label: lineStatusLabel('shortage') },
  { value: 'overage', label: lineStatusLabel('overage') },
  { value: 'damaged', label: lineStatusLabel('damaged') },
];

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

function ReceivingLineActionsMenu({
  lineLabel,
  expectedQty,
  draft,
  showValidateSpecs,
  onValidateSpecs,
  open,
  onToggle,
  onClose,
  onPatch,
}: {
  lineLabel: string;
  expectedQty: string;
  draft: LineReceiveDraft;
  showValidateSpecs?: boolean;
  onValidateSpecs?: () => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPatch: (patch: Partial<LineReceiveDraft>) => void;
}) {
  const menuBtn = (label: string, onClick: () => void, className = '') => (
    <button
      type="button"
      className={`block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 ${className}`}
      data-receiving-line-action-menu-button="true"
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <AnchoredDropdown
      open={open}
      align="end"
      menuRootProps={{ 'data-receiving-line-action-menu': 'true' }}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
          data-receiving-line-action-trigger="true"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={`Actions for ${lineLabel}`}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
          </svg>
        </button>
      }
    >
      {showValidateSpecs && onValidateSpecs
        ? menuBtn('Validate specs', () => {
            onValidateSpecs();
            onClose();
          })
        : null}
      {menuBtn('Edit note', () => {
        const next = window.prompt(`Note for ${lineLabel}`, draft.notes);
        if (next !== null) onPatch({ notes: next });
        onClose();
      })}
      {menuBtn('Receive expected qty', () => {
        onPatch({ receivedQty: expectedQty, damagedQty: '' });
        onClose();
      })}
      {menuBtn('Clear line', () => {
        onPatch({ receivedQty: '', damagedQty: '', notes: '' });
        onClose();
      }, 'text-rose-700 hover:bg-rose-50')}
    </AnchoredDropdown>
  );
}

function ReceivingLinesTable({
  lines,
  totalLineCount,
  lineMap,
  lineDrafts,
  lineExpiryByLineId,
  productsById,
  firstInboundProductIdSet,
  onExportPrint,
  openLineActionId,
  onOpenLineActionId,
  onOpenSpecsModal,
  readOnly,
  onPatchLine,
}: {
  lines: ReceivingLineRow[];
  totalLineCount: number;
  lineMap: Map<string, InboundOrderLine>;
  lineDrafts: Record<string, LineReceiveDraft>;
  lineExpiryByLineId: Record<string, string>;
  productsById: Map<string, Pick<Product, 'expiryTracking' | 'trackingType'> | undefined>;
  firstInboundProductIdSet: Set<string>;
  onExportPrint?: () => void;
  openLineActionId?: string | null;
  onOpenLineActionId?: (id: string | null) => void;
  onOpenSpecsModal?: (productId: string) => void;
  readOnly?: boolean;
  onPatchLine?: (lid: string, patch: Partial<LineReceiveDraft>) => void;
}) {
  const columns: Column<ReceivingLineRow>[] = [
    {
      header: 'Product',
      accessor: (l) => {
        const ol = lineMap.get(l.inbound_order_line_id);
        return <span className="font-medium text-slate-800">{ol?.product?.name ?? '—'}</span>;
      },
    },
    {
      header: 'SKU',
      accessor: (l) => {
        const ol = lineMap.get(l.inbound_order_line_id);
        return <span className="font-mono text-xs">{ol?.product?.sku ?? '—'}</span>;
      },
    },
    {
      header: 'Barcode',
      accessor: (l) => {
        const ol = lineMap.get(l.inbound_order_line_id);
        return <span className="font-mono text-xs">{ol?.product?.barcode ?? '—'}</span>;
      },
    },
    {
      header: 'Lot',
      accessor: (l) => {
        const ol = lineMap.get(l.inbound_order_line_id);
        return <span className="font-mono text-xs">{receivingExpectedLotDisplay(ol)}</span>;
      },
    },
    {
      header: 'Expected',
      accessor: (l) => <span className="font-mono tabular-nums">{l.expected_qty}</span>,
      className: 'whitespace-nowrap',
    },
    {
      header: 'Received',
      accessor: (l) => {
        const lid = l.inbound_order_line_id;
        const d = lineDrafts[lid] ?? emptyLineDraft();
        return readOnly ? (
          <span className="font-mono tabular-nums">{d.receivedQty || '—'}</span>
        ) : (
          <input
            className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            value={d.receivedQty}
            onChange={(e) => onPatchLine?.(lid, { receivedQty: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        );
      },
      className: 'whitespace-nowrap',
    },
    {
      header: 'Damaged',
      accessor: (l) => {
        const lid = l.inbound_order_line_id;
        const d = lineDrafts[lid] ?? emptyLineDraft();
        return readOnly ? (
          <span className="font-mono tabular-nums">{d.damagedQty || '—'}</span>
        ) : (
          <input
            className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            value={d.damagedQty}
            onChange={(e) => onPatchLine?.(lid, { damagedQty: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        );
      },
      className: 'whitespace-nowrap',
    },
    {
      header: 'Missing',
      accessor: (l) => {
        const lid = l.inbound_order_line_id;
        const d = lineDrafts[lid] ?? emptyLineDraft();
        const expected = parseQty(l.expected_qty);
        const missing = Math.max(0, expected - parseQty(d.receivedQty) - parseQty(d.damagedQty));
        return <span className="font-mono tabular-nums">{missing}</span>;
      },
      className: 'whitespace-nowrap',
    },
    {
      header: 'Status',
      accessor: (l) => {
        const lid = l.inbound_order_line_id;
        const d = lineDrafts[lid] ?? emptyLineDraft();
        const status = computeLineStatus(
          parseQty(l.expected_qty),
          parseQty(d.receivedQty),
          parseQty(d.damagedQty),
        );
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lineStatusClass(status)}`}>
            {lineStatusLabel(status)}
          </span>
        );
      },
      className: 'whitespace-nowrap',
    },
    {
      header: 'Expiry',
      accessor: (l) => {
        const lid = l.inbound_order_line_id;
        const ol = lineMap.get(lid);
        const d = lineDrafts[lid] ?? emptyLineDraft();
        const displayExpiry = lineExpiryByLineId[lid] ?? d.expiry;
        if (!productRequiresExpiry(ol, ol?.productId ? productsById.get(ol.productId) : undefined)) {
          return <span className="text-slate-400">—</span>;
        }
        return readOnly ? (
          <span className="font-mono text-xs tabular-nums">{displayExpiry || '—'}</span>
        ) : (
          <input
            type="date"
            required
            className="w-[9.5rem] rounded border border-slate-300 px-2 py-1 text-sm"
            value={d.expiry || displayExpiry}
            onChange={(e) => onPatchLine?.(lid, { expiry: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        );
      },
      className: 'whitespace-nowrap',
    },
    ...(!readOnly && onPatchLine && onOpenLineActionId
      ? [
          {
            header: 'Actions',
            accessor: (l: ReceivingLineRow) => {
              const lid = l.inbound_order_line_id;
              const ol = lineMap.get(lid);
              const d = lineDrafts[lid] ?? emptyLineDraft();
              return (
                <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
                  <ReceivingLineActionsMenu
                    lineLabel={ol?.product?.sku ?? 'line'}
                    expectedQty={l.expected_qty}
                    draft={d}
                    showValidateSpecs={
                      !!ol?.productId && firstInboundProductIdSet.has(ol.productId)
                    }
                    onValidateSpecs={() => {
                      if (ol?.productId) {
                        onOpenLineActionId?.(null);
                        onOpenSpecsModal?.(ol.productId);
                      }
                    }}
                    open={openLineActionId === lid}
                    onToggle={() =>
                      onOpenLineActionId(openLineActionId === lid ? null : lid)
                    }
                    onClose={() => onOpenLineActionId(null)}
                    onPatch={(patch) => onPatchLine(lid, patch)}
                  />
                </div>
              );
            },
            className: 'whitespace-nowrap',
          } satisfies Column<ReceivingLineRow>,
        ]
      : []),
  ];

  return (
    <DataTable
      title="Receive lines"
      actions={
        onExportPrint ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={lines.length === 0}
            onClick={() => onExportPrint()}
          >
            Export PDF
          </Button>
        ) : undefined
      }
      columns={columns}
      rows={lines}
      rowKey={(l) => l.inbound_order_line_id}
      empty={
        totalLineCount === 0
          ? 'No lines on this task.'
          : 'No lines match the current filters.'
      }
    />
  );
}
