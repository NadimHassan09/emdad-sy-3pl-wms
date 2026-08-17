import { type ReactNode } from 'react';

import { cn } from './cn';
import { FILTER_ADVANCED_TOGGLE_CLASS } from './filter-panel-styles';

export type FilterAdvancedToggleProps = {
  advancedOpen: boolean;
  onToggle: () => void;
  advancedLabel: string;
  collapseLabel: string;
  badge?: ReactNode;
  regionId?: string;
  className?: string;
};

/** Text-style expand/collapse control — not a button chip. */
export function FilterAdvancedToggle({
  advancedOpen,
  onToggle,
  advancedLabel,
  collapseLabel,
  badge,
  regionId,
  className,
}: FilterAdvancedToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={advancedOpen}
      aria-controls={regionId}
      onClick={onToggle}
      className={cn(FILTER_ADVANCED_TOGGLE_CLASS, className)}
    >
      <span className="inline-flex items-center gap-2">
        {advancedOpen ? collapseLabel : advancedLabel}
        {badge}
      </span>
      <span className="text-sm font-semibold text-cta" aria-hidden>
        {advancedOpen ? '−' : '+'}
      </span>
    </button>
  );
}
