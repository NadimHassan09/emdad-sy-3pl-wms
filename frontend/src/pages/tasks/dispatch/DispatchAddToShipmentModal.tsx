import { useState } from 'react';
import type { OutboundOrderLine } from '../../../api/outbound';
import { BarcodeScanIcon } from '../../../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
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
  const [scanOpen, setScanOpen] = useState(false);

  function resetFields() {
    setProductInput('');
    setProductQty('1');
    setPackageInput('');
    setMode('product');
  }

  function handleClose() {
    resetFields();
    onClose();
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
      toast.error('Enter or scan a package label.');
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

  function handleScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (mode === 'product') {
      const lineId = findDispatchLineByProductScan(trimmed, lineIds, lineMeta);
      if (lineId) {
        const ol = lineMeta.get(lineId);
        setProductInput(ol?.product?.sku ?? trimmed);
      } else {
        setProductInput(trimmed);
      }
    } else {
      const pkg = findPackageByLabel(trimmed, packages);
      setPackageInput(pkg?.label ?? trimmed);
    }
    setScanOpen(false);
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
          <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                mode === 'product' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'
              }`}
              onClick={() => setMode('product')}
            >
              {t(['By product', 'حسب المنتج'])}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                mode === 'package' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'
              }`}
              onClick={() => setMode('package')}
            >
              {t(['By package', 'حسب الطرد'])}
            </button>
          </div>

          {mode === 'product' ? (
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-slate-700">{t(['Product', 'المنتج'])}</span>
                <div className="mt-1 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      name="dispatchAddProduct"
                      value={productInput}
                      onChange={(e) => setProductInput(e.target.value)}
                      placeholder={t(['SKU, name, or Barcode', 'SKU أو الاسم أو Barcode'])}
                      className="!mt-0 w-full"
                      aria-label={t(['Product', 'المنتج'])}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="mt-0 shrink-0 px-2.5"
                    onClick={() => setScanOpen(true)}
                    aria-label="Scan product"
                    title="Scan product barcode"
                  >
                    <BarcodeScanIcon className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <TextField
                label={t(['Quantity to ship', 'الكمية للشحن'])}
                name="dispatchAddProductQty"
                value={productQty}
                onChange={(e) => setProductQty(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-xs text-slate-500">
                {t([
                  `${lines.length} line(s) on this order. Quantity cannot exceed picked amount.`,
                  `${lines.length} سطر(أسطر) على هذا الطلب. لا يمكن تجاوز الكمية المُلتقطة.`,
                ])}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-slate-700">{t(['Package label', 'ملصق الطرد'])}</span>
                <div className="mt-1 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      name="dispatchAddPackage"
                      value={packageInput}
                      onChange={(e) => setPackageInput(e.target.value)}
                      placeholder="PKG-001"
                      className="!mt-0 w-full"
                      aria-label="Package label"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="mt-0 shrink-0 px-2.5"
                    onClick={() => setScanOpen(true)}
                    aria-label="Scan package"
                    title="Scan package label"
                  >
                    <BarcodeScanIcon className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              {unscannedPackages.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-slate-600">{t(['Pending packages', 'طرود معلّقة'])}</p>
                  <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2">
                    {unscannedPackages.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full rounded px-2 py-1 text-left font-mono text-xs hover:bg-emerald-50"
                          onClick={() => setPackageInput(p.label)}
                        >
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {t(['All packages are already marked as loaded.', 'جميع الطرود مُعلَّمة كمحمّلة.'])}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <BarcodeScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </>
  );
}
