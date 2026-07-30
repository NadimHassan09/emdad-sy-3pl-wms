/** Shared filter panel field + action styles (enterprise filter bar). */

export const FILTER_FIELD_LABEL_CLASS = 'block text-sm font-medium text-slate-700';
export const FILTER_FIELD_LABEL_GAP_CLASS = 'mb-2';

export const FILTER_FIELD_CONTROL_CLASS =
  'block w-full h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

export const FILTER_FIELD_CONTROL_ERROR_CLASS =
  'border-rose-400 focus:border-rose-500 focus:ring-rose-200';

export const FILTER_GRID_CLASS =
  'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4';

export const FILTER_ACTION_BUTTON_SIZE_CLASS =
  '!h-auto shrink-0 rounded-[10px] px-3 py-3 text-sm font-semibold';

/** Slide open/closed for extra filter rows. */
export const FILTER_OVERFLOW_TRANSITION_CLASS =
  'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none';
