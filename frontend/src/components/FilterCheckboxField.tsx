import { FILTER_FIELD_LABEL_CLASS, FILTER_FIELD_LABEL_GAP_CLASS } from './filter-panel-styles';

export function FilterCheckboxField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <div className="min-w-0">
      <span className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>{label}</span>
      <label className="flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface-panel px-3 text-sm text-text-body shadow-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
        />
        <span>{description ?? label}</span>
      </label>
    </div>
  );
}
