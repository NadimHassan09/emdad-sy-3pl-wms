import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Location } from '../../../api/locations';
import type { OutboundOrder, OutboundOrderLine } from '../../../api/outbound';
import { TasksApi } from '../../../api/tasks';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Combobox } from '../../../components/Combobox';
import { TextField } from '../../../components/TextField';
import { useToast } from '../../../components/ToastProvider';
import { locationTypeLabel } from '../../../lib/location-types';
import { Alert } from '@ds';
import type { DispatchExecutionDraft, DispatchPackageDraft, DispatchScanStep } from './dispatch-types';
import {
  buildDispatchCompletePayload,
  computeDispatchSummary,
  defaultPackages,
  dispatchScanStepLabel,
  findPackageByLabel,
  initialDispatchLines,
  locationDisplay,
  matchLocationIdByScan,
  newPackageLabel,
  parseQty,
  readinessClass,
  readinessLabel,
  readDispatchDraft,
  readPackDraftPackages,
} from './dispatch-utils';

type Props = {
  taskId: string;
  outbound: OutboundOrder | undefined;
  outboundOrderId?: string;
  lineIds: string[];
  packingLocations: Location[];
  dispatchLocations: Location[];
  warehouseId: string;
  companyIdOverride?: string;
  assignedWorkerLabel: string;
  taskStatus: string;
  executionState?: unknown;
  packExecutionState?: unknown;
  submit: (body: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
};

export function DispatchExecutionPanel({
  taskId,
  outbound,
  outboundOrderId,
  lineIds,
  packingLocations,
  dispatchLocations,
  warehouseId,
  companyIdOverride,
  assignedWorkerLabel,
  taskStatus,
  executionState,
  packExecutionState,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  const savedDraft = readDispatchDraft(executionState);
  const packPackages = readPackDraftPackages(packExecutionState);

  const lineMeta = useMemo(() => {
    const m = new Map<string, OutboundOrderLine>();
    for (const ol of outbound?.lines ?? []) m.set(ol.id, ol);
    return m;
  }, [outbound?.lines]);

  const [draft, setDraft] = useState<DispatchExecutionDraft>(() => ({
    sourceLocationId: savedDraft?.sourceLocationId ?? '',
    destinationLocationId: savedDraft?.destinationLocationId ?? '',
    sourceVerified: savedDraft?.sourceVerified ?? false,
    destVerified: savedDraft?.destVerified ?? false,
    packages: defaultPackages(savedDraft?.packages ?? packPackages ?? undefined),
    lines: initialDispatchLines(lineIds, lineMeta, savedDraft?.lines),
    carrier: savedDraft?.carrier ?? outbound?.carrier ?? '',
    tracking: savedDraft?.tracking ?? outbound?.trackingNumber ?? '',
    driverName: savedDraft?.driverName ?? '',
    vehicleInfo: savedDraft?.vehicleInfo ?? '',
    dispatchNotes: savedDraft?.dispatchNotes ?? '',
  }));

  const [scanStep, setScanStep] = useState<DispatchScanStep>('source');
  const [scanValue, setScanValue] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueText, setIssueText] = useState('');

  const patchDraft = useCallback((patch: Partial<DispatchExecutionDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchPackage = useCallback((pkgId: string, patch: Partial<DispatchPackageDraft>) => {
    setDraft((prev) => ({
      ...prev,
      packages: prev.packages.map((p) => (p.id === pkgId ? { ...p, ...patch } : p)),
    }));
  }, []);

  const patchLine = useCallback((lineId: string, patch: Partial<typeof draft.lines[0]>) => {
    setDraft((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.outboundOrderLineId === lineId ? { ...l, ...patch } : l)),
    }));
  }, []);

  const sourceLoc = packingLocations.find((l) => l.id === draft.sourceLocationId);
  const destLoc = dispatchLocations.find((l) => l.id === draft.destinationLocationId);
  const summary = useMemo(() => computeDispatchSummary(draft.lines, draft.packages, draft), [draft]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!draft.sourceLocationId) issues.push('Select or scan source packing location.');
    if (!draft.sourceVerified) issues.push('Confirm source (packing) location scan.');
    if (!draft.destinationLocationId) issues.push('Select or scan destination dispatch dock.');
    if (!draft.destVerified) issues.push('Confirm destination (dispatch) location scan.');
    const unscanned = draft.packages.filter((p) => !p.scanned);
    if (unscanned.length > 0) issues.push(`${unscanned.length} package(s) not scanned for loading.`);
    for (const l of draft.lines) {
      const picked = parseQty(l.pickedQty);
      const ship = parseQty(l.shipQty);
      if (ship > picked + 1e-6) issues.push('Ship quantity cannot exceed picked quantity.');
      if (!l.verified && ship > 0) issues.push('Verify all shipment lines before dispatch.');
    }
    return [...new Set(issues)];
  }, [draft]);

  const saveProgress = useMutation({
    mutationFn: () =>
      TasksApi.patchProgress(taskId, { dispatch_draft: draft }, companyIdOverride),
    onSuccess: () => toast.success('Progress saved'),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!readOnly) scanRef.current?.focus();
  }, [readOnly, scanStep]);

  const applyScan = useCallback(
    (raw: string) => {
      if (readOnly) return;
      const code = raw.trim();
      if (!code) return;

      if (scanStep === 'source') {
        const id = matchLocationIdByScan(code, packingLocations);
        if (!id) {
          setScanFeedback({ type: 'err', msg: 'Not a valid packing location.' });
          return;
        }
        patchDraft({ sourceLocationId: id, sourceVerified: true });
        setScanFeedback({ type: 'ok', msg: `Source confirmed: ${locationDisplay(packingLocations.find((l) => l.id === id)).fullPath}` });
        setScanStep('destination');
        setScanValue('');
        return;
      }

      if (scanStep === 'destination') {
        const id = matchLocationIdByScan(code, dispatchLocations);
        if (!id) {
          setScanFeedback({ type: 'err', msg: 'Not a valid shipping dock (output) location.' });
          return;
        }
        patchDraft({ destinationLocationId: id, destVerified: true });
        setScanFeedback({ type: 'ok', msg: `Destination confirmed: ${locationDisplay(dispatchLocations.find((l) => l.id === id)).fullPath}` });
        setScanStep('package');
        setScanValue('');
        return;
      }

      const pkg = findPackageByLabel(code, draft.packages);
      if (!pkg) {
        setScanFeedback({ type: 'err', msg: 'Package label not on this shipment.' });
        return;
      }
      patchPackage(pkg.id, { scanned: true, ready: true });
      setScanFeedback({ type: 'ok', msg: `Package ${pkg.label} loaded` });
      setScanValue('');
    },
    [dispatchLocations, draft.packages, packingLocations, patchDraft, patchPackage, readOnly, scanStep],
  );

  function handleComplete(e: FormEvent) {
    e.preventDefault();
    if (summary.readiness !== 'ready' && validationIssues.length > 0) {
      toast.error('Complete dispatch checks before finishing.');
      return;
    }
    submit(buildDispatchCompletePayload(draft.lines, draft.carrier, draft.tracking), e);
  }

  function addPackage() {
    const label = newPackageLabel(draft.packages);
    const pkg: DispatchPackageDraft = {
      id: `pkg-${Date.now()}`,
      label,
      weightKg: '',
      itemCount: 0,
      scanned: false,
      ready: false,
    };
    patchDraft({ packages: [...draft.packages, pkg] });
  }

  const packingOptions = packingLocations.map((l) => ({
    value: l.id,
    label: l.fullPath,
    hint: `${locationTypeLabel(l.type)} · ${l.barcode}`,
  }));
  const dispatchOptions = dispatchLocations.map((l) => ({
    value: l.id,
    label: l.fullPath,
    hint: `${locationTypeLabel(l.type)} · ${l.barcode}`,
  }));

  const shipDeadline = outbound?.requiredShipDate ? new Date(outbound.requiredShipDate) : null;
  const slaUrgent = Boolean(
    shipDeadline && !Number.isNaN(shipDeadline.getTime()) && shipDeadline.getTime() < Date.now(),
  );

  if (readOnly) {
    return (
      <div className="space-y-4">
        <DispatchHeader
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
        <MovementHero sourceLoc={sourceLoc} destLoc={destLoc} />
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      <DispatchHeader
        orderNumber={outbound?.orderNumber}
        companyName={outbound?.company?.name}
        assignedWorkerLabel={assignedWorkerLabel}
        taskStatus={taskStatus}
        carrier={draft.carrier || outbound?.carrier}
        destination={outbound?.destinationAddress}
        shipDate={outbound?.requiredShipDate}
        warehouseId={warehouseId}
        outboundHref={outboundOrderId ? `/orders/outbound/${outboundOrderId}` : undefined}
        slaUrgent={slaUrgent}
        createdAt={outbound?.createdAt}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${readinessClass(summary.readiness)}`}>
          {readinessLabel(summary.readiness)}
        </span>
        {packPackages ? (
          <span className="text-xs text-slate-500">Packages seeded from pack task</span>
        ) : null}
      </div>

      {validationIssues.length > 0 ? (
        <Alert variant="warning" title="Dispatch validation">
          <ul className="mt-1 list-inside list-disc text-sm">
            {validationIssues.slice(0, 5).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <SummaryCards summary={summary} />

      <MovementHero sourceLoc={sourceLoc} destLoc={destLoc} />

      <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-emerald-900">Location confirmation</p>
        <p className="mt-1 text-xs text-slate-500">
          Move shipment from packing area to dispatch dock — scan or select each location.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Source (packing)</label>
            <Combobox
              value={draft.sourceLocationId}
              onChange={(v) => patchDraft({ sourceLocationId: v, sourceVerified: !!v })}
              options={packingOptions}
              placeholder="Packing station…"
              emptyMessage="No packing locations"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Destination (dispatch dock)</label>
            <Combobox
              value={draft.destinationLocationId}
              onChange={(v) => patchDraft({ destinationLocationId: v, destVerified: !!v })}
              options={dispatchOptions}
              placeholder="Shipping dock…"
              emptyMessage="No dispatch docks"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl border-2 border-emerald-400 bg-emerald-50/50 p-4">
          <p className="text-sm font-semibold text-emerald-900">{dispatchScanStepLabel(scanStep)}</p>
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
            <Button type="button" variant="secondary" className="min-h-[52px]" onClick={() => setScanModalOpen(true)}>
              Camera
            </Button>
          </div>
          {scanFeedback ? (
            <p className={`mt-2 text-sm font-medium ${scanFeedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {scanFeedback.msg}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {(['source', 'destination', 'package'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScanStep(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  scanStep === s ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {s === 'source' ? 'Source' : s === 'destination' ? 'Dest' : 'Package'}
                {s === 'source' && draft.sourceVerified ? ' ✓' : ''}
                {s === 'destination' && draft.destVerified ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">Packages</p>
          <Button type="button" size="sm" variant="secondary" onClick={addPackage}>
            + Package
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {draft.packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`rounded-xl border p-3 ${
                pkg.scanned ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold">{pkg.label}</span>
                {pkg.scanned ? (
                  <span className="text-xs font-medium text-emerald-700">Loaded ✓</span>
                ) : (
                  <span className="text-xs text-slate-500">Pending scan</span>
                )}
              </div>
              <label className="mt-2 block text-xs text-slate-600">
                Weight (kg)
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                  value={pkg.weightKg}
                  onChange={(e) => patchPackage(pkg.id, { weightKg: e.target.value })}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Shipment verification</p>
        <div className="-mx-1 mt-3 overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Picked</th>
                <th className="px-3 py-2">Ship</th>
                <th className="px-3 py-2">Verify</th>
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((l) => {
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
                        onChange={(e) => patchLine(l.outboundOrderLineId, { verified: e.target.checked })}
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
        <p className="text-sm font-semibold text-slate-800">Carrier handoff</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="Carrier" value={draft.carrier} onChange={(e) => patchDraft({ carrier: e.target.value })} />
          <TextField label="Tracking number" value={draft.tracking} onChange={(e) => patchDraft({ tracking: e.target.value })} />
          <TextField label="Driver (optional)" value={draft.driverName} onChange={(e) => patchDraft({ driverName: e.target.value })} />
          <TextField label="Vehicle (optional)" value={draft.vehicleInfo} onChange={(e) => patchDraft({ vehicleInfo: e.target.value })} />
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-600">
          Dispatch notes
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-300 p-2 text-sm"
            value={draft.dispatchNotes}
            onChange={(e) => patchDraft({ dispatchNotes: e.target.value })}
          />
        </label>
      </section>

      {showIssueForm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium">Report dispatch issue</p>
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
                if (issueText.trim()) patchDraft({ dispatchNotes: issueText.trim() });
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
          <Button type="button" variant="secondary" className="min-h-[48px] w-full sm:w-auto" loading={saveProgress.isPending} onClick={() => saveProgress.mutate()}>
            Save progress
          </Button>
          <Button type="button" variant="secondary" className="min-h-[48px] w-full sm:w-auto" onClick={() => setShowIssueForm(true)}>
            Report issue
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            onClick={() => {
              const w = window.open('', '_blank');
              if (!w) {
                toast.error('Allow pop-ups to print');
                return;
              }
              w.document.write(
                `<html><body style="font-family:system-ui;padding:16px"><h1>Dispatch ${outbound?.orderNumber ?? ''}</h1><p>Carrier: ${draft.carrier}</p><p>Tracking: ${draft.tracking}</p></body></html>`,
              );
              w.document.close();
              w.print();
            }}
          >
            Print documents
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            Complete dispatch
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

function DispatchHeader({
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
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Outbound dispatch</p>
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
              'Dispatch task'
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{companyName ?? '—'}</p>
          {destination ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{destination}</p> : null}
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
          <dt className="text-xs text-slate-500">Dispatcher</dt>
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

function SummaryCards({ summary }: { summary: ReturnType<typeof computeDispatchSummary> }) {
  const cards = [
    { label: 'SKUs', value: String(summary.totalSkus) },
    { label: 'Units', value: String(summary.totalUnits) },
    { label: 'Packages', value: String(summary.packageCount) },
    { label: 'Scanned', value: `${summary.packagesScanned}/${summary.packageCount}`, accent: true },
    { label: 'Weight kg', value: summary.totalWeightKg > 0 ? String(summary.totalWeightKg) : '—' },
    { label: 'Progress', value: `${summary.completionPct}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border p-3 ${c.accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white'}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
          <p className={`mt-1 text-lg font-semibold ${c.accent ? 'text-emerald-800' : 'text-slate-900'}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function MovementHero({ sourceLoc, destLoc }: { sourceLoc?: Location; destLoc?: Location }) {
  const src = locationDisplay(sourceLoc);
  const dst = locationDisplay(destLoc);
  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-emerald-50 p-4 shadow-sm">
      <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Movement path
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-xl border border-violet-200 bg-white p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-violet-800">Source · Packing</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{src.shortLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{src.fullPath}</p>
        </div>
        <div className="hidden text-3xl text-emerald-600 sm:block" aria-hidden>
          →
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-emerald-800">Destination · Dispatch</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{dst.shortLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{dst.fullPath}</p>
        </div>
      </div>
    </section>
  );
}
