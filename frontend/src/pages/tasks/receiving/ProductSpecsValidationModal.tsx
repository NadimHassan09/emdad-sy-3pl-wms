import { useMemo, useState } from 'react';
import type { Product } from '../../../api/products';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import { TextField } from '../../../components/TextField';
import type { ProductAttributeDraft } from './receiving-types';
import { formatDim } from './receiving-utils';

type SpecField = 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg';

const SPEC_FIELDS: Array<{ key: SpecField; label: string }> = [
  { key: 'lengthCm', label: 'Length (cm)' },
  { key: 'widthCm', label: 'Width (cm)' },
  { key: 'heightCm', label: 'Height (cm)' },
  { key: 'weightKg', label: 'Weight (kg)' },
];

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
  const [editing, setEditing] = useState<Partial<Record<SpecField, boolean>>>({});

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
      title="Validate product specs"
      widthClass="max-w-lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!draft.confirmedMatch && !draft.lengthCm && !draft.widthCm}
          >
            Confirm validation
          </Button>
        </>
      }
    >
      {product ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-900">{product.name}</p>
            <p className="font-mono text-xs text-slate-500">{product.sku}</p>
          </div>

          <div className="space-y-3">
            {SPEC_FIELDS.map(({ key, label }) => {
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
                      hint={isEditing ? `Registered: ${reg}` : undefined}
                    />
                  </div>
                  <button
                    type="button"
                    className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                    aria-label={isEditing ? `Stop editing ${label}` : `Edit ${label}`}
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

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              checked={draft.confirmedMatch}
              onChange={(e) => onChange({ confirmedMatch: e.target.checked })}
            />
            Physical measurements match system registration
          </label>

          <TextField
            label="Validation notes (optional)"
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-600">Product not found.</p>
      )}
    </Modal>
  );
}
