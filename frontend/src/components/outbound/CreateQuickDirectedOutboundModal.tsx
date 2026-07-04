import { useState } from 'react';

import type {
  QuickDirectedOutboundInput,
  QuickDirectedOutboundReasonCode,
} from '../../api/outbound';
import { BarcodeScanIcon } from '../BarcodeScanIcon';
import { BarcodeScanModal } from '../BarcodeScanModal';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import { QUICK_DIRECTED_REASON_OPTIONS } from '../../lib/quick-directed-outbound';
import { useWmsTranslation } from '../../lib/ui-i18n';

export function CreateQuickDirectedOutboundModal({
  open,
  onClose,
  loading,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onSubmit: (input: Omit<QuickDirectedOutboundInput, 'warehouseId'>) => void;
}) {
  const { t, isArabic } = useWmsTranslation();
  const [productCode, setProductCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reasonCode, setReasonCode] = useState<QuickDirectedOutboundReasonCode>('consumption');
  const [scanOpen, setScanOpen] = useState(false);

  function reset() {
    setProductCode('');
    setQuantity('1');
    setReasonCode('consumption');
    setScanOpen(false);
  }

  function handleClose() {
    if (!loading) {
      reset();
      onClose();
    }
  }

  function handleSubmit() {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return;
    }
    const code = productCode.trim();
    if (!code) return;
    onSubmit({ productCode: code, quantity: qty, reasonCode });
  }

  const reasonOptions = QUICK_DIRECTED_REASON_OPTIONS.map((option) => ({
    value: option.value,
    label: isArabic ? option.labelAr : option.labelEn,
  }));

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={t(['New quick outbound', 'إخراج سريع جديد'])}
        widthClass="max-w-lg"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
              {t(['Cancel', 'إلغاء'])}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || !productCode.trim() || !quantity.trim()}
              loading={loading}
            >
              {t(['Confirm outbound', 'تأكيد الإخراج'])}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField
            label={t(['Barcode / SKU', 'الباركود / SKU'])}
            value={productCode}
            onChange={(event) => setProductCode(event.target.value)}
            placeholder={t(['Scan or type barcode / SKU', 'امسح أو اكتب الباركود / SKU'])}
            endAdornment={
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="!h-11"
                onClick={() => setScanOpen(true)}
                aria-label={t(['Scan product', 'مسح المنتج'])}
              >
                <BarcodeScanIcon />
              </Button>
            }
          />
          <TextField
            label={t(['Quantity', 'الكمية'])}
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <SelectField
            label={t(['Reason', 'سبب الإخراج'])}
            value={reasonCode}
            onChange={(event) =>
              setReasonCode(event.target.value as QuickDirectedOutboundReasonCode)
            }
            options={reasonOptions}
          />
        </div>
      </Modal>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(code) => {
          setProductCode(code.trim());
          setScanOpen(false);
        }}
      />
    </>
  );
}
