/**
 * Shared company field validation rules (create/update DTOs).
 * Keep in sync with `frontend/src/lib/company-form-validation.ts`.
 */

/** Organization / trade name: must include a letter; not digits-only. */
export const COMPANY_ORG_NAME_PATTERN =
  /^(?=.*\p{L})[\p{L}\p{M}0-9\s.'’&()/+\-]{2,200}$/u;

/** City / place name: letters (any script), spaces, hyphens, apostrophes, periods — no digits. */
export const COMPANY_CITY_PATTERN = /^(?=.*\p{L})[\p{L}\p{M}\s.'’\-]{2,120}$/u;

/**
 * Country: ISO-style 2–3 letter code, or a country name (letters/spaces/hyphens).
 * Matches existing data (SA, EYG, Lebanon, …).
 */
export const COMPANY_COUNTRY_PATTERN = /^(?=.*\p{L})[\p{L}\p{M}\s.\-]{2,64}$/u;

/** Optional international phone: leading +, digits, spaces, common separators. */
export const COMPANY_PHONE_PATTERN = /^\+?[0-9](?:[\d\s().\-]{5,38}[0-9])?$/;

export const COMPANY_FIELD_MESSAGES = {
  name: 'Name must be 2–200 characters and include letters (not numbers only).',
  tradeName: 'Trade name must include letters (not numbers only).',
  contactEmail: 'Contact email must be a valid email address.',
  country: 'Country must be a valid name or ISO code (letters only, 2–64 characters).',
  city: 'City must be a valid name (letters, spaces, hyphens, apostrophes; not numbers).',
  contactPhone: 'Phone must be a valid international number (e.g. +9665xxxxxxx).',
  address: 'Address must be at most 500 characters.',
  notes: 'Notes must be at most 2000 characters.',
} as const;
