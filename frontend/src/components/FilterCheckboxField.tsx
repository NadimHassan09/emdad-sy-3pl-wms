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
      <label className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm text-text-body">
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
