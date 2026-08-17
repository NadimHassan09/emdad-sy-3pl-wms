import { type ReactNode, useId } from 'react';

import { Button } from './Button';
import { FILTER_APPLY_BUTTON_CLASS, FILTER_RESET_BUTTON_CLASS } from './filter-button-styles';
import {
  FILTER_ACTION_BUTTON_SIZE_CLASS,
  FILTER_OVERFLOW_TRANSITION_CLASS,
} from './filter-panel-styles';
import { cn } from './cn';

const ADVANCED_GRID_CLASS =
  'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3';

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
  const resolvedCollapse = collapseLabel ?? (isArabic ? 'إخفاء' : 'Collapse');
  const resolvedApply = applyLabel ?? (isArabic ? 'تطبيق التصفية' : 'Apply Filters');
  const resolvedReset = resetLabel ?? (isArabic ? 'إعادة تعيين' : 'Reset Filters');
  const resolvedSummaryPrefix = summaryPrefix ?? (isArabic ? 'عوامل التصفية: ' : 'Filters: ');

  const badge =
    activeCount > 0 ? (
      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
        {activeCount}
      </span>
    ) : null;

  return (
    <div
      className={cn(
        'mb-4 overflow-hidden rounded-xl border border-border bg-surface-panel p-4 shadow-soft',
        className,
      )}
    >
      {!advancedOpen ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="min-w-0 flex-1">{compact}</div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            aria-expanded={false}
            aria-controls={regionId}
            onClick={() => onAdvancedOpenChange(true)}
            className="inline-flex shrink-0 items-center gap-2"
          >
            <i className="fa-solid fa-sliders text-xs" aria-hidden />
            {resolvedAdvanced}
            {badge}
          </Button>
        </div>
      ) : (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-strong">
            <i className="fa-solid fa-sliders text-brand-700" aria-hidden />
            {resolvedAdvanced}
            {badge}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-expanded
            aria-controls={regionId}
            onClick={() => onAdvancedOpenChange(false)}
          >
            {resolvedCollapse}
          </Button>
        </div>
      )}

      <div
        id={regionId}
        role="region"
        aria-label={resolvedAdvanced}
        hidden={!advancedOpen}
        className={`${FILTER_OVERFLOW_TRANSITION_CLASS} ${
          advancedOpen ? 'mt-4 grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className={advancedOpen ? 'min-h-0' : 'min-h-0 overflow-hidden'}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onApply();
            }}
          >
            <div className={cn(ADVANCED_GRID_CLASS, gridClassName)}>{children}</div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={onReset}
                disabled={loading}
                className={`${FILTER_RESET_BUTTON_CLASS} ${FILTER_ACTION_BUTTON_SIZE_CLASS}`}
              >
                {resolvedReset}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                disabled={applyDisabled || loading}
                className={`${FILTER_APPLY_BUTTON_CLASS} ${FILTER_ACTION_BUTTON_SIZE_CLASS}`}
              >
                {resolvedApply}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {!advancedOpen && summary ? (
        <p className="mt-3 truncate text-xs text-text-muted" title={summary}>
          {resolvedSummaryPrefix}
          {summary}
        </p>
      ) : null}
    </div>
  );
}
