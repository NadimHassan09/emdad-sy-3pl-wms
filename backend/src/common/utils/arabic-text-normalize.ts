/**
 * Fold common Arabic letter variants so address matching is tolerant
 * of ي/ى, ة/ه, أ/إ/آ, and diacritics without changing the stored canonical name.
 */
export function foldArabicLetters(value: string): string {
  return value
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, ''); // harakat + tatweel
}

/** Trim, collapse spaces, lowercase, fold Arabic letters. */
export function normalizeArabicCompare(value: string): string {
  return foldArabicLetters(value.trim().replace(/\s+/g, ' ').toLowerCase());
}
