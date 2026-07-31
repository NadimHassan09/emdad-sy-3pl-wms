import { useEffect, useMemo, useState } from 'react';
import type { OutboundOrderLine } from '../../../api/outbound';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Column, DataTable } from '../../../components/DataTable';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
import { WedgeScanField } from '../../../components/WedgeScanField';
import { useToast } from '../../../components/ToastProvider';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import { localizedPackageTypeOptions } from '../../../lib/ui-labels/task-execution';
import type { PackLineDraft, PackPackageDraft } from './pack-types';
import {
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
  const { t } = useWmsTranslation();
  const toast = useToast();
  const packageTypeOptions = localizedPackageTypeOptions(t);
  const [productFilter, setProductFilter] = useState('');
  const [wedgeScan, setWedgeScan] = useState('');
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
      setWedgeScan('');
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

  function handleGunScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed || disabled) return;
    const lineId = findLineByProductScan(trimmed, lineIds, lineMeta);
    setWedgeScan('');
    setScanOpen(false);
    if (!lineId) {
      toast.error(t(['No matching product on this pack task.', 'لا منتج مطابق على مهمة التغليف هذه.']));
      setProductFilter(trimmed);
      return;
    }
    const line = lineById.get(lineId);
    if (!line) return;
    const remaining = remainingPackableQty(line, packages);
    if (remaining <= 0) {
      toast.error(t(['No remaining quantity to pack for this product.', 'لا كمية متبقية لتغليف هذا المنتج.']));
      setProductFilter(lineMeta.get(lineId)?.product?.sku ?? trimmed);
      return;
    }
    onAddLine(currentPkg.id, lineId, remaining);
  }

  function handleAddRow(lineId: string) {
    const qty = parseQty(qtyByLineId[lineId] ?? '1');
    if (qty <= 0) {
      toast.error(t(['Enter a positive quantity.', 'أدخل كمية موجبة.']));
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
      header: t(['Product', 'المنتج']),
      accessor: (r) => <span className="font-medium text-text-strong">{r.ol?.product?.name ?? '—'}</span>,
      width: '140px',
    },
    {
      header: t(['Picked', 'مُلتقط']),
      accessor: (r) => <span className="font-mono text-xs">{r.line.pickedQty}</span>,
      width: '70px',
      className: 'text-right',
    },
    {
      header: t(['In pkg', 'في الطرد']),
      accessor: (r) => (
        <span className="font-mono text-xs text-brand-700">
          {qtyInPackage(currentPkg, r.lineId)}
        </span>
      ),
      width: '70px',
      className: 'text-right',
    },
    {
      header: t(['Remaining', 'المتبقي']),
      accessor: (r) => (
        <span className="font-mono text-xs">{remainingPackableQty(r.line, packages)}</span>
      ),
      width: '80px',
      className: 'text-right',
    },
    {
      header: t(['Qty', 'الكمية']),
      accessor: (r) =>
        disabled ? (
          <span className="font-mono text-xs">{qtyByLineId[r.lineId] ?? '1'}</span>
        ) : (
          <input
            type="text"
            inputMode="decimal"
            className="w-16 rounded border border-border px-2 py-1 font-mono text-xs"
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
            {t(['Add', 'إضافة'])}
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
        title={t([`Ship prep — ${pkg.label}`, `تجهيز الشحن — ${pkg.label}`])}
        widthClass="max-w-3xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t(['Close', 'إغلاق'])}
            </Button>
            {!readOnly ? (
              <>
                <Button type="button" variant="ghost" onClick={() => onPrintLabel(pkg)}>
                  {t(['Print label', 'طباعة الملصق'])}
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  disabled={disabled}
                  onClick={() => onFinalize(pkg)}
                >
                  {t(['Finalize package', 'إنهاء الطرد'])}
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <div className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto pr-1 text-sm">
          <section className="space-y-3 rounded-lg border border-border-subtle bg-surface-card-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t(['Package details', 'تفاصيل الطرد'])}
            </p>
            <label className="block text-xs font-medium text-text-body">
              {t(['Type', 'النوع'])}
              <select
                className="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-sm disabled:bg-surface-card-muted"
                value={pkg.packageType}
                onChange={(e) =>
                  onPatchPackage(pkg.id, {
                    packageType: e.target.value as PackPackageDraft['packageType'],
                  })
                }
                disabled={disabled}
              >
                {packageTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['weightKg', t(['Weight (kg)', 'الوزن (كغ)'])],
                  ['lengthCm', t(['L (cm)', 'ط (سم)'])],
                  ['widthCm', t(['W (cm)', 'ع (سم)'])],
                  ['heightCm', t(['H (cm)', 'ار (سم)'])],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs font-medium text-text-body">
                  {label}
                  <input
                    className="mt-1 w-full rounded-md border border-border px-2 py-1.5 font-mono text-sm disabled:bg-surface-card-muted"
                    value={pkg[key]}
                    onChange={(e) => onPatchPackage(pkg.id, { [key]: e.target.value })}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t([
                `Contents (${itemRows.length} lines)`,
                `المحتويات (${itemRows.length} أسطر)`,
              ])}
            </p>
            {itemRows.length === 0 ? (
              <p className="text-xs text-text-muted">
                {t(['No products in this package yet.', 'لا منتجات في هذا الطرد بعد.'])}
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
                {itemRows.map(({ item, ol }) => (
                  <li
                    key={item.outboundOrderLineId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <p className="font-mono text-xs text-text-body">{ol?.product?.sku}</p>
                      <p className="font-medium text-text-strong">{ol?.product?.name}</p>
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
                          {t(['Remove', 'إزالة'])}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t(['Add products', 'إضافة منتجات'])}
            </p>
            {!disabled ? (
              <div className="rounded-xl border border-border bg-surface-card p-3">
                <WedgeScanField
                  label={t(['Scan to pack', 'امسح للتغليف'])}
                  value={wedgeScan}
                  onChange={setWedgeScan}
                  onScan={handleGunScan}
                  onCameraClick={() => setScanOpen(true)}
                  placeholder={t(['SKU or barcode + Enter', 'SKU أو باركود ثم Enter'])}
                  scanTitle={t(['Scan with camera', 'مسح بالكاميرا'])}
                  scanAriaLabel={t(['Scan product with camera', 'مسح المنتج بالكاميرا'])}
                  hint={t([
                    'Gun scan adds the remaining packable quantity for the matched product.',
                    'مسح الماسح يضيف الكمية المتبقية القابلة للتغليف للمنتج المطابق.',
                  ])}
                  disabled={disabled}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <TextField
                  label={t(['Filter products', 'تصفية المنتجات'])}
                  name="packAddProductFilter"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  placeholder={t(['SKU, product name, or Barcode', 'SKU أو اسم المنتج أو Barcode'])}
                  aria-label={t(['Filter products', 'تصفية المنتجات'])}
                  disabled={disabled}
                />
              </div>
            </div>
            <DataTable
              columns={addLineColumns}
              rows={packableRows}
              rowKey={(r) => r.lineId}
              empty={t(['No lines match the filter.', 'لا أسطر تطابق الفلتر.'])}
            />
          </section>
        </div>
      </Modal>

      <BarcodeScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleGunScan} />
    </>
  );
}
