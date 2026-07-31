/** Shared filter panel field + action styles (enterprise filter bar). */

export const FILTER_FIELD_LABEL_CLASS = 'block text-sm font-medium text-text-body';
export const FILTER_FIELD_LABEL_GAP_CLASS = 'mb-2';

export const FILTER_FIELD_CONTROL_CLASS =
  'block w-full h-11 rounded-[10px] border border-border-strong bg-surface-panel px-3 text-sm text-text-strong shadow-sm ' +
  'placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted';

export const FILTER_FIELD_CONTROL_ERROR_CLASS =
  'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20';

export const FILTER_GRID_CLASS =
  'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4';

export const FILTER_ACTION_BUTTON_SIZE_CLASS =
  '!h-auto shrink-0 rounded-[10px] px-3 py-3 text-sm font-semibold';

/** Slide open/closed for extra filter rows. */
export const FILTER_OVERFLOW_TRANSITION_CLASS =
  'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none';
