import { Button, FILTER_APPLY_BUTTON_CLASS, FILTER_RESET_BUTTON_CLASS } from '@ds';
import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';

import {
  FILTER_ACTION_BUTTON_SIZE_CLASS,
  FILTER_GRID_CLASS,
  FILTER_OVERFLOW_TRANSITION_CLASS,
} from './filter-panel-styles';
import { useFilterGridColumns } from '../hooks/useFilterGridColumns';

/** Flatten fragments, arrays, and falsy nodes so each field occupies one grid cell. */
function flattenFilterPanelChildren(children: ReactNode): ReactNode[] {
  const items: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (child == null || child === false || child === true) return;
    if (isValidElement(child) && child.type === Fragment) {
      items.push(
        ...flattenFilterPanelChildren((child.props as { children?: ReactNode }).children),
      );
      return;
    }
    if (Array.isArray(child)) {
      items.push(...flattenFilterPanelChildren(child));
      return;
    }
    items.push(child);
  });
  return items;
}

/** @deprecated Use FILTER_APPLY_BUTTON_CLASS from @ds */
export const FILTER_PRIMARY_BUTTON_CLASS = FILTER_APPLY_BUTTON_CLASS;

export { FILTER_APPLY_BUTTON_CLASS, FILTER_RESET_BUTTON_CLASS };

/** Shared white panel shell (filters, order details, workflow timeline, etc.). */
export const PANEL_CARD_CLASS =
  'mb-4 rounded-xl border border-border bg-surface-panel p-4 shadow-soft';

export const PANEL_TITLE_CLASS = 'text-base font-semibold text-text-strong';

function FilterPanelIcon() {
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400"
      aria-hidden
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Fixed responsive grid for filter fields — 4 cols desktop, 2 tablet, 1 mobile. */
export function FilterPanelGrid({
  children,
  showMoreLabel = 'Show more',
  showLessLabel = 'Show less',
}: {
  children: ReactNode;
  showMoreLabel?: string;
  showLessLabel?: string;
}) {
  const items = flattenFilterPanelChildren(children);
  const columns = useFilterGridColumns();
  const [expanded, setExpanded] = useState(false);

  const hasOverflow = items.length > columns;
  const firstRow = hasOverflow ? items.slice(0, columns) : items;
  const rest = hasOverflow ? items.slice(columns) : [];

  function renderField(child: ReactNode, index: number) {
    return (
      <div key={index} className="min-w-0">
        {child}
      </div>
    );
  }

  function renderToggle(expandedState: boolean) {
    return (
      <a
        href="#"
        role="button"
        aria-expanded={expandedState}
        className="text-sm font-medium text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
        onClick={(event) => {
          event.preventDefault();
          setExpanded((current) => !current);
        }}
      >
        {expandedState ? showLessLabel : showMoreLabel}
      </a>
    );
  }

  if (!hasOverflow) {
    return (
      <div className={FILTER_GRID_CLASS}>
        {items.map((child, index) => renderField(child, index))}
      </div>
    );
  }

  return (
    <div>
      <div className={FILTER_GRID_CLASS}>
        {firstRow.map((child, index) => renderField(child, index))}
      </div>

      {/*
        Collapsed: grid-rows + overflow-hidden so extra rows can animate shut.
        Expanded: render fields outside that clip wrapper so Combobox/select
        menus from row 2+ paint above the "Show less" footer (shared by admin + client).
      */}
      {expanded ? (
        <div className={`relative z-20 ${FILTER_GRID_CLASS} pt-5`}>
          {rest.map((child, index) => renderField(child, columns + index))}
        </div>
      ) : (
        <div className={`${FILTER_OVERFLOW_TRANSITION_CLASS} grid-rows-[0fr]`}>
          <div className="min-h-0 overflow-hidden">
            <div className={`${FILTER_GRID_CLASS} pt-5`}>
              {rest.map((child, index) => renderField(child, columns + index))}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-0 mt-5">{renderToggle(expanded)}</div>
    </div>
  );
}

export function FilterPanel({
  children,
  title = 'Filters',
  description,
  headerActions,
  onApply,
  onReset,
  applyDisabled,
  loading,
  applyLabel = 'Apply filters',
  resetLabel = 'Reset filters',
  showMoreLabel = 'Show more',
  showLessLabel = 'Show less',
  className,
  variant,
  chips,
  onClearAllChips,
  clearAllChipsLabel = 'Clear all',
}: {
  children: ReactNode;
  title?: ReactNode;
  /** Short helper line under the title (filter panels only). */
  description?: ReactNode;
  /** Optional controls in the panel header (top right), e.g. order actions. */
  headerActions?: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  applyDisabled?: boolean;
  loading?: boolean;
  applyLabel?: string;
  resetLabel?: string;
  showMoreLabel?: string;
  showLessLabel?: string;
  className?: string;
  /** `filters` = standardized filter card; `content` = generic titled panel. */
  variant?: 'filters' | 'content';
  /** Applied filter chips shown under the field grid. */
  chips?: Array<{ key: string; label: string; onClear: () => void }>;
  onClearAllChips?: () => void;
  clearAllChipsLabel?: string;
}) {
  const isFilterMode = variant === 'filters' || (variant !== 'content' && onApply != null && onReset != null);
  const showActions = isFilterMode && onApply != null && onReset != null;
  const resolvedDescription =
    description ??
    (isFilterMode
      ? 'Refine the list using the filters below.'
      : undefined);

  if (!isFilterMode) {
    const showHeaderRow = headerActions != null;
    return (
      <div className={[PANEL_CARD_CLASS, className].filter(Boolean).join(' ')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className={PANEL_TITLE_CLASS}>{title}</h2>
          {showHeaderRow ? (
            <div className="flex flex-wrap items-center justify-end gap-3">{headerActions}</div>
          ) : null}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    );
  }

  return (
    <div className={[PANEL_CARD_CLASS, className].filter(Boolean).join(' ')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply?.();
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <FilterPanelIcon />
            <div className="min-w-0">
              <h2 className={PANEL_TITLE_CLASS}>{title}</h2>
              {resolvedDescription ? (
                <p className="mt-1 text-sm text-text-muted">{resolvedDescription}</p>
              ) : null}
            </div>
          </div>
          {showActions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
              {headerActions}
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onReset}
                disabled={loading}
                className={`${FILTER_ACTION_BUTTON_SIZE_CLASS} !rounded-[10px] border border-border bg-surface-panel px-3 text-sm font-semibold text-text-body shadow-sm hover:bg-surface-hover`}
              >
                {resetLabel}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={applyDisabled || loading}
                loading={loading}
                className={`${FILTER_APPLY_BUTTON_CLASS} ${FILTER_ACTION_BUTTON_SIZE_CLASS}`}
              >
                {applyLabel}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="mt-5">
          <FilterPanelGrid showMoreLabel={showMoreLabel} showLessLabel={showLessLabel}>
            {children}
          </FilterPanelGrid>
        </div>
        {chips && chips.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClear}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-xs font-medium text-text-body transition hover:border-border-strong hover:bg-surface-panel"
              >
                <span>{chip.label}</span>
                <span className="text-text-faint" aria-hidden>
                  ×
                </span>
              </button>
            ))}
            {onClearAllChips ? (
              <button
                type="button"
                onClick={onClearAllChips}
                className="text-xs font-medium text-text-muted underline-offset-2 hover:text-text-strong hover:underline"
              >
                {clearAllChipsLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
