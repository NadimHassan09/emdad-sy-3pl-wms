import { Button } from '@ds';
import type { ReactNode } from 'react';

/** Matches the Apply filters primary action in filter panels. */
export const FILTER_PRIMARY_BUTTON_CLASS =
  'rounded-xl border-emerald-500 bg-emerald-500 px-4 py-2 shadow hover:border-emerald-600 hover:bg-emerald-600';

/** Shared white panel shell (filters, order details, workflow timeline, etc.). */
export const PANEL_CARD_CLASS =
  'mb-6 space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm';

export const PANEL_TITLE_CLASS = 'text-xl font-semibold text-slate-900';

export function FilterPanel({
  children,
  title = 'Filters',
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
  onApply?: () => void;
  onReset?: () => void;
  applyDisabled?: boolean;
  loading?: boolean;
  applyLabel?: string;
  resetLabel?: string;
  className?: string;
}) {
  const showActions = onApply != null && onReset != null;

  return (
    <div
      className={[PANEL_CARD_CLASS, className].filter(Boolean).join(' ')}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={PANEL_TITLE_CLASS}>{title}</h2>
        {showActions && (
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onReset}
              disabled={loading}
              className="rounded-xl border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-50"
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
              className={FILTER_PRIMARY_BUTTON_CLASS}
            >
              {applyLabel}
            </Button>
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
