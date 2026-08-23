import { OmsPaymentMethod } from '@prisma/client';

import {
  evaluateRecipientPhone,
  isoFromCountryHint,
  isValidRecipientName,
  normalizeRecipientName,
  recipientNameErrorMessage,
  recipientPhoneErrorMessage,
  recipientPhoneParts,
  countryDisplayName,
} from '../../../common/validators/recipient-contact';

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]+$/;
const ASCII_DIGITS_ONLY = /^[0-9]+$/;
/** Strict M/D/YYYY or M/DD/YYYY with English digits and `/` only. */
const SHIP_DATE_MDY = /^([1-9]|1[0-2])\/([0-9]{1,2})\/(\d{4})$/;

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
        'Order number may only contain English letters, English digits (0-9), and hyphen (-).',
    };
  }
  return { ok: true, value };
}

/**
 * Date fields must be M/DD/YYYY (English digits). Returns YYYY-MM-DD for storage.
 */
export function parseImportMdYDate(
  raw: string,
  fieldLabel: string,
): { ok: true; ymd: string } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) {
    return { ok: false, message: `${fieldLabel} is required (M/DD/YYYY).` };
  }
  if (/[٠-٩۰-۹]/.test(t)) {
    return {
      ok: false,
      message: `${fieldLabel} must use English digits only in M/DD/YYYY format.`,
    };
  }
  const m = SHIP_DATE_MDY.exec(t);
  if (!m) {
    return {
      ok: false,
      message: `${fieldLabel} must be M/DD/YYYY (example: 9/01/2026).`,
    };
  }
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
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
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: 'Country code is required.' };
  }
  if (!ASCII_DIGITS_ONLY.test(value)) {
    return {
      ok: false,
      message:
        'Country code must be English digits only (example: 963). Do not include +, letters, or symbols.',
    };
  }
  const iso = isoFromCountryHint(value);
  if (!iso) {
    return {
      ok: false,
      message: `Unknown country code "${value}". Use a numeric dialing code such as 963.`,
    };
  }
  return { ok: true, callingCode: value, iso };
}

export function validateImportRecipientPhone(
  phoneRaw: string,
  countryIso: string,
): { ok: true; e164: string; shippingPhoneCountry: string } | { ok: false; message: string } {
  const phone = phoneRaw.trim();
  if (!phone) {
    return { ok: false, message: 'Recipient phone is required.' };
  }
  if (!ASCII_DIGITS_ONLY.test(phone)) {
    return {
      ok: false,
      message:
        'Recipient phone must be English digits only (no +, spaces, letters, or symbols).',
    };
  }
  const evalResult = evaluateRecipientPhone(countryIso, phone);
  const parts = recipientPhoneParts(evalResult);
  if (!parts) {
    return {
      ok: false,
      message: recipientPhoneErrorMessage(countryDisplayName(countryIso, 'en'), false),
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
