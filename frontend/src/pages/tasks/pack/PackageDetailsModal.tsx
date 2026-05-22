import { useEffect, useMemo, useState } from 'react';
import type { OutboundOrderLine } from '../../../api/outbound';
import { BarcodeScanIcon } from '../../../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Column, DataTable } from '../../../components/DataTable';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
import { useToast } from '../../../components/ToastProvider';
import type { PackLineDraft, PackPackageDraft } from './pack-types';
import {
  PACKAGE_TYPE_OPTIONS,
  filterPackLineIdsByProduct,
  findLineByProductScan,
  qtyInPackage,
  remainingPackableQty,
} from './pack-utils';
import { parseQty } from '../putaway/putaway-utils';

type PackableLineRow = {
  lineId: string;
  line: PackLineDraft;
  ol: OutboundOrderLine | undefined;
};

export function PackageDetailsModal({
  open,
  pkg,
  lineIds,
  lines,
  lineMeta,
  packages,
  readOnly,
  onClose,
  onPatchPackage,
  onAddLine,
  onRemoveLineFromPackage,
  onFinalize,
  onPrintLabel,
}: {
  open: boolean;
  pkg: PackPackageDraft | undefined;
  lineIds: string[];
  lines: PackLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  packages: PackPackageDraft[];
  readOnly?: boolean;
  onClose: () => void;
  onPatchPackage: (pkgId: string, patch: Partial<PackPackageDraft>) => void;
  onAddLine: (pkgId: string, lineId: string, qty: number) => boolean;
  onRemoveLineFromPackage: (pkgId: string, lineId: string) => void;
  onFinalize: (pkg: PackPackageDraft) => void;
  onPrintLabel: (pkg: PackPackageDraft) => void;
}) {
  const toast = useToast();
  const [productFilter, setProductFilter] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [qtyByLineId, setQtyByLineId] = useState<Record<string, string>>({});

  const lineById = useMemo(() => new Map(lines.map((l) => [l.outboundOrderLineId, l])), [lines]);

  const filteredLineIds = useMemo(
    () => filterPackLineIdsByProduct(lineIds, lineMeta, productFilter),
    [lineIds, lineMeta, productFilter],
  );

  const packableRows: PackableLineRow[] = useMemo(
    () =>
      filteredLineIds
        .map((lineId) => {
          const line = lineById.get(lineId);
          if (!line) return null;
          return { lineId, line, ol: lineMeta.get(lineId) };
        })
        .filter((r): r is PackableLineRow => r != null),
    [filteredLineIds, lineById, lineMeta],
  );

  useEffect(() => {
    if (!open) {
      setProductFilter('');
      setQtyByLineId({});
    }
  }, [open]);

  if (!pkg) return null;

  const currentPkg = pkg;
  const finalized = currentPkg.status === 'finalized';
  const disabled = readOnly || finalized;

  const itemRows = currentPkg.items
    .map((item) => {
      const ol = lineMeta.get(item.outboundOrderLineId);
      const line = lineById.get(item.outboundOrderLineId);
      if (!line) return null;
      return { item, ol, line };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  function handleScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    const lineId = findLineByProductScan(trimmed, lineIds, lineMeta);
    if (lineId) {
      const ol = lineMeta.get(lineId);
      setProductFilter(ol?.product?.sku ?? trimmed);
    } else {
      setProductFilter(trimmed);
    }
    setScanOpen(false);
  }

  function handleAddRow(lineId: string) {
    const qty = parseQty(qtyByLineId[lineId] ?? '1');
    if (qty <= 0) {
      toast.error('Enter a positive quantity.');
      return;
    }
    onAddLine(currentPkg.id, lineId, qty);
  }

  const addLineColumns: Column<PackableLineRow>[] = [
    {
      header: 'SKU',
      accessor: (r) => <span className="font-mono text-xs">{r.ol?.product?.sku ?? '—'}</span>,
      width: '110px',
    },
    {
      header: 'Product',
      accessor: (r) => <span className="font-medium text-slate-800">{r.ol?.product?.name ?? '—'}</span>,
      width: '140px',
    },
    {
      header: 'Picked',
      accessor: (r) => <span className="font-mono text-xs">{r.line.pickedQty}</span>,
      width: '70px',
      className: 'text-right',
    },
    {
      header: 'In pkg',
      accessor: (r) => (
        <span className="font-mono text-xs text-emerald-800">
          {qtyInPackage(currentPkg, r.lineId)}
        </span>
      ),
      width: '70px',
      className: 'text-right',
    },
    {
      header: 'Remaining',
      accessor: (r) => (
        <span className="font-mono text-xs">{remainingPackableQty(r.line, packages)}</span>
      ),
      width: '80px',
      className: 'text-right',
    },
    {
      header: 'Qty',
      accessor: (r) =>
        disabled ? (
          <span className="font-mono text-xs">{qtyByLineId[r.lineId] ?? '1'}</span>
        ) : (
          <input
            type="text"
            inputMode="decimal"
            className="w-16 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
            value={qtyByLineId[r.lineId] ?? '1'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              setQtyByLineId((prev) => ({ ...prev, [r.lineId]: e.target.value }))
            }
          />
        ),
      width: '80px',
    },
    {
      header: '',
      accessor: (r) =>
        disabled ? null : (
          <Button
            type="button"
            size="sm"
            variant="brand"
            onClick={(e) => {
              e.stopPropagation();
              handleAddRow(r.lineId);
            }}
          >
            Add
          </Button>
        ),
      width: '72px',
      className: 'text-right',
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Ship prep — ${pkg.label}`}
        widthClass="max-w-3xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {!readOnly ? (
              <>
                <Button type="button" variant="ghost" onClick={() => onPrintLabel(pkg)}>
                  Print label
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  disabled={disabled}
                  onClick={() => onFinalize(pkg)}
                >
                  Finalize package
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <div className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto pr-1 text-sm">
          <section className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Package details</p>
            <label className="block text-xs font-medium text-slate-700">
              Type
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
                value={pkg.packageType}
                onChange={(e) =>
                  onPatchPackage(pkg.id, {
                    packageType: e.target.value as PackPackageDraft['packageType'],
                  })
                }
                disabled={disabled}
              >
                {PACKAGE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['weightKg', 'Weight (kg)'],
                  ['lengthCm', 'L (cm)'],
                  ['widthCm', 'W (cm)'],
                  ['heightCm', 'H (cm)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs font-medium text-slate-700">
                  {label}
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm disabled:bg-slate-50"
                    value={pkg[key]}
                    onChange={(e) => onPatchPackage(pkg.id, { [key]: e.target.value })}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contents ({itemRows.length} lines)
            </p>
            {itemRows.length === 0 ? (
              <p className="text-xs text-slate-500">No products in this package yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {itemRows.map(({ item, ol }) => (
                  <li
                    key={item.outboundOrderLineId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <p className="font-mono text-xs text-slate-600">{ol?.product?.sku}</p>
                      <p className="font-medium text-slate-900">{ol?.product?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{item.quantity}</span>
                      {!disabled ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            onRemoveLineFromPackage(pkg.id, item.outboundOrderLineId)
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add products</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-700">Product</span>
                <div className="mt-1 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      name="packAddProductFilter"
                      value={productFilter}
                      onChange={(e) => setProductFilter(e.target.value)}
                      placeholder="SKU, product name, or barcode"
                      className="!mt-0 w-full"
                      aria-label="Filter products"
                      disabled={disabled}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="mt-0 shrink-0 px-2.5"
                    disabled={disabled}
                    onClick={() => setScanOpen(true)}
                    aria-label="Scan product"
                    title="Scan product barcode"
                  >
                    <BarcodeScanIcon className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            <DataTable
              columns={addLineColumns}
              rows={packableRows}
              rowKey={(r) => r.lineId}
              empty="No lines match the filter."
            />
          </section>
        </div>
      </Modal>

      <BarcodeScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </>
  );
}
