import type { Product } from '../../../api/products';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import type { ProductAttributeDraft } from './receiving-types';
import { formatDim } from './receiving-utils';

type Props = {
  product: Product;
  draft: ProductAttributeDraft;
  onChange: (patch: Partial<ProductAttributeDraft>) => void;
  onConfirm: () => void;
  readOnly?: boolean;
};

export function ProductAttributeValidationCard({
  product,
  draft,
  onChange,
  onConfirm,
  readOnly,
}: Props) {
  const { t } = useWmsTranslation();

  const registered = {
    lengthCm: formatDim(product.lengthCm),
    widthCm: formatDim(product.widthCm),
    heightCm: formatDim(product.heightCm),
    weightKg: formatDim(product.weightKg),
  };

  const dimensionFields = [
    { label: t(['Length (cm)', 'الطول (cm)']), key: 'lengthCm' as const, reg: registered.lengthCm },
    { label: t(['Width (cm)', 'العرض (cm)']), key: 'widthCm' as const, reg: registered.widthCm },
    { label: t(['Height (cm)', 'الارتفاع (cm)']), key: 'heightCm' as const, reg: registered.heightCm },
    { label: t(['Weight (kg)', 'الوزن (kg)']), key: 'weightKg' as const, reg: registered.weightKg },
  ];

  return (
    <div className="rounded-2xl border border-status-warning-border bg-status-warning-bg/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-status-warning-fg">
            {t(['First inbound — validate physical attributes', 'أول استلام — التحقق من الخصائص الفيزيائية'])}
          </p>
          <p className="mt-1 text-sm font-medium text-text-strong">{product.name}</p>
          <p className="font-mono text-xs text-text-body">{product.sku}</p>
        </div>
        {draft.completed ? (
          <span className="rounded-full bg-status-success-bg px-2.5 py-1 text-xs font-semibold text-brand-700">
            {t(['Validated', 'تم التحقق'])}
          </span>
        ) : (
          <span className="rounded-full bg-status-warning-bg px-2.5 py-1 text-xs font-semibold text-status-warning-fg">
            {t(['Required', 'مطلوب'])}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {dimensionFields.map(({ label, key, reg }) => (
          <div key={key} className="rounded-xl border border-border-subtle bg-surface-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
            <p className="mt-1 text-xs text-text-muted">
              {t(['System:', 'النظام:'])}{' '}
              <span className="font-mono text-text-strong">{reg}</span>
            </p>
            {!readOnly && (
              <input
                type="text"
                inputMode="decimal"
                className="mt-2 w-full rounded-lg border border-border px-2 py-2 text-sm"
                placeholder={t(['Measured', 'المقاس'])}
                value={draft[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                aria-label={t(['Measured value', 'القيمة المقاسة'])}
              />
            )}
            {readOnly && draft[key] ? (
              <p className="mt-2 font-mono text-sm text-text-strong">{draft[key]}</p>
            ) : null}
          </div>
        ))}
      </div>

      {!readOnly ? (
        <>
          <label className="mt-4 flex items-center gap-2 text-sm text-text-body">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-status-success-fg"
              checked={draft.confirmedMatch}
              onChange={(e) => onChange({ confirmedMatch: e.target.checked })}
            />
            {t([
              'Physical measurements match system registration',
              'القياسات الفيزيائية تطابق تسجيل النظام',
            ])}
          </label>
          <TextField
            label={t(['Validation notes (optional)', 'ملاحظات التحقق (اختياري)'])}
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            className="mt-3"
          />
          <Button
            type="button"
            className="mt-3 w-full min-h-[44px] sm:w-auto"
            variant="secondary"
            disabled={!draft.confirmedMatch && !draft.lengthCm && !draft.widthCm}
            onClick={onConfirm}
          >
            {t(['Confirm attribute validation', 'تأكيد التحقق من الخصائص'])}
          </Button>
        </>
      ) : null}
    </div>
  );
}
