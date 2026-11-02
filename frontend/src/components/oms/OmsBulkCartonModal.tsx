import { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import {
  buildDefaultCartons,
  getBabelPackingValidationError,
  hasOverPacking,
  isBabelProvider,
  packingSummary,
  resizeCartons,
  totalCartonsWeightKg,
  type OrderProductCatalog,
  type ShippingCartonValue,
} from '../shipping/carrier-shipping-form';
import { PackingSummaryPanel, ShippingCartonEditor } from '../shipping/ShippingCartonEditor';

type Props = {
  open: boolean;
  orderNumber: string;
  clientName: string;
  customerName: string;
  providerCode: string;
  carrierName: string;
  cartons: ShippingCartonValue[];
  catalog: OrderProductCatalog[];
  onClose: () => void;
  onSave: (cartons: ShippingCartonValue[]) => void;
  isArabic?: boolean;
};

export function OmsBulkCartonModal({
  open,
  orderNumber,
  clientName,
  customerName,
  providerCode,
  carrierName,
  cartons: initialCartons,
  catalog,
  onClose,
  onSave,
  isArabic = false,
}: Props) {
  const [cartons, setCartons] = useState<ShippingCartonValue[]>([]);
  const isBabel = isBabelProvider(providerCode);

  useEffect(() => {
    if (open) {
      if (initialCartons && initialCartons.length > 0) {
        setCartons(initialCartons);
      } else {
        setCartons(buildDefaultCartons(catalog));
      }
    }
  }, [open, initialCartons, catalog]);

  if (!open) return null;

  const summary = packingSummary(cartons, catalog);
  const validationError = isBabel
    ? getBabelPackingValidationError(cartons, catalog, isArabic)
    : hasOverPacking(summary)
      ? (isArabic
          ? 'الكمية الموزعة لبعض المنتجات تتجاوز الكمية المطلوبة.'
          : 'Distributed quantity exceeds ordered quantity for some products.')
      : null;

  const handlePackageCountChange = (n: number) => {
    const validN = Math.max(1, Math.min(50, n));
    setCartons((prev) => resizeCartons(prev, validN, catalog));
  };

  const handleSave = () => {
    if (isBabel && validationError) return;
    onSave(cartons);
  };

  const totalWeight = totalCartonsWeightKg(cartons, catalog);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isArabic
          ? `توزيع الطرود والمنتجات — طلب رقم ${orderNumber}`
          : `Package & Product Breakdown — Order #${orderNumber}`
      }
      widthClass="max-w-3xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto p-1">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-sunken p-3 text-xs">
          <div>
            <span className="text-text-muted">{isArabic ? 'العميل: ' : 'Client: '}</span>
            <span className="font-bold text-text-strong">{clientName}</span>
          </div>
          <div>
            <span className="text-text-muted">{isArabic ? 'المستلم: ' : 'Recipient: '}</span>
            <span className="font-bold text-text-strong">{customerName}</span>
          </div>
          <div>
            <span className="text-text-muted">{isArabic ? 'شركة الشحن: ' : 'Carrier: '}</span>
            <span className="font-bold text-text-strong">{carrierName || providerCode || '—'}</span>
          </div>
        </div>

        {isBabel && (
          <div className="rounded-xl border border-sky-300 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/40 p-3 text-xs space-y-1">
            <div className="font-bold text-sky-900 dark:text-sky-100 flex items-center gap-1.5">
              <i className="fa-solid fa-boxes-stacked text-sky-600" />
              <span>
                {isArabic
                  ? 'شحنة بابل إكسبريس متعددة الطرود (Babel Multi-Package)'
                  : 'Babel Express Multi-Package Shipment'}
              </span>
            </div>
            <p className="text-sky-800 dark:text-sky-200">
              {isArabic
                ? 'تقوم شركة بابل بإصدار باركود شحن وبوليصة مستقلة لكل طرد. يجب تحديد عدد الطرود وتوزيع كافة كميات المنتجات عليها بالكامل ليتم إصدار البوالص بنجاح.'
                : 'Babel Express issues a separate barcode and waybill label for each package. Please select package count and distribute all product quantities.'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-strong mb-1">
              {isArabic ? 'عدد الطرود (Number of Packages)' : 'Number of packages'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                value={cartons.length}
                onChange={(e) =>
                  handlePackageCountChange(Math.floor(Number(e.target.value)) || 1)
                }
                className="w-24 rounded-lg border border-border-subtle bg-surface-card px-3 py-1.5 text-sm font-bold text-text-strong"
              />
              <span className="text-xs text-text-muted">
                {isArabic ? `(${cartons.length} طرد)` : `(${cartons.length} pkg)`}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              {isArabic
                ? 'الطرود الفعلية التي ستستلمها شركة الشحن'
                : 'Physical cartons the carrier will receive'}
            </p>
          </div>

          <div className="text-end">
            <span className="block text-xs text-text-muted">
              {isArabic ? 'إجمالي وزن الشحنة' : 'Total shipment weight'}
            </span>
            <span className="text-sm font-bold tabular-nums text-text-strong">
              {totalWeight} kg
            </span>
          </div>
        </div>

        <PackingSummaryPanel rows={summary} isArabic={isArabic} />

        {validationError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
            <i className="fa-solid fa-triangle-exclamation text-amber-600" />
            <span>{validationError}</span>
          </div>
        )}

        <ShippingCartonEditor
          cartons={cartons}
          catalog={catalog}
          isArabic={isArabic}
          onChange={setCartons}
        />
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border-subtle pt-3">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {isArabic ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={Boolean(isBabel && validationError)}
          onClick={handleSave}
          className="bg-primary hover:bg-primary-hover text-white font-semibold"
        >
          <i className="fa-solid fa-check text-xs me-1.5" />
          <span>{isArabic ? 'حفظ وتوزيع الطرود' : 'Save Packages'}</span>
        </Button>
      </div>
    </Modal>
  );
}
