/**
 * Shared filter action button styles (list pages, report filters, FilterBar).
 */

/** Apply filters — brand accent primary (#059669), white label. */
export const FILTER_APPLY_BUTTON_CLASS =
  '!rounded-[10px] border border-cta bg-cta px-3 py-3 text-sm font-semibold text-white shadow-sm ' +
  'hover:border-cta-hover hover:bg-cta-hover hover:text-white ' +
  'disabled:opacity-40 disabled:text-white';

/** Reset / clear / cancel — rose fill (#E11D48), hover (#BE123C), white label. */
export const FILTER_RESET_BUTTON_CLASS =
  '!rounded-[10px] border-danger-600 bg-danger-600 px-3 py-3 text-sm font-semibold text-white shadow-sm ' +
  'hover:border-danger-700 hover:bg-danger-700 hover:text-white active:border-danger-700 active:bg-danger-700 ' +
  'disabled:opacity-40 disabled:text-white';
