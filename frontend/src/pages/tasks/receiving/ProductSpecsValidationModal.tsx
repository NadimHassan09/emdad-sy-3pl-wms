import { useMemo, useState } from 'react';
import type { Product } from '../../../api/products';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import type { ProductAttributeDraft } from './receiving-types';
import { formatDim } from './receiving-utils';

type SpecField = 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg';

type Props = {
  open: boolean;
  product: Product | undefined;
  draft: ProductAttributeDraft;
  onChange: (patch: Partial<ProductAttributeDraft>) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ProductSpecsValidationModal({
  open,
  product,
  draft,
  onChange,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useWmsTranslation();
  const [editing, setEditing] = useState<Partial<Record<SpecField, boolean>>>({});

  const specFields: Array<{ key: SpecField; label: string }> = [
    { key: 'lengthCm', label: t(['Length (cm)', 'الطول (سم)']) },
    { key: 'widthCm', label: t(['Width (cm)', 'العرض (سم)']) },
    { key: 'heightCm', label: t(['Height (cm)', 'الارتفاع (سم)']) },
    { key: 'weightKg', label: t(['Weight (kg)', 'الوزن (كغ)']) },
  ];

  const registered = useMemo(
    () =>
      product
        ? {
            lengthCm: formatDim(product.lengthCm),
            widthCm: formatDim(product.widthCm),
            heightCm: formatDim(product.heightCm),
            weightKg: formatDim(product.weightKg),
          }
        : null,
    [product],
  );

  const handleClose = () => {
    setEditing({});
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    setEditing({});
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t(['Validate product specs', 'التحقق من مواصفات المنتج'])}
      widthClass="max-w-lg"
      footer={
        <>
          <Button type="button" variant="danger" onClick={handleClose}>
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!draft.confirmedMatch && !draft.lengthCm && !draft.widthCm}
          >
            {t(['Confirm validation', 'تأكيد التحقق'])}
          </Button>
        </>
      }
    >
      {product ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-text-strong">{product.name}</p>
            <p className="font-mono text-xs text-text-muted">{product.sku}</p>
          </div>

          <div className="space-y-3">
            {specFields.map(({ key, label }) => {
              const isEditing = !!editing[key];
              const reg = registered?.[key] ?? '—';
              return (
                <div key={key} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={label}
                      value={isEditing ? draft[key] : reg === '—' ? '' : reg}
                      disabled={!isEditing}
                      onChange={(e) => onChange({ [key]: e.target.value })}
                      hint={
                        isEditing
                          ? t([`Registered: ${reg}`, `المسجّل: ${reg}`])
                          : undefined
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-body transition hover:bg-surface-hover"
                    aria-label={
                      isEditing
                        ? t([`Stop editing ${label}`, `إيقاف تعديل ${label}`])
                        : t([`Edit ${label}`, `تعديل ${label}`])
                    }
                    onClick={() =>
                      setEditing((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))
                    }
                  >
                    <i className="fa-solid fa-pen text-sm" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-sm text-text-body">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-status-success-fg"
              checked={draft.confirmedMatch}
              onChange={(e) => onChange({ confirmedMatch: e.target.checked })}
            />
            {t([
              'Physical measurements match system registration',
              'القياسات الفعلية تطابق التسجيل في النظام',
            ])}
          </label>

          <TextField
            label={t(['Validation notes (optional)', 'ملاحظات التحقق (اختياري)'])}
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
      ) : (
        <p className="text-sm text-text-body">{t(['Product not found.', 'المنتج غير موجود.'])}</p>
      )}
    </Modal>
  );
}
