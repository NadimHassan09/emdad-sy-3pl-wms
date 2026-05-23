import { Button, FILTER_APPLY_BUTTON_CLASS, FILTER_RESET_BUTTON_CLASS } from '@ds';
import type { ReactNode } from 'react';

/** @deprecated Use FILTER_APPLY_BUTTON_CLASS from @ds */
export const FILTER_PRIMARY_BUTTON_CLASS = FILTER_APPLY_BUTTON_CLASS;

export { FILTER_APPLY_BUTTON_CLASS, FILTER_RESET_BUTTON_CLASS };

/** Shared white panel shell (filters, order details, workflow timeline, etc.). */
export const PANEL_CARD_CLASS =
  'mb-4 space-y-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4';

export const PANEL_TITLE_CLASS = 'text-base font-semibold text-slate-900';

export function FilterPanel({
  children,
  title = 'Filters',
  headerActions,
  onApply,
  onReset,
  applyDisabled,
  loading,
  applyLabel = 'Apply filters',
  resetLabel = 'Reset',
  className,
}: {
  children: ReactNode;
  title?: ReactNode;
  /** Optional controls in the panel header (top right), e.g. order actions. */
  headerActions?: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  applyDisabled?: boolean;
  loading?: boolean;
  applyLabel?: string;
  resetLabel?: string;
  className?: string;
}) {
  const showActions = onApply != null && onReset != null;
  const showHeaderRow = headerActions != null || showActions;

  return (
    <div
      className={[PANEL_CARD_CLASS, className].filter(Boolean).join(' ')}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={PANEL_TITLE_CLASS}>{title}</h2>
        {showHeaderRow && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {headerActions}
            {showActions && (
              <>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={onReset}
              disabled={loading}
              className={`${FILTER_RESET_BUTTON_CLASS} h-[34px] !py-0`}
            >
              {resetLabel}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onApply}
              disabled={applyDisabled || loading}
              loading={loading}
              className={`${FILTER_APPLY_BUTTON_CLASS} h-[34px] !py-0`}
            >
              {applyLabel}
            </Button>
              </>
            )}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
