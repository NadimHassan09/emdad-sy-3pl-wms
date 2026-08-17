import { type ReactNode, useId } from 'react';

import { Button } from './Button';
import { FilterAdvancedToggle } from './FilterAdvancedToggle';
import {
  FILTER_ACTIONS_INLINE_CLASS,
  FILTER_ACTIONS_ROW_CLASS,
  FILTER_ADVANCED_GRID_CLASS,
  FILTER_CARD_CLASS,
  FILTER_TOGGLE_ROW_CLASS,
  FILTER_TOOLBAR_ROW_CLASS,
} from './filter-panel-styles';
import { cn } from './cn';

export type AdvancedFilterSectionProps = {
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  compact: ReactNode;
  children: ReactNode;
  onApply: () => void;
  onReset: () => void;
  loading?: boolean;
  applyDisabled?: boolean;
  activeCount?: number;
  summary?: string | null;
  isArabic?: boolean;
  applyLabel?: string;
  resetLabel?: string;
  advancedLabel?: string;
  collapseLabel?: string;
  summaryPrefix?: string;
  className?: string;
  /** Extra classes for the expanded field grid. */
  gridClassName?: string;
};

export function AdvancedFilterSection({
  advancedOpen,
  onAdvancedOpenChange,
  compact,
  children,
  onApply,
  onReset,
  loading,
  applyDisabled,
  activeCount = 0,
  summary,
  isArabic,
  applyLabel,
  resetLabel,
  advancedLabel,
  collapseLabel,
  summaryPrefix,
  className,
  gridClassName,
}: AdvancedFilterSectionProps) {
  const regionId = useId();
  const resolvedAdvanced = advancedLabel ?? (isArabic ? 'تصفية متقدمة' : 'Advanced Filtering');
  const resolvedCollapse = collapseLabel ?? (isArabic ? 'إخفاء' : 'Collapsed');
  const resolvedApply = applyLabel ?? (isArabic ? 'تطبيق التصفية' : 'Apply Filters');
  const resolvedReset = resetLabel ?? (isArabic ? 'إعادة تعيين' : 'Reset Filters');
  const resolvedSummaryPrefix = summaryPrefix ?? (isArabic ? 'عوامل التصفية: ' : 'Filters: ');

  const badge =
    activeCount > 0 ? (
      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
        {activeCount}
      </span>
    ) : null;

  const actionButtons = (
    <>
      <Button type="button" variant="danger" size="md" onClick={onReset} disabled={loading}>
        {resolvedReset}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={loading}
        disabled={applyDisabled || loading}
      >
        {resolvedApply}
      </Button>
    </>
  );

  return (
    <div className={cn(FILTER_CARD_CLASS, className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply();
        }}
      >
        {advancedOpen ? (
          <div id={regionId} role="region" aria-label={resolvedAdvanced}>
            <div className={cn(FILTER_ADVANCED_GRID_CLASS, gridClassName)}>{children}</div>
            <div className={FILTER_ACTIONS_ROW_CLASS}>{actionButtons}</div>
          </div>
        ) : (
          <>
            <div className={FILTER_TOOLBAR_ROW_CLASS}>
              <div className="min-w-0 flex-1">{compact}</div>
              <div className={FILTER_ACTIONS_INLINE_CLASS}>{actionButtons}</div>
            </div>
            {summary ? (
              <p className="mt-3 truncate text-xs text-text-muted" title={summary}>
                {resolvedSummaryPrefix}
                {summary}
              </p>
            ) : null}
          </>
        )}
        <div className={FILTER_TOGGLE_ROW_CLASS}>
          <FilterAdvancedToggle
            advancedOpen={advancedOpen}
            onToggle={() => onAdvancedOpenChange(!advancedOpen)}
            advancedLabel={resolvedAdvanced}
            collapseLabel={resolvedCollapse}
            badge={badge}
            regionId={regionId}
          />
        </div>
      </form>
    </div>
  );
}
