import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Location } from '../../../api/locations';
import type { OutboundOrder, OutboundOrderLine } from '../../../api/outbound';
import { TasksApi } from '../../../api/tasks';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Combobox } from '../../../components/Combobox';
import { useToast } from '../../../components/ToastProvider';
import { locationTypeLabel } from '../../../lib/location-types';
import { Alert } from '@ds';
import type {
  PackExecutionDraft,
  PackLineDraft,
  PackPackageDraft,
  PackScanStep,
} from './pack-types';
import {
  PACKAGE_TYPE_OPTIONS,
  buildPackCompletePayload,
  computePackLineStatus,
  computePackSummary,
  createEmptyPackage,
  findLineByProductScan,
  findPackageByLabelScan,
  initialPackLines,
  packLineStatusClass,
  packLineStatusLabel,
  packScanStepLabel,
  readPackDraft,
  sumPackedForLine,
  syncLinePackedQty,
} from './pack-utils';
import { parseQty } from '../putaway/putaway-utils';

type Props = {
  taskId: string;
  lineIds: string[];
  outbound: OutboundOrder | undefined;
  outboundOrderId?: string;
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

export function PackExecutionPanel({
  taskId,
  lineIds,
  outbound,
  outboundOrderId,
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
  const savedDraft = readPackDraft(executionState);

  const lineFingerprint = useMemo(() => lineIds.join('\u001e'), [lineIds]);

  const lineMeta = useMemo(() => {
    const m = new Map<string, OutboundOrderLine>();
    for (const ol of outbound?.lines ?? []) m.set(ol.id, ol);
    return m;
  }, [outbound?.lines]);

  const [lines, setLines] = useState<PackLineDraft[]>(() =>
    initialPackLines(lineIds, lineMeta, savedDraft?.lines),
  );
  const [packages, setPackages] = useState<PackPackageDraft[]>(() => {
    const pkgs = savedDraft?.packages?.length ? savedDraft.packages : [createEmptyPackage([])];
    return pkgs;
  });
  const [activePackageId, setActivePackageId] = useState(
    () => savedDraft?.activePackageId ?? savedDraft?.packages?.[0]?.id ?? '',
  );
  const [activeLineIndex, setActiveLineIndex] = useState(savedDraft?.activeLineIndex ?? 0);
  const [verificationComplete, setVerificationComplete] = useState(
    savedDraft?.verificationComplete ?? false,
  );
  const [packingStationId, setPackingStationId] = useState(savedDraft?.packingStationId ?? '');
  const [scanStep, setScanStep] = useState<PackScanStep>('product');
  const [scanValue, setScanValue] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [focusMode, setFocusMode] = useState(true);

  const skipLineReset = useRef(true);
  useEffect(() => {
    if (skipLineReset.current) {
      skipLineReset.current = false;
      return;
    }
    const pkgs = [createEmptyPackage([])];
    setLines(initialPackLines(lineIds, lineMeta, undefined));
    setPackages(pkgs);
    setActivePackageId(pkgs[0]!.id);
    setActiveLineIndex(0);
    setVerificationComplete(false);
  }, [lineFingerprint, lineMeta]);

  useEffect(() => {
    setLines((prev) => syncLinePackedQty(prev, packages));
  }, [packages]);

  const activePackage = packages.find((p) => p.id === activePackageId) ?? packages[0];
  const activeLine = lines[activeLineIndex];
  const activeOl = activeLine ? lineMeta.get(activeLine.outboundOrderLineId) : undefined;

  const summary = useMemo(() => computePackSummary(lines, packages), [lines, packages]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!verificationComplete) issues.push('Complete pick verification before packing.');
    for (const l of lines) {
      const st = computePackLineStatus(l);
      if (st === 'overpack') issues.push('Packed quantity exceeds picked on one or more lines.');
      if (st === 'short' && verificationComplete) issues.push('Short pack — resolve missing units.');
    }
    const openPkgs = packages.filter((p) => p.status === 'open' && p.items.length > 0);
    if (openPkgs.length > 0) issues.push('Finalize open packages before completing.');
    const incomplete = lines.filter((l) => computePackLineStatus(l) !== 'complete').length;
    if (verificationComplete && incomplete > 0) {
      issues.push(`${incomplete} line(s) not fully packed.`);
    }
    return [...new Set(issues)];
  }, [lines, packages, verificationComplete]);

  const patchLine = useCallback((lineId: string, patch: Partial<PackLineDraft>) => {
    setLines((prev) =>
      prev.map((l) => (l.outboundOrderLineId === lineId ? { ...l, ...patch } : l)),
    );
  }, []);

  const patchPackage = useCallback((pkgId: string, patch: Partial<PackPackageDraft>) => {
    setPackages((prev) => prev.map((p) => (p.id === pkgId ? { ...p, ...patch } : p)));
  }, []);

  const addQtyToActivePackage = useCallback(
    (lineId: string, qty: number) => {
      if (!activePackage || qty <= 0) return false;
      const line = lines.find((l) => l.outboundOrderLineId === lineId);
      if (!line) return false;
      const picked = parseQty(line.pickedQty);
      const currentPacked = sumPackedForLine(packages, lineId);
      if (currentPacked + qty > picked + 1e-6) {
        setScanFeedback({ type: 'err', msg: `Cannot pack more than picked (${picked}).` });
        patchLine(lineId, { exceptionType: 'overpack' });
        return false;
      }
      setPackages((prev) =>
        prev.map((p) => {
          if (p.id !== activePackage.id) return p;
          const items = [...p.items];
          const idx = items.findIndex((i) => i.outboundOrderLineId === lineId);
          if (idx >= 0) {
            const next = parseQty(items[idx]!.quantity) + qty;
            items[idx] = { outboundOrderLineId: lineId, quantity: String(next) };
          } else {
            items.push({ outboundOrderLineId: lineId, quantity: String(qty) });
          }
          return { ...p, items };
        }),
      );
      patchLine(lineId, {
        productVerified: true,
        verified: verificationComplete ? line.verified : line.verified,
        exceptionType: 'none',
      });
      return true;
    },
    [activePackage, lines, packages, patchLine, verificationComplete],
  );

  const saveProgress = useMutation({
    mutationFn: () =>
      TasksApi.patchProgress(
        taskId,
        {
          pack_draft: {
            lines,
            packages,
            activePackageId,
            activeLineIndex,
            verificationComplete,
            packingStationId: packingStationId || undefined,
          } satisfies PackExecutionDraft,
        },
        companyIdOverride,
      ),
    onSuccess: () => toast.success('Progress saved'),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!readOnly && verificationComplete) scanRef.current?.focus();
  }, [readOnly, verificationComplete, activePackageId, scanStep]);

  const applyScan = useCallback(
    (raw: string) => {
      if (readOnly) return;
      const code = raw.trim();
      if (!code) return;

      if (scanStep === 'package') {
        const hit = findPackageByLabelScan(code, packages);
        if (!hit) {
          setScanFeedback({ type: 'err', msg: 'No package matches this label.' });
          return;
        }
        setActivePackageId(hit.id);
        setScanFeedback({ type: 'ok', msg: `Active package: ${hit.label}` });
        setScanStep('product');
        setScanValue('');
        return;
      }

      const lineId = findLineByProductScan(code, lineIds, lineMeta);
      if (!lineId) {
        setScanFeedback({ type: 'err', msg: 'Product not on this shipment.' });
        return;
      }
      if (!verificationComplete) {
        patchLine(lineId, { productVerified: true, verified: true });
        setScanFeedback({ type: 'ok', msg: `Verified: ${lineMeta.get(lineId)?.product?.sku}` });
        setScanValue('');
        return;
      }
      if (!activePackage) {
        setScanFeedback({ type: 'err', msg: 'Create or select a package first.' });
        return;
      }
      if (activePackage.status === 'finalized') {
        setScanFeedback({ type: 'err', msg: 'Package is finalized — select an open package.' });
        return;
      }
      const ok = addQtyToActivePackage(lineId, 1);
      if (ok) {
        const ol = lineMeta.get(lineId);
        setScanFeedback({ type: 'ok', msg: `+1 ${ol?.product?.sku} → ${activePackage.label}` });
        const idx = lines.findIndex((l) => l.outboundOrderLineId === lineId);
        if (idx >= 0) setActiveLineIndex(idx);
      }
      setScanValue('');
    },
    [
      activePackage,
      addQtyToActivePackage,
      lineIds,
      lineMeta,
      lines,
      packages,
      patchLine,
      readOnly,
      scanStep,
      verificationComplete,
    ],
  );

  function handleComplete(e: FormEvent) {
    e.preventDefault();
    if (validationIssues.length > 0) {
      toast.error('Resolve validation issues before completing.');
      return;
    }
    const synced = syncLinePackedQty(lines, packages);
    submit(buildPackCompletePayload(lineIds, synced, packages), e);
  }

  function addPackage() {
    setPackages((prev) => {
      const pkg = createEmptyPackage(prev);
      setActivePackageId(pkg.id);
      return [...prev, pkg];
    });
    toast.success('New package created');
  }

  function finalizeActivePackage() {
    if (!activePackage) return;
    if (activePackage.items.length === 0) {
      toast.error('Add items before finalizing.');
      return;
    }
    patchPackage(activePackage.id, { status: 'finalized' });
    toast.success(`Package ${activePackage.label} finalized`);
    const nextOpen = packages.find((p) => p.id !== activePackage.id && p.status === 'open');
    if (nextOpen) setActivePackageId(nextOpen.id);
    else addPackage();
  }

  const shipDeadline = outbound?.requiredShipDate ? new Date(outbound.requiredShipDate) : null;
  const slaUrgent = Boolean(
    shipDeadline && !Number.isNaN(shipDeadline.getTime()) && shipDeadline.getTime() < Date.now(),
  );

  const packingStationOptions = packingLocations.map((loc) => ({
    value: loc.id,
    label: loc.fullPath,
    hint: `${locationTypeLabel(loc.type)} · ${loc.barcode}`,
  }));

  if (readOnly) {
    return (
      <div className="space-y-4">
        <PackHeader
          orderNumber={outbound?.orderNumber}
          companyName={outbound?.company?.name}
          assignedWorkerLabel={assignedWorkerLabel}
          taskStatus={taskStatus}
          carrier={outbound?.carrier}
          destination={outbound?.destinationAddress}
          shipDate={outbound?.requiredShipDate}
          warehouseId={warehouseId}
        />
        <SummaryCards summary={summary} />
        <PackTable
          lines={lines}
          lineMeta={lineMeta}
          packages={packages}
          readOnly
        />
      </div>
    );
  }

  if (!lineIds.length) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        No outbound lines on this pack task.
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      <PackHeader
        orderNumber={outbound?.orderNumber}
        companyName={outbound?.company?.name}
        assignedWorkerLabel={assignedWorkerLabel}
        taskStatus={taskStatus}
        carrier={outbound?.carrier}
        destination={outbound?.destinationAddress}
        shipDate={outbound?.requiredShipDate}
        warehouseId={warehouseId}
        outboundHref={outboundOrderId ? `/orders/outbound/${outboundOrderId}` : undefined}
        slaUrgent={slaUrgent}
        createdAt={outbound?.createdAt}
      />

      {validationIssues.length > 0 ? (
        <Alert variant="warning" title="Packing attention">
          <ul className="mt-1 list-inside list-disc text-sm">
            {validationIssues.slice(0, 5).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <SummaryCards summary={summary} />

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">Packing station</p>
            <p className="text-xs text-slate-500">Where this shipment is being packed</p>
          </div>
          <Combobox
            value={packingStationId}
            onChange={setPackingStationId}
            options={packingStationOptions}
            placeholder="Select station…"
            emptyMessage="No packing locations"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">Pick verification</p>
            <p className="text-xs text-slate-500">Confirm picked inventory before packing into cartons</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <input
              type="checkbox"
              checked={verificationComplete}
              onChange={(e) => {
                setVerificationComplete(e.target.checked);
                if (e.target.checked) setScanStep('product');
              }}
              className="rounded border-emerald-400"
            />
            Verification complete
          </label>
        </div>
        <div className="mt-3 space-y-2">
          {lines.map((l) => {
            const ol = lineMeta.get(l.outboundOrderLineId);
            const picked = parseQty(l.pickedQty);
            const missing = Math.max(0, picked - parseQty(l.packedQty) - parseQty(l.damagedQty));
            return (
              <div
                key={l.outboundOrderLineId}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                  l.verified ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'
                }`}
              >
                <div>
                  <p className="font-medium text-slate-900">{ol?.product?.name ?? '—'}</p>
                  <p className="font-mono text-xs text-slate-500">{ol?.product?.sku}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span>
                    Picked <strong className="font-mono">{l.pickedQty}</strong>
                  </span>
                  <span>
                    Damaged{' '}
                    <input
                      className="w-12 rounded border border-slate-300 px-1 font-mono"
                      value={l.damagedQty}
                      onChange={(e) => patchLine(l.outboundOrderLineId, { damagedQty: e.target.value })}
                      disabled={verificationComplete}
                    />
                  </span>
                  {missing > 0 && verificationComplete ? (
                    <span className="text-rose-700">Missing {missing}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">Packing execution</p>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={focusMode}
                onChange={(e) => setFocusMode(e.target.checked)}
                className="rounded border-slate-300"
              />
              Focus mode
            </label>
          </div>

          {verificationComplete && focusMode ? (
            <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Scan to pack</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{packScanStepLabel(scanStep)}</p>
              <p className="text-xs text-slate-500">
                Active package: <span className="font-mono font-semibold">{activePackage?.label ?? '—'}</span>
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
                  disabled={!verificationComplete}
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
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setScanStep('product')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    scanStep === 'product' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Product
                </button>
                <button
                  type="button"
                  onClick={() => setScanStep('package')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    scanStep === 'package' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Package
                </button>
              </div>
              {activeLine && activeOl ? (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium">{activeOl.product?.name}</p>
                  <p className="font-mono text-xs text-slate-500">
                    Packed {activeLine.packedQty} / {activeLine.pickedQty}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {!focusMode || !verificationComplete ? (
            <PackTable
              lines={lines}
              lineMeta={lineMeta}
              packages={packages}
              onPatchLine={patchLine}
              onAssignQty={(lineId, pkgId, qty) => {
                setPackages((prev) =>
                  prev.map((p) => {
                    if (p.id !== pkgId) return p;
                    const items = p.items.filter((i) => i.outboundOrderLineId !== lineId);
                    if (qty > 0) items.push({ outboundOrderLineId: lineId, quantity: String(qty) });
                    return { ...p, items };
                  }),
                );
              }}
            />
          ) : (
            <div className="hidden md:block">
              <PackTable
                lines={lines}
                lineMeta={lineMeta}
                packages={packages}
                onPatchLine={patchLine}
              />
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Packages</p>
            <Button type="button" size="sm" variant="secondary" onClick={addPackage}>
              + New
            </Button>
          </div>
          {packages.map((pkg) => {
            const isActive = pkg.id === activePackageId;
            const itemCount = pkg.items.reduce((s, i) => s + parseQty(i.quantity), 0);
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setActivePackageId(pkg.id)}
                className={`w-full rounded-xl border p-3 text-start transition ${
                  isActive
                    ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-slate-900">{pkg.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      pkg.status === 'finalized'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {pkg.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {itemCount} units · {PACKAGE_TYPE_OPTIONS.find((t) => t.value === pkg.packageType)?.label}
                </p>
              </button>
            );
          })}

          {activePackage && verificationComplete ? (
            <section className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Ship prep — {activePackage.label}</p>
              <label className="mt-2 block text-xs text-slate-600">
                Type
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={activePackage.packageType}
                  onChange={(e) =>
                    patchPackage(activePackage.id, {
                      packageType: e.target.value as PackPackageDraft['packageType'],
                    })
                  }
                  disabled={activePackage.status === 'finalized'}
                >
                  {PACKAGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">
                  Weight (kg)
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                    value={activePackage.weightKg}
                    onChange={(e) => patchPackage(activePackage.id, { weightKg: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  L (cm)
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                    value={activePackage.lengthCm}
                    onChange={(e) => patchPackage(activePackage.id, { lengthCm: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  W (cm)
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                    value={activePackage.widthCm}
                    onChange={(e) => patchPackage(activePackage.id, { widthCm: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  H (cm)
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                    value={activePackage.heightCm}
                    onChange={(e) => patchPackage(activePackage.id, { heightCm: e.target.value })}
                  />
                </label>
              </div>
              <Button
                type="button"
                className="mt-3 w-full"
                variant="secondary"
                disabled={activePackage.status === 'finalized'}
                onClick={finalizeActivePackage}
              >
                Finalize package
              </Button>
              <Button
                type="button"
                className="mt-2 w-full"
                variant="ghost"
                onClick={() => {
                  const w = window.open('', '_blank');
                  if (!w) {
                    toast.error('Allow pop-ups to print');
                    return;
                  }
                  w.document.write(
                    `<html><body style="font-family:system-ui;padding:24px"><h1>${activePackage.label}</h1><p>Order ${outbound?.orderNumber ?? ''}</p><p style="font-size:24px;font-family:monospace">${activePackage.label}</p></body></html>`,
                  );
                  w.document.close();
                  w.print();
                }}
              >
                Print label
              </Button>
            </section>
          ) : null}
        </aside>
      </div>

      {showIssueForm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium">Report packing issue</p>
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
                if (issueText.trim() && activeLine) {
                  patchLine(activeLine.outboundOrderLineId, {
                    notes: issueText.trim(),
                    exceptionType: 'missing',
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
            Report issue
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            Complete packing
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

function PackHeader({
  orderNumber,
  companyName,
  assignedWorkerLabel,
  taskStatus,
  carrier,
  destination,
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
  destination?: string;
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
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Outbound pack</p>
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
              'Pack task'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{companyName ?? '—'}</p>
          {destination ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{destination}</p>
          ) : null}
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
          <dt className="text-xs text-slate-500">Packer</dt>
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
        <p className="mt-2 text-[10px] text-slate-400">Created {new Date(createdAt).toLocaleString()}</p>
      ) : null}
    </header>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof computePackSummary> }) {
  const cards = [
    { label: 'SKUs', value: String(summary.totalSkus) },
    { label: 'Picked', value: String(summary.totalPickedUnits) },
    { label: 'Packed', value: String(summary.packedUnits), accent: true },
    { label: 'Remaining', value: String(summary.remainingUnits) },
    { label: 'Packages', value: String(summary.packageCount) },
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

function PackTable({
  lines,
  lineMeta,
  packages,
  readOnly,
  onPatchLine: _onPatchLine,
  onAssignQty,
}: {
  lines: PackLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  packages: PackPackageDraft[];
  readOnly?: boolean;
  onPatchLine?: (lineId: string, patch: Partial<PackLineDraft>) => void;
  onAssignQty?: (lineId: string, pkgId: string, qty: number) => void;
}) {
  const pkgOptions = packages.map((p) => ({ value: p.id, label: p.label }));

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="min-w-[1000px] w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <th className="px-3 py-3">SKU</th>
            <th className="px-3 py-3">Product</th>
            <th className="px-3 py-3">Barcode</th>
            <th className="px-3 py-3">Picked</th>
            <th className="px-3 py-3">Packed</th>
            <th className="px-3 py-3">Remaining</th>
            <th className="px-3 py-3">Package</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const ol = lineMeta.get(l.outboundOrderLineId);
            const picked = parseQty(l.pickedQty);
            const packed = parseQty(l.packedQty);
            const remaining = Math.max(0, picked - packed);
            const st = computePackLineStatus(l);
            const pkgLabel =
              packages.find((p) => p.items.some((i) => i.outboundOrderLineId === l.outboundOrderLineId))
                ?.label ?? '—';
            return (
              <tr key={l.outboundOrderLineId} className="border-b border-slate-100 align-top">
                <td className="px-3 py-3 font-mono text-xs">{ol?.product?.sku ?? '—'}</td>
                <td className="px-3 py-3 text-xs font-medium">{ol?.product?.name ?? '—'}</td>
                <td className="px-3 py-3 font-mono text-xs">{ol?.product?.barcode ?? '—'}</td>
                <td className="px-3 py-3 font-mono text-xs">{l.pickedQty}</td>
                <td className="px-3 py-3 font-mono text-xs font-semibold text-emerald-800">{l.packedQty}</td>
                <td className="px-3 py-3 font-mono text-xs text-slate-600">{remaining}</td>
                <td className="px-3 py-3 text-xs">
                  {readOnly ? (
                    pkgLabel
                  ) : onAssignQty && pkgOptions.length ? (
                    <span className="font-mono">{pkgLabel}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${packLineStatusClass(st)}`}>
                    {packLineStatusLabel(st)}
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
