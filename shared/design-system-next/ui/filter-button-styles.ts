/**
 * Shared filter action button styles (list pages, report filters, FilterBar).
 */

/** Apply filters — brand accent primary, theme-aware via the `cta` token. */
export const FILTER_APPLY_BUTTON_CLASS =
  '!rounded-[10px] border border-cta bg-cta px-3 py-3 text-sm font-semibold text-on-brand shadow-sm ' +
  'hover:border-cta-hover hover:bg-cta-hover hover:text-on-brand ' +
  'disabled:opacity-40 disabled:text-on-brand';

/** Reset / clear filters — danger fill, white label (reference: delete-draft control). */
export const FILTER_RESET_BUTTON_CLASS =
  'rounded-[10px] border-danger-600 bg-danger-600 px-3 py-3 text-sm font-semibold text-white shadow-sm ' +
  'hover:border-danger-700 hover:bg-danger-700 active:border-danger-800 active:bg-danger-800 ' +
  'disabled:border-danger-300 disabled:bg-danger-300 disabled:text-white/90';
