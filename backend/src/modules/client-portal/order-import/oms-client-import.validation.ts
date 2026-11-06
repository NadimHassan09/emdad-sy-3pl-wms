import { OmsPaymentMethod } from '@prisma/client';

import {
  evaluateRecipientPhone,
  ingestPastedPhone,
  isoFromCountryHint,
  isValidRecipientName,
  normalizeArabicIndicDigits,
  normalizeRecipientName,
  recipientNameErrorMessage,
  recipientPhoneErrorMessage,
  recipientPhoneParts,
  countryDisplayName,
} from '../../../common/validators/recipient-contact';
import { excelSerialToYmd } from './spreadsheet.parse';

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-_]+$/;
const ASCII_DIGITS_ONLY = /^[0-9]+$/;
/** Three slash- or dot-separated ASCII digit groups (leading zeros allowed; normalized later). */
const SHIP_DATE_PARTS = /^(\d+)[/.](\d+)[/.](\d+)$/;
/** Strict M/D/YYYY or M/DD/YYYY with English digits (after leading-zero strip). */
const SHIP_DATE_MDY = /^([1-9]|1[0-2])\/([0-9]{1,2})\/(\d{4})$/;

/** Strip leading zeros from a digit group; all-zeros becomes `"0"`. */
export function stripLeadingZeros(part: string): string {
  const stripped = part.replace(/^0+(?=\d)/, '');
  return stripped === '' ? '0' : stripped;
}

export function isAsciiDigitsOnly(raw: string): boolean {
  return ASCII_DIGITS_ONLY.test(raw.trim());
}

export function validateImportOrderNumber(
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: 'Order number is required.' };
  }
  if (!ORDER_NUMBER_PATTERN.test(value)) {
    return {
      ok: false,
      message:
        'Order number may only contain English letters, English digits (0-9), hyphen (-), and underscore (_).',
    };
  }
  return { ok: true, value };
}

function ymdFromParts(
  year: number,
  month: number,
  day: number,
  fieldLabel: string,
): { ok: true; ymd: string } | { ok: false; message: string } {
  if (month < 1 || month > 12) {
    return { ok: false, message: `${fieldLabel} month must be between 1 and 12.` };
  }
  if (day < 1 || day > 31) {
    return { ok: false, message: `${fieldLabel} day must be between 1 and 31.` };
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return { ok: false, message: `${fieldLabel} is not a valid calendar date.` };
  }
  return {
    ok: true,
    ymd: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/**
 * Date fields: ISO YYYY-MM-DD, M/DD/YYYY (template default), unambiguous DD/MM/YYYY
 * when day > 12, dots as separators, Arabic-Indic digits, or Excel serial numbers.
 */
export function parseImportMdYDate(
  raw: string,
  fieldLabel: string,
): { ok: true; ymd: string } | { ok: false; message: string } {
  const t = normalizeArabicIndicDigits(raw.trim());
  if (!t) {
    return { ok: false, message: `${fieldLabel} is required (YYYY-MM-DD or M/DD/YYYY).` };
  }

  // 1. Try ISO YYYY-MM-DD (preferred machine format)
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (isoMatch) {
    return ymdFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]), fieldLabel);
  }

  // Reject ambiguous hyphenated non-ISO formats (e.g. DD-MM-YYYY or MM-DD-YYYY)
  if (t.includes('-')) {
    return {
      ok: false,
      message: `${fieldLabel} has an ambiguous date format. Use ISO YYYY-MM-DD (example: 2026-09-01) or M/DD/YYYY (example: 9/01/2026).`,
    };
  }

  // Excel serial (from spreadsheet cells coerced to string)
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const serialYmd = excelSerialToYmd(Number(t));
    if (serialYmd) return { ok: true, ymd: serialYmd };
  }

  // 2. Slash or dot separated parts
  const rawParts = SHIP_DATE_PARTS.exec(t);
  if (!rawParts) {
    return {
      ok: false,
      message: `${fieldLabel} must be ISO YYYY-MM-DD or M/DD/YYYY (example: 2026-09-01 or 9/01/2026).`,
    };
  }
  const a = Number(stripLeadingZeros(rawParts[1]!));
  const b = Number(stripLeadingZeros(rawParts[2]!));
  const year = Number(stripLeadingZeros(rawParts[3]!));

  // Unambiguous DMY when first part > 12
  if (a > 12 && b >= 1 && b <= 12) {
    return ymdFromParts(year, b, a, fieldLabel);
  }
  // Unambiguous MDY when second part > 12
  if (b > 12 && a >= 1 && a <= 12) {
    return ymdFromParts(year, a, b, fieldLabel);
  }

  // Ambiguous or classic M/DD/YYYY — prefer MDY (template default)
  const normalized = `${a}/${b}/${year}`;
  const m = SHIP_DATE_MDY.exec(normalized);
  if (!m) {
    return {
      ok: false,
      message: `${fieldLabel} must be ISO YYYY-MM-DD or M/DD/YYYY (example: 2026-09-01 or 9/01/2026).`,
    };
  }
  return ymdFromParts(Number(m[3]), Number(m[1]), Number(m[2]), fieldLabel);
}

/**
 * required_ship_date must be M/DD/YYYY (English digits). Returns YYYY-MM-DD for storage.
 */
export function parseImportShipDateMdY(
  raw: string,
): { ok: true; ymd: string } | { ok: false; message: string } {
  return parseImportMdYDate(raw, 'Required ship date');
}

export function validateImportRecipientName(
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = normalizeRecipientName(raw);
  if (!value) {
    return { ok: false, message: 'Recipient name is required.' };
  }
  if (!isValidRecipientName(value)) {
    return { ok: false, message: recipientNameErrorMessage(false) };
  }
  return { ok: true, value };
}

export function validateImportCountryCode(
  raw: string,
): { ok: true; callingCode: string; iso: string } | { ok: false; message: string } {
  const trimmed = normalizeArabicIndicDigits(raw.trim());
  if (!trimmed) {
    return { ok: false, message: 'Country code is required.' };
  }
  // Accept "+963", "963", "SY", "SYR" — strip leading + and spaces.
  const cleaned = trimmed.replace(/\s+/g, '').replace(/^\+/, '');
  const upper = cleaned.toUpperCase();
  let callingCode: string;
  if (upper === 'SY' || upper === 'SYR') {
    callingCode = '963';
  } else if (ASCII_DIGITS_ONLY.test(cleaned)) {
    callingCode = cleaned;
  } else {
    return {
      ok: false,
      message:
        'Country code must be English digits only (example: 963). Do not include letters or symbols (a leading + is OK).',
    };
  }
  const iso = isoFromCountryHint(upper === 'SY' || upper === 'SYR' ? 'SY' : callingCode);
  if (!iso) {
    return {
      ok: false,
      message: `Unknown country code "${raw.trim()}". Use a numeric dialing code such as 963.`,
    };
  }
  return { ok: true, callingCode, iso };
}

export function validateImportRecipientPhone(
  phoneRaw: string,
  countryIso: string,
): { ok: true; e164: string; shippingPhoneCountry: string } | { ok: false; message: string } {
  const phone = phoneRaw.trim();
  if (!phone) {
    return { ok: false, message: 'Recipient phone is required.' };
  }
  // Tolerant: +963…, 09…, spaces, dashes, Arabic-Indic digits via ingestPastedPhone.
  const ingested = ingestPastedPhone(phone, countryIso);
  let national = ingested.nationalNumber;
  if (!national) {
    return {
      ok: false,
      message:
        'Recipient phone must include digits (national like 944000001 / 0944000001, or international +963…).',
    };
  }
  // Local Syrian dialing often includes a leading 0 — strip for libphonenumber.
  if (ingested.countryIso === 'SY' && national.startsWith('0')) {
    national = national.replace(/^0+/, '');
  }
  const evalResult = evaluateRecipientPhone(ingested.countryIso || countryIso, national);
  const parts = recipientPhoneParts(evalResult);
  if (!parts) {
    return {
      ok: false,
      message: recipientPhoneErrorMessage(
        countryDisplayName(ingested.countryIso || countryIso, 'en'),
        false,
      ),
    };
  }
  return {
    ok: true,
    e164: parts.phoneE164,
    shippingPhoneCountry: parts.phoneCountryIso,
  };
}

export function validateImportPaymentMethod(
  raw: string,
): { ok: true; value: OmsPaymentMethod } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: 'Payment method is required.' };
  }
  const upper = value.toUpperCase();
  if (upper === 'COD') return { ok: true, value: OmsPaymentMethod.COD };
  if (upper === 'PREPAID') return { ok: true, value: OmsPaymentMethod.PREPAID };
  if (upper === 'CREDIT') return { ok: true, value: OmsPaymentMethod.CREDIT };
  return {
    ok: false,
    message: 'Payment method must be exactly one of: COD, Prepaid, or Credit.',
  };
}

export function validateImportAsciiPositiveInt(
  raw: string,
  fieldLabel: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: `${fieldLabel} is required.` };
  }
  if (!ASCII_DIGITS_ONLY.test(value)) {
    return {
      ok: false,
      message: `${fieldLabel} must contain English digits only (0-9), with no letters, symbols, or Arabic digits.`,
    };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: `${fieldLabel} must be a whole number greater than 0.` };
  }
  return { ok: true, value: n };
}

export function validateImportAsciiNonNegativeInt(
  raw: string,
  fieldLabel: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: `${fieldLabel} is required.` };
  }
  if (!ASCII_DIGITS_ONLY.test(value)) {
    return {
      ok: false,
      message: `${fieldLabel} must contain English digits only (0-9), with no letters, symbols, or Arabic digits.`,
    };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    return { ok: false, message: `${fieldLabel} must be a whole number greater than or equal to 0.` };
  }
  return { ok: true, value: n };
}

const ASCII_DECIMAL_POSITIVE_PATTERN = /^\d+(\.\d+)?$/;

export function validateImportPositiveQuantity(
  raw: string,
  fieldLabel: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: `${fieldLabel} is required.` };
  }
  if (!ASCII_DECIMAL_POSITIVE_PATTERN.test(value)) {
    return {
      ok: false,
      message: `${fieldLabel} must contain English digits only (0-9) and optional decimal point, with no letters, symbols, or Arabic digits.`,
    };
  }
  const parts = value.split('.');
  if (parts[1] && parts[1].length > 4) {
    return {
      ok: false,
      message: `${fieldLabel} cannot have more than 4 decimal places.`,
    };
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: `${fieldLabel} must be greater than 0.` };
  }
  return { ok: true, value: n };
}

