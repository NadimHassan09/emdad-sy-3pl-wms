/**
 * OMS recipient name + international phone helpers.
 *
 * Shared by Admin Portal, Client Portal, and (copied into) the Nest backend.
 * Phone rules come from Google libphonenumber metadata — never hardcoded lengths.
 */
import parsePhoneNumberFromString, {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js/max';

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'SY';
export const RECIPIENT_NAME_MAX_LENGTH = 80;

const NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EASTERN_ARABIC_INDIC = /[\u06F0-\u06F9]/g;
const NATIONAL_DIGIT_CHARS = /[0-9\u0660-\u0669\u06F0-\u06F9]/g;
const NAME_ALLOWED_CHAR = /^[\p{L}\p{M} ]$/u;

export type PhoneEvalState = 'empty' | 'typing' | 'possible' | 'valid' | 'invalid';

export type RecipientPhoneParts = {
  phoneCountryIso: string;
  phoneCountryCode: string;
  phoneNationalNumber: string;
  phoneE164: string;
};

export type PhoneEvaluation = {
  state: PhoneEvalState;
  isPossible: boolean;
  isValid: boolean;
  isEmpty: boolean;
  countryIso: string;
  countryCallingCode: string | null;
  nationalNumber: string;
  e164: string | null;
  lengthError: ReturnType<typeof validatePhoneNumberLength> | undefined;
};

export type CountryDialOption = {
  iso: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
  searchText: string;
};

export function normalizeArabicIndicDigits(raw: string): string {
  return raw
    .replace(ARABIC_INDIC, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

export function normalizeRecipientName(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidRecipientName(raw: string | null | undefined): boolean {
  const normalized = normalizeRecipientName(raw);
  if (!normalized) return true;
  if (normalized.length > RECIPIENT_NAME_MAX_LENGTH) return false;
  return NAME_PATTERN.test(normalized);
}

/** Strip characters that are not Unicode letters, marks, or spaces. */
export function filterRecipientNameInput(raw: string): string {
  const kept = [...raw].filter((ch) => NAME_ALLOWED_CHAR.test(ch)).join('');
  return kept.replace(/^ +/, '').replace(/ {2,}/g, ' ');
}

export function countryFlagEmoji(iso: string): string {
  const u = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(u)) return '🏳️';
  return String.fromCodePoint(...[...u].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

export function isPhoneCountryIso(raw: string | null | undefined): raw is CountryCode {
  if (!raw) return false;
  const u = raw.trim().toUpperCase();
  return u.length === 2 && isSupportedCountry(u);
}

export function callingCodeForIso(iso: string): string | null {
  const u = iso.trim().toUpperCase();
  if (!isSupportedCountry(u)) return null;
  try {
    return String(getCountryCallingCode(u as CountryCode));
  } catch {
    return null;
  }
}

/** Map ISO2 or numeric dial code (e.g. 963) to an ISO2 when unambiguous. */
export function isoFromCountryHint(raw: string | null | undefined): CountryCode | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if (upper === 'SYR' || upper === 'SYRIA') return 'SY';
  if (isSupportedCountry(upper)) return upper as CountryCode;
  const digits = t.replace(/\D/g, '');
  if (!digits) return null;
  const matches = getCountries().filter((iso) => String(getCountryCallingCode(iso)) === digits);
  if (matches.length === 1) return matches[0];
  return null;
}

export function filterNationalPhoneInput(raw: string): string {
  const matches = raw.match(NATIONAL_DIGIT_CHARS);
  if (!matches) return '';
  return normalizeArabicIndicDigits(matches.join(''));
}

function asCountryCode(iso: string): CountryCode | null {
  const u = iso.trim().toUpperCase();
  return isSupportedCountry(u) ? (u as CountryCode) : null;
}

export function evaluateRecipientPhone(
  countryIso: string,
  nationalNumber: string,
): PhoneEvaluation {
  const iso = asCountryCode(countryIso);
  const national = filterNationalPhoneInput(nationalNumber);
  const calling = iso ? callingCodeForIso(iso) : null;

  if (!national) {
    return {
      state: 'empty',
      isPossible: false,
      isValid: false,
      isEmpty: true,
      countryIso: iso ?? '',
      countryCallingCode: calling,
      nationalNumber: '',
      e164: null,
      lengthError: undefined,
    };
  }

  if (!iso) {
    return {
      state: 'invalid',
      isPossible: false,
      isValid: false,
      isEmpty: false,
      countryIso: '',
      countryCallingCode: null,
      nationalNumber: national,
      e164: null,
      lengthError: 'NOT_A_NUMBER',
    };
  }

  const lengthError = validatePhoneNumberLength(national, iso);
  const parsed = parsePhoneNumberFromString(national, iso);
  const isPossible = parsed?.isPossible() === true;
  const isValid = parsed?.isValid() === true;
  const e164 = isValid && parsed ? parsed.number : null;
  const nationalSignificant = parsed?.nationalNumber ?? national;

  let state: PhoneEvalState;
  if (isValid) state = 'valid';
  else if (lengthError === 'TOO_SHORT') state = 'typing';
  else if (isPossible && lengthError == null) state = 'possible';
  else state = 'invalid';

  return {
    state,
    isPossible,
    isValid,
    isEmpty: false,
    countryIso: iso,
    countryCallingCode: calling,
    nationalNumber: nationalSignificant,
    e164,
    lengthError,
  };
}

export function recipientPhoneParts(evalResult: PhoneEvaluation): RecipientPhoneParts | null {
  if (!evalResult.isValid || !evalResult.e164 || !evalResult.countryIso || !evalResult.countryCallingCode) {
    return null;
  }
  return {
    phoneCountryIso: evalResult.countryIso,
    phoneCountryCode: `+${evalResult.countryCallingCode}`,
    phoneNationalNumber: evalResult.nationalNumber,
    phoneE164: evalResult.e164,
  };
}

/**
 * Paste / stored-value ingest.
 * Unambiguous E.164 (leading + or 00) may switch country; national digits stay on the current country.
 */
export function ingestPastedPhone(
  raw: string,
  currentCountryIso: string,
): { countryIso: string; nationalNumber: string; switchedCountry: boolean } {
  const current = asCountryCode(currentCountryIso) ?? DEFAULT_PHONE_COUNTRY;
  const trimmed = raw.trim();
  if (!trimmed) {
    return { countryIso: current, nationalNumber: '', switchedCountry: false };
  }

  const withAsciiDigits = normalizeArabicIndicDigits(trimmed);
  const looksInternational = /^\s*(?:\+|00)/.test(withAsciiDigits);
  const international = looksInternational
    ? withAsciiDigits.replace(/^\s*00/, '+').replace(/[^\d+]/g, '')
    : '';

  if (looksInternational && international.startsWith('+') && international.length > 2) {
    const parsed = parsePhoneNumberFromString(international);
    if (parsed?.country && parsed.nationalNumber) {
      const next = parsed.country;
      return {
        countryIso: next,
        nationalNumber: parsed.nationalNumber,
        switchedCountry: next !== current,
      };
    }
    if (parsed?.countryCallingCode && parsed.nationalNumber) {
      const iso = isoFromCountryHint(String(parsed.countryCallingCode));
      if (iso) {
        return {
          countryIso: iso,
          nationalNumber: parsed.nationalNumber,
          switchedCountry: iso !== current,
        };
      }
    }
  }

  const national = filterNationalPhoneInput(withAsciiDigits);
  const parsedNational = parsePhoneNumberFromString(national, current);
  return {
    countryIso: current,
    nationalNumber: parsedNational?.nationalNumber ?? national,
    switchedCountry: false,
  };
}

export function phoneFromStoredValue(
  storedPhone: string | null | undefined,
  countryHint: string | null | undefined,
  fallbackIso: CountryCode = DEFAULT_PHONE_COUNTRY,
): { countryIso: CountryCode; nationalNumber: string } {
  const hintIso = isoFromCountryHint(countryHint);
  const raw = (storedPhone ?? '').trim();
  if (!raw) {
    return { countryIso: hintIso ?? fallbackIso, nationalNumber: '' };
  }

  const ingested = ingestPastedPhone(raw, hintIso ?? fallbackIso);
  const iso = asCountryCode(ingested.countryIso) ?? hintIso ?? fallbackIso;
  return { countryIso: iso, nationalNumber: ingested.nationalNumber };
}

export type RecipientContactInput = {
  recipientName?: string | null;
  recipientPhone?: string | null;
  shippingPhoneCountry?: string | null;
};

export type RecipientContactNormalized = {
  recipientName?: string | null;
  recipientPhone?: string | null;
  shippingPhoneCountry?: string | null;
};

export type RecipientContactResult =
  | { ok: true; value: RecipientContactNormalized }
  | { ok: false; field: 'recipientName' | 'recipientPhone' | 'shippingPhoneCountry'; message: string };

export function recipientNameErrorMessage(isArabic: boolean): string {
  return isArabic
    ? 'الاسم يقبل الحروف العربية أو الإنجليزية والمسافات فقط.'
    : 'Name can only contain Arabic or English letters and spaces.';
}

export function recipientPhoneErrorMessage(countryName: string, isArabic: boolean): string {
  if (!countryName) {
    return isArabic ? 'يرجى اختيار الدولة وإدخال رقم هاتف صالح.' : 'Please select a country and enter a valid phone number.';
  }
  return isArabic
    ? `يرجى إدخال رقم هاتف صالح لـ ${countryName}.`
    : `Please enter a valid phone number for ${countryName}.`;
}

export function recipientPhoneSuccessMessage(isArabic: boolean): string {
  return isArabic ? 'رقم هاتف صالح' : 'Valid phone number';
}

export function countryDisplayName(iso: string, locale: string): string {
  const u = iso.trim().toUpperCase();
  try {
    const name = new Intl.DisplayNames([locale], { type: 'region' }).of(u);
    if (name) return name;
  } catch {
    /* ignore */
  }
  return u;
}

const countryOptionCache = new Map<string, CountryDialOption[]>();

export function listCountryDialOptions(locale = 'en'): CountryDialOption[] {
  const key = locale.slice(0, 2).toLowerCase();
  const cached = countryOptionCache.get(key);
  if (cached) return cached;
  const display = new Intl.DisplayNames([key], { type: 'region' });
  const options = getCountries()
    .map((iso) => {
      const callingCode = String(getCountryCallingCode(iso));
      const name = display.of(iso) ?? iso;
      const flag = countryFlagEmoji(iso);
      return {
        iso,
        name,
        callingCode,
        flag,
        searchText: `${flag} ${name} ${iso} +${callingCode} ${callingCode}`.toLowerCase(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, key));
  countryOptionCache.set(key, options);
  return options;
}

export function normalizeRecipientContact(input: RecipientContactInput): RecipientContactResult {
  const out: RecipientContactNormalized = {};

  if (input.recipientName !== undefined && input.recipientName !== null) {
    const normalized = normalizeRecipientName(input.recipientName);
    if (normalized === '') {
      out.recipientName = null;
    } else if (!isValidRecipientName(normalized)) {
      return {
        ok: false,
        field: 'recipientName',
        message: recipientNameErrorMessage(false),
      };
    } else {
      out.recipientName = normalized;
    }
  }

  const phoneRaw = input.recipientPhone;
  const countryRaw = input.shippingPhoneCountry;

  if (phoneRaw !== undefined && phoneRaw !== null) {
    const trimmed = String(phoneRaw).trim();
    if (trimmed === '') {
      out.recipientPhone = null;
      if (countryRaw !== undefined) {
        const iso = isoFromCountryHint(countryRaw);
        out.shippingPhoneCountry =
          iso ?? (countryRaw == null || countryRaw.trim() === '' ? null : countryRaw.trim());
      }
    } else {
      const hintIso = isoFromCountryHint(countryRaw);
      const ingested = ingestPastedPhone(trimmed, hintIso ?? DEFAULT_PHONE_COUNTRY);
      const evalResult = evaluateRecipientPhone(ingested.countryIso, ingested.nationalNumber);
      const parts = recipientPhoneParts(evalResult);
      if (!parts) {
        const countryName = countryDisplayName(ingested.countryIso || hintIso || '', 'en');
        return {
          ok: false,
          field: 'recipientPhone',
          message: recipientPhoneErrorMessage(countryName, false),
        };
      }
      out.recipientPhone = parts.phoneE164;
      out.shippingPhoneCountry = parts.phoneCountryIso;
    }
  } else if (countryRaw !== undefined) {
    if (countryRaw == null || String(countryRaw).trim() === '') {
      out.shippingPhoneCountry = null;
    } else {
      const iso = isoFromCountryHint(countryRaw);
      if (!iso && !callingCodeForIso(String(countryRaw))) {
        const digits = String(countryRaw).replace(/\D/g, '');
        if (!digits || digits.length > 4 || Number(digits) >= 1000) {
          return {
            ok: false,
            field: 'shippingPhoneCountry',
            message: 'Phone country must be a valid ISO code or dialing code.',
          };
        }
      }
      out.shippingPhoneCountry = iso ?? String(countryRaw).trim();
    }
  }

  return { ok: true, value: out };
}
