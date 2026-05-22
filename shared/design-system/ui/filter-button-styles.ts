/**
 * Shared filter action button styles (list pages, report filters, FilterBar).
 */

/** Apply filters — brand green primary (#10B981, hover #059669). */
export const FILTER_APPLY_BUTTON_CLASS =
  '!rounded-xl border border-[#10B981] bg-[#10B981] px-3 py-1.5 text-sm font-semibold text-white shadow-sm ' +
  'hover:border-[#059669] hover:bg-[#059669] hover:text-white ' +
  'disabled:border-[#10B981]/40 disabled:bg-[#10B981]/40 disabled:text-white/90';

/** Reset / clear filters — crimson fill, white label (reference: delete-draft control). */
export const FILTER_RESET_BUTTON_CLASS =
  'rounded-xl border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm ' +
  'hover:border-rose-700 hover:bg-rose-700 active:border-rose-800 active:bg-rose-800 ' +
  'disabled:border-rose-300 disabled:bg-rose-300 disabled:text-white/90';
