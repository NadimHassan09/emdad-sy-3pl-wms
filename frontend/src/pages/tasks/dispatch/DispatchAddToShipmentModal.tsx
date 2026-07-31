import { useState } from 'react';
import type { OutboundOrderLine } from '../../../api/outbound';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
import { WedgeScanField } from '../../../components/WedgeScanField';
import { useToast } from '../../../components/ToastProvider';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import type { DispatchLineDraft, DispatchPackageDraft } from './dispatch-types';
import { findDispatchLineByProductScan, findPackageByLabel, parseQty } from './dispatch-utils';

type AddMode = 'product' | 'package';

export function DispatchAddToShipmentModal({
  open,
  onClose,
  lineIds,
  lines,
  lineMeta,
  packages,
  onAddProduct,
  onAddPackage,
}: {
  open: boolean;
  onClose: () => void;
  lineIds: string[];
  lines: DispatchLineDraft[];
  lineMeta: Map<string, OutboundOrderLine>;
  packages: DispatchPackageDraft[];
  onAddProduct: (lineId: string, qty: number) => boolean;
  onAddPackage: (pkgId: string) => boolean;
}) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const [mode, setMode] = useState<AddMode>('product');
  const [productInput, setProductInput] = useState('');
  const [productQty, setProductQty] = useState('1');
  const [packageInput, setPackageInput] = useState('');
  const [wedgeScan, setWedgeScan] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  function resetFields() {
    setProductInput('');
    setProductQty('1');
    setPackageInput('');
    setWedgeScan('');
    setMode('product');
  }

  function handleClose() {
    resetFields();
    onClose();
  }

  /** Try package label first, then product — add remaining shippable qty for products. */
  function commitGunScan(code: string): boolean {
    const trimmed = code.trim();
    if (!trimmed) return false;

    const pkg = findPackageByLabel(trimmed, packages);
    if (pkg) {
      if (onAddPackage(pkg.id)) {
        setWedgeScan('');
        return true;
      }
      return false;
    }

    const lineId = findDispatchLineByProductScan(trimmed, lineIds, lineMeta);
    if (lineId) {
      const line = lines.find((l) => l.outboundOrderLineId === lineId);
      const remaining = line
        ? Math.max(0, parseQty(line.pickedQty) - parseQty(line.shipQty))
        : 0;
      const qty = remaining > 0 ? remaining : 1;
      if (onAddProduct(lineId, qty)) {
        setWedgeScan('');
        return true;
      }
      return false;
    }

    toast.error(
      t([
        'No matching package or product on this shipment.',
        'لا طرد أو منتج مطابق على هذه الشحنة.',
      ]),
    );
    return false;
  }

  function handleGunScan(code: string) {
    setScanOpen(false);
    commitGunScan(code);
  }

  function handleAddProduct() {
    const trimmed = productInput.trim();
    if (!trimmed) {
      toast.error(t(['Enter SKU, product name, or scan a Barcode.', 'أدخل SKU أو اسم المنتج أو امسح Barcode.']));
      return;
    }
    const lineId =
      findDispatchLineByProductScan(trimmed, lineIds, lineMeta) ??
      lineIds.find((id) => {
        const ol = lineMeta.get(id);
        const sku = ol?.product?.sku?.toLowerCase() ?? '';
        const name = ol?.product?.name?.toLowerCase() ?? '';
        const q = trimmed.toLowerCase();
        return sku.includes(q) || name.includes(q);
      });
    if (!lineId) {
      toast.error(t(['No matching product on this shipment.', 'لا منتج مطابق على هذه الشحنة.']));
      return;
    }
    const qty = parseQty(productQty);
    if (qty <= 0) {
      toast.error(t(['Enter a positive quantity.', 'أدخل كمية موجبة.']));
      return;
    }
    if (onAddProduct(lineId, qty)) {
      resetFields();
      onClose();
    }
  }

  function handleAddPackage() {
    const trimmed = packageInput.trim();
    if (!trimmed) {
      toast.error(t(['Enter or scan a package label.', 'أدخل أو امسح ملصق طرد.']));
      return;
    }
    const pkg = findPackageByLabel(trimmed, packages);
    if (!pkg) {
      toast.error(t(['Package label not on this shipment.', 'ملصق الطرد غير موجود على هذه الشحنة.']));
      return;
    }
    if (onAddPackage(pkg.id)) {
      resetFields();
      onClose();
    }
  }

  const unscannedPackages = packages.filter((p) => !p.scanned);

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={t(['Add to shipment', 'إضافة إلى الشحنة'])}
        widthClass="max-w-md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              {t(['Cancel', 'إلغاء'])}
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={mode === 'product' ? handleAddProduct : handleAddPackage}
            >
              {t(['Add', 'إضافة'])}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-border bg-surface-card p-3">
            <WedgeScanField
              label={t(['Scan package or product', 'امسح طرداً أو منتجاً'])}
              value={wedgeScan}
              onChange={setWedgeScan}
              onScan={handleGunScan}
              onCameraClick={() => setScanOpen(true)}
              placeholder={t(['Label, SKU, or barcode + Enter', 'ملصق أو SKU أو باركود ثم Enter'])}
              scanTitle={t(['Scan with camera', 'مسح بالكاميرا'])}
              scanAriaLabel={t(['Scan with camera', 'مسح بالكاميرا'])}
              hint={t([
                'Tries package label first, then product. Camera is secondary.',
                'يجرّب ملصق الطرد أولاً ثم المنتج. الكاميرا مسار ثانوي.',
              ])}
            />
          </div>

          <div className="flex gap-2 rounded-lg bg-surface-card-muted p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                mode === 'product' ? 'bg-surface-card text-brand-700 shadow-sm' : 'text-text-body'
              }`}
              onClick={() => setMode('product')}
            >
              {t(['By product', 'حسب المنتج'])}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                mode === 'package' ? 'bg-surface-card text-brand-700 shadow-sm' : 'text-text-body'
              }`}
              onClick={() => setMode('package')}
            >
              {t(['By package', 'حسب الطرد'])}
            </button>
          </div>

          {mode === 'product' ? (
            <div className="space-y-3">
              <TextField
                label={t(['Product', 'المنتج'])}
                name="dispatchAddProduct"
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                placeholder={t(['SKU, name, or Barcode', 'SKU أو الاسم أو Barcode'])}
                aria-label={t(['Product', 'المنتج'])}
              />
              <TextField
                label={t(['Quantity to ship', 'الكمية للشحن'])}
                name="dispatchAddProductQty"
                value={productQty}
                onChange={(e) => setProductQty(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-xs text-text-muted">
                {t([
                  `${lines.length} line(s) on this order. Quantity cannot exceed picked amount.`,
                  `${lines.length} سطر(أسطر) على هذا الطلب. لا يمكن تجاوز الكمية المُلتقطة.`,
                ])}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <TextField
                label={t(['Package label', 'ملصق الطرد'])}
                name="dispatchAddPackage"
                value={packageInput}
                onChange={(e) => setPackageInput(e.target.value)}
                placeholder="PKG-001"
                aria-label={t(['Package label', 'ملصق الطرد'])}
              />
              {unscannedPackages.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-text-body">{t(['Pending packages', 'طرود معلّقة'])}</p>
                  <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border-subtle p-2">
                    {unscannedPackages.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full rounded px-2 py-1 text-left font-mono text-xs hover:bg-surface-hover"
                          onClick={() => setPackageInput(p.label)}
                        >
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  {t(['All packages are already marked as loaded.', 'جميع الطرود مُعلَّمة كمحمّلة.'])}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <BarcodeScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleGunScan} />
    </>
  );
}
