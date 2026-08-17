/** Shared filter panel field + action styles (enterprise filter bar). */

/** Same shell as the collapsed Normal Filter card. */
export const FILTER_CARD_CLASS =
  'mb-4 rounded-xl border border-border bg-surface-panel p-4 shadow-soft';

export const FILTER_FIELD_LABEL_CLASS = 'block text-xs font-medium text-text-muted';
export const FILTER_FIELD_LABEL_GAP_CLASS = 'mb-1';

/** Matches collapsed Normal Filter search/select controls. */
export const FILTER_FIELD_CONTROL_CLASS =
  'input-premium block h-8 w-full rounded-lg border border-border-strong bg-surface-sunken px-3 text-sm text-text-strong ' +
  'placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted';

export const FILTER_FIELD_CONTROL_ERROR_CLASS =
  'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20';

export const FILTER_GRID_CLASS =
  'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-4';

export const FILTER_ADVANCED_GRID_CLASS =
  'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3';

export const FILTER_COMPACT_SEARCH_CLASS =
  'input-premium h-8 w-full rounded-lg border border-border-strong bg-surface-sunken py-0 pl-9 pr-4 text-sm text-text-strong ' +
  'placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export const FILTER_COMPACT_SELECT_CLASS =
  'input-premium h-8 w-full rounded-lg border border-border-strong bg-surface-sunken px-3 text-sm text-text-body ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-52';

export const FILTER_ACTION_BUTTON_SIZE_CLASS =
  '!h-8 !rounded-lg shrink-0 !px-3 !py-0 text-xs font-semibold';

/** Text action for Advanced Filtering / Collapsed — matches Apply green, no button chrome. */
export const FILTER_ADVANCED_TOGGLE_CLASS =
  'inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-cta no-underline decoration-transparent ' +
  'hover:text-cta-hover hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20';

/** Collapsed quick filters + inline Apply/Reset on one row. */
export const FILTER_TOOLBAR_ROW_CLASS =
  'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between';

export const FILTER_ACTIONS_INLINE_CLASS =
  'flex shrink-0 flex-wrap items-center justify-end gap-2';

export const FILTER_ACTIONS_ROW_CLASS = 'mt-3 flex flex-wrap items-center justify-end gap-2';

/** Advanced Filtering / Collapsed sits below the action buttons, aligned end. */
export const FILTER_TOGGLE_ROW_CLASS = 'mt-1 flex justify-end';

/** Slide open/closed for extra filter rows. */
export const FILTER_OVERFLOW_TRANSITION_CLASS =
  'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none';
