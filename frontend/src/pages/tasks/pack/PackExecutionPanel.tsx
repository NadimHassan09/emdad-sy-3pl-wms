import { useTaskProgressSave } from '../../../hooks/useTaskProgressSave';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TaskDetailsCard } from '../../../components/tasks/TaskDetailsCard';
import type { OutboundOrder, OutboundOrderLine } from '../../../api/outbound';
import { AnchoredDropdown } from '../../../components/AnchoredDropdown';
import { Button } from '../../../components/Button';
import { Column, DataTable } from '../../../components/DataTable';
import { useToast } from '../../../components/ToastProvider';
import { PackageDetailsModal } from './PackageDetailsModal';
import {
  formatTaskDateOnly,
  outboundOrderTitle,
} from '../../../lib/task-details-helpers';
import { useWarehouseLabel } from '../../../hooks/useWarehouseLabel';
import { taskTypeIconClass } from '../../../lib/task-type-icons';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import { localizedPackageTypeOptions, localizedTaskTypeTitle } from '../../../lib/ui-labels/task-execution';
import type {
  PackExecutionDraft,
  PackLineDraft,
  PackPackageDraft,
} from './pack-types';
import {
  buildPackCompletePayload,
  createEmptyPackage,
  initialPackLines,
  readPackDraft,
  sumPackedForLine,
  syncLinePackedQty,
} from './pack-utils';
import { parseQty } from '../putaway/putaway-utils';
import { readPickDraftPackingDestinationId } from '../dispatch/dispatch-utils';

type Props = {
  taskId: string;
  lineIds: string[];
  outbound: OutboundOrder | undefined;
  outboundOrderId?: string;
  warehouseId: string;
  companyIdOverride?: string;
  assignedWorkerLabel: string;
  taskOperatorNotes?: string;
  showExportPdf?: boolean;
  taskStatus: string;
  executionState?: unknown;
  pickExecutionState?: unknown;
  submit: (body: unknown, e?: FormEvent) => void;
  busy: boolean;
  readOnly?: boolean;
};

export function PackExecutionPanel({
  taskId,
  lineIds,
  outbound,
  outboundOrderId,
  warehouseId,
  companyIdOverride,
  assignedWorkerLabel,
  taskStatus,
  executionState,
  pickExecutionState,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const { warehouseLabel } = useWarehouseLabel();
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
  const [packingStationId, setPackingStationId] = useState(savedDraft?.packingStationId ?? '');

  useEffect(() => {
    if (packingStationId.trim()) return;
    const fromPick = readPickDraftPackingDestinationId(pickExecutionState);
    if (fromPick) setPackingStationId(fromPick);
  }, [pickExecutionState, packingStationId]);
  const [detailPackageId, setDetailPackageId] = useState<string | null>(null);

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
  }, [lineFingerprint, lineMeta]);

  useEffect(() => {
    setLines((prev) => syncLinePackedQty(prev, packages));
  }, [packages]);

  const patchPackage = useCallback((pkgId: string, patch: Partial<PackPackageDraft>) => {
    setPackages((prev) => prev.map((p) => (p.id === pkgId ? { ...p, ...patch } : p)));
  }, []);

  const saveProgress = useTaskProgressSave({
    taskId,
    warehouseId,
    outboundOrderId,
    companyIdOverride,
  });

  function handleComplete(e: FormEvent) {
    e.preventDefault();
    const openPkgs = packages.filter((p) => p.status === 'open' && p.items.length > 0);
    if (openPkgs.length > 0) {
      toast.error(t(['Finalize open packages before completing.', 'أنهِ الطرود المفتوحة قبل الإكمال.']));
      return;
    }
    const synced = syncLinePackedQty(lines, packages);
    const stationId = packingStationId.trim();
    if (stationId) {
      void saveProgress
        .mutateAsync({
          pack_draft: {
            lines: synced,
            packages,
            activePackageId,
            verificationComplete: true,
            packingStationId: stationId,
          } satisfies PackExecutionDraft,
        })
        .then(() => submit(buildPackCompletePayload(lineIds, synced, packages), e))
        .catch((err: Error) => toast.error(err.message));
      return;
    }
    submit(buildPackCompletePayload(lineIds, synced, packages), e);
  }

  function addPackage() {
    setPackages((prev) => {
      const pkg = createEmptyPackage(prev);
      setActivePackageId(pkg.id);
      setDetailPackageId(pkg.id);
      return [...prev, pkg];
    });
    toast.success(t(['New package created', 'تم إنشاء طرد جديد']));
  }

  function finalizePackage(pkg: PackPackageDraft) {
    if (pkg.items.length === 0) {
      toast.error(t(['Add items before finalizing.', 'أضف عناصر قبل الإنهاء.']));
      return;
    }
    patchPackage(pkg.id, { status: 'finalized' });
    toast.success(t([`Package ${pkg.label} finalized`, `تم إنهاء الطرد ${pkg.label}`]));
    const nextOpen = packages.find((p) => p.id !== pkg.id && p.status === 'open');
    if (nextOpen) setActivePackageId(nextOpen.id);
    else addPackage();
  }

  const addLineToPackage = useCallback(
    (pkgId: string, lineId: string, qty: number): boolean => {
      if (qty <= 0) {
        toast.error(t(['Enter a positive quantity.', 'أدخل كمية موجبة.']));
        return false;
      }
      const line = lines.find((l) => l.outboundOrderLineId === lineId);
      if (!line) return false;
      const picked = parseQty(line.pickedQty);
      const totalPacked = sumPackedForLine(packages, lineId);
      if (totalPacked + qty > picked + 1e-6) {
        toast.error(t([`Cannot pack more than picked (${picked}).`, `لا يمكن التغليف أكثر من المُلتقط (${picked}).`]));
        return false;
      }
      setPackages((prev) =>
        prev.map((p) => {
          if (p.id !== pkgId) return p;
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
      toast.success(t(['Added to package', 'أُضيف إلى الطرد']));
      return true;
    },
    [lines, packages, toast],
  );

  const removeLineFromPackage = useCallback((pkgId: string, lineId: string) => {
    setPackages((prev) =>
      prev.map((p) =>
        p.id === pkgId
          ? { ...p, items: p.items.filter((i) => i.outboundOrderLineId !== lineId) }
          : p,
      ),
    );
  }, []);

  function deletePackage(pkgId: string) {
    if (packages.length <= 1) {
      toast.error(t(['At least one package is required.', 'مطلوب طرد واحد على الأقل.']));
      return;
    }
    if (!window.confirm(t(['Delete this package?', 'حذف هذا الطرد؟']))) return;
    const remaining = packages.filter((p) => p.id !== pkgId);
    setPackages(remaining);
    if (detailPackageId === pkgId) setDetailPackageId(null);
    const nextActive = remaining[0]?.id ?? '';
    setActivePackageId(nextActive);
    toast.success(t(['Package removed', 'تم حذف الطرد']));
  }

  function printPackageLabel(pkg: PackPackageDraft) {
    const w = window.open('', '_blank');
    if (!w) {
      toast.error(t(['Allow pop-ups to print', 'اسمح بالنوافذ المنبثقة للطباعة']));
      return;
    }
    w.document.write(
      `<html><body style="font-family:system-ui;padding:24px"><h1>${pkg.label}</h1><p>Order ${outbound?.orderNumber ?? ''}</p><p style="font-size:24px;font-family:monospace">${pkg.label}</p></body></html>`,
    );
    w.document.close();
    w.print();
  }

  const packDetailsCard = (
    <TaskDetailsCard
      taskTypeLabel={localizedTaskTypeTitle('pack', t)}
      iconClass={taskTypeIconClass('pack')}
      primaryTitle={outboundOrderTitle(
        outbound?.orderNumber,
        outboundOrderId ? `/orders/outbound/${outboundOrderId}` : undefined,
        t(['Pack task', 'مهمة التغليف']),
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
          label: t(['Packer', 'مُغلّف']),
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
          value: warehouseLabel(warehouseId),
        },
      ]}
      summary={outbound?.destinationAddress?.trim() || undefined}
      summaryTitle={t(['Ship to', 'الشحن إلى'])}
    />
  );

  const packagesPanel = (
    <PackagesPanel
      packages={packages}
      lineIds={lineIds}
      lines={lines}
      lineMeta={lineMeta}
      detailPackageId={detailPackageId}
      onDetailPackageChange={setDetailPackageId}
      readOnly={readOnly}
      onAddPackage={readOnly ? undefined : addPackage}
      onPatchPackage={patchPackage}
      onAddLine={addLineToPackage}
      onRemoveLineFromPackage={removeLineFromPackage}
      onFinalize={finalizePackage}
      onPrintLabel={printPackageLabel}
      onDeletePackage={readOnly ? undefined : deletePackage}
      onActivePackageChange={setActivePackageId}
    />
  );

  if (readOnly) {
    return (
      <div className="space-y-4">
        {packDetailsCard}
        {packagesPanel}
      </div>
    );
  }

  if (!lineIds.length) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        {t(['No outbound lines on this pack task.', 'لا أسطر صادرة على مهمة التغليف هذه.'])}
      </div>
    );
  }

  return (
    <form className="space-y-4 pb-32" onSubmit={handleComplete}>
      {packDetailsCard}
      {packagesPanel}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full sm:w-auto"
            loading={saveProgress.isPending}
            onClick={() =>
              saveProgress.mutate({
                pack_draft: {
                  lines,
                  packages,
                  activePackageId,
                  verificationComplete: true,
                  packingStationId: packingStationId || undefined,
                } satisfies PackExecutionDraft,
              })
            }
          >
            {t(['Save progress', 'حفظ التقدم'])}
          </Button>
          <Button type="submit" className="min-h-[52px] flex-1 text-base" loading={busy}>
            {t(['Complete packing', 'إكمال التغليف'])}
          </Button>
        </div>
      </div>
    </form>
  );
}

function packageUnits(pkg: PackPackageDraft): number {
  return pkg.items.reduce((s, i) => s + parseQty(i.quantity), 0);
}

function PackagesPanel({
  packages,
  lineIds,
  lines,
  lineMeta,
  detailPackageId,
  onDetailPackageChange,
  readOnly,
  onAddPackage,
  onPatchPackage,
  onAddLine,
  onRemoveLineFromPackage,
  onFinalize,
  onPrintLabel,
  onDeletePackage,
  onActivePackageChange,
}: {
  packages: PackPackageDraft[];
  lineIds: string[];
  lines: PackLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  detailPackageId: string | null;
  onDetailPackageChange: (id: string | null) => void;
  readOnly?: boolean;
  onAddPackage?: () => void;
  onPatchPackage: (pkgId: string, patch: Partial<PackPackageDraft>) => void;
  onAddLine: (pkgId: string, lineId: string, qty: number) => boolean;
  onRemoveLineFromPackage: (pkgId: string, lineId: string) => void;
  onFinalize: (pkg: PackPackageDraft) => void;
  onPrintLabel: (pkg: PackPackageDraft) => void;
  onDeletePackage?: (pkgId: string) => void;
  onActivePackageChange: (id: string) => void;
}) {
  const { t } = useWmsTranslation();
  const packageTypeOptions = localizedPackageTypeOptions(t);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const detailPackage = detailPackageId
    ? packages.find((p) => p.id === detailPackageId)
    : undefined;

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-pack-action-trigger="true"]') ||
        target.closest('[data-pack-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const columns: Column<PackPackageDraft>[] = [
    {
      header: t(['Label', 'الملصق']),
      accessor: (pkg) => <span className="font-mono text-xs font-semibold text-slate-900">{pkg.label}</span>,
      width: '120px',
    },
    {
      header: t(['Type', 'النوع']),
      accessor: (pkg) => (
        <span className="text-slate-700">
          {packageTypeOptions.find((opt) => opt.value === pkg.packageType)?.label ?? pkg.packageType}
        </span>
      ),
      width: '100px',
    },
    {
      header: t(['Units', 'وحدات']),
      accessor: (pkg) => <span className="font-mono tabular-nums text-xs">{packageUnits(pkg)}</span>,
      width: '80px',
      className: 'text-right',
    },
    {
      header: t(['Weight (kg)', 'الوزن (كغ)']),
      accessor: (pkg) => (
        <span className="font-mono text-xs text-slate-600">{pkg.weightKg.trim() || '—'}</span>
      ),
      width: '100px',
      className: 'text-right',
    },
    {
      header: t(['Status', 'الحالة']),
      accessor: (pkg) => (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
            pkg.status === 'finalized'
              ? 'bg-slate-200 text-slate-700'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {pkg.status === 'finalized'
            ? t(['finalized', 'منتهٍ'])
            : t(['open', 'مفتوح'])}
        </span>
      ),
      width: '100px',
    },
    {
      header: '',
      accessor: (pkg) => (
        <div className="inline-flex justify-end" onClick={(e) => e.stopPropagation()}>
          <AnchoredDropdown
            open={openActionId === pkg.id}
            align="end"
            trigger={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                data-pack-action-trigger="true"
                onClick={() => setOpenActionId((cur) => (cur === pkg.id ? null : pkg.id))}
                aria-label={t(['Package actions', 'إجراءات الطرد'])}
                aria-expanded={openActionId === pkg.id}
                aria-haspopup="menu"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                </svg>
              </button>
            }
          >
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              data-pack-action-menu-button="true"
              onClick={() => {
                setOpenActionId(null);
                onPrintLabel(pkg);
              }}
            >
              {t(['Print', 'طباعة'])}
            </button>
            {onDeletePackage ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                data-pack-action-menu-button="true"
                onClick={() => {
                  setOpenActionId(null);
                  onDeletePackage(pkg.id);
                }}
              >
                {t(['Delete', 'حذف'])}
              </button>
            ) : null}
          </AnchoredDropdown>
        </div>
      ),
      width: '56px',
      className: 'text-right',
    },
  ];

  function openPackage(pkg: PackPackageDraft) {
    onActivePackageChange(pkg.id);
    onDetailPackageChange(pkg.id);
  }

  return (
    <>
      <DataTable
        title={t(['Packages', 'الطرود'])}
        columns={columns}
        rows={packages}
        rowKey={(pkg) => pkg.id}
        empty={t(['No packages yet.', 'لا طرود بعد.'])}
        onRowClick={openPackage}
        getRowClassName={() => 'cursor-pointer hover:bg-emerald-50/50'}
        actions={
          onAddPackage ? (
            <Button type="button" size="sm" variant="secondary" onClick={onAddPackage}>
              {t(['+ New package', '+ طرد جديد'])}
            </Button>
          ) : undefined
        }
      />

      <PackageDetailsModal
        open={detailPackage != null}
        pkg={detailPackage}
        lineIds={lineIds}
        lines={lines}
        lineMeta={lineMeta}
        packages={packages}
        readOnly={readOnly}
        onClose={() => onDetailPackageChange(null)}
        onPatchPackage={onPatchPackage}
        onAddLine={onAddLine}
        onRemoveLineFromPackage={onRemoveLineFromPackage}
        onFinalize={(pkg) => {
          onFinalize(pkg);
          onDetailPackageChange(null);
        }}
        onPrintLabel={onPrintLabel}
      />
    </>
  );
}
