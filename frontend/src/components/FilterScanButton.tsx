import { BarcodeScanIcon } from './BarcodeScanIcon';
import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from './filter-panel-styles';

export function FilterScanButton({
  onClick,
  title,
  ariaLabel,
  label,
  compact = false,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  label?: string;
  compact?: boolean;
}) {
  const button = (
    <button
      type="button"
      className={`${FILTER_FIELD_CONTROL_CLASS} flex items-center justify-center gap-2 px-3 ${
        compact ? 'w-11 shrink-0 px-0' : 'w-full'
      }`}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <BarcodeScanIcon className="h-5 w-5" />
      {!compact ? <span className="truncate">{label ?? ariaLabel}</span> : null}
    </button>
  );

  if (compact) return button;

  return (
    <div className="min-w-0">
      <span className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
        {label ?? ariaLabel}
      </span>
      {button}
    </div>
  );
}
