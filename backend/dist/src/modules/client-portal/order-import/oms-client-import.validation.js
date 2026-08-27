"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAsciiDigitsOnly = isAsciiDigitsOnly;
exports.validateImportOrderNumber = validateImportOrderNumber;
exports.parseImportMdYDate = parseImportMdYDate;
exports.parseImportShipDateMdY = parseImportShipDateMdY;
exports.validateImportRecipientName = validateImportRecipientName;
exports.validateImportCountryCode = validateImportCountryCode;
exports.validateImportRecipientPhone = validateImportRecipientPhone;
exports.validateImportPaymentMethod = validateImportPaymentMethod;
exports.validateImportAsciiPositiveInt = validateImportAsciiPositiveInt;
exports.validateImportAsciiNonNegativeInt = validateImportAsciiNonNegativeInt;
const client_1 = require("@prisma/client");
const recipient_contact_1 = require("../../../common/validators/recipient-contact");
const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]+$/;
const ASCII_DIGITS_ONLY = /^[0-9]+$/;
const SHIP_DATE_MDY = /^([1-9]|1[0-2])\/([0-9]{1,2})\/(\d{4})$/;
function isAsciiDigitsOnly(raw) {
    return ASCII_DIGITS_ONLY.test(raw.trim());
}
function validateImportOrderNumber(raw) {
    const value = raw.trim();
    if (!value) {
        return { ok: false, message: 'Order number is required.' };
    }
    if (!ORDER_NUMBER_PATTERN.test(value)) {
        return {
            ok: false,
            message: 'Order number may only contain English letters, English digits (0-9), and hyphen (-).',
        };
    }
    return { ok: true, value };
}
function parseImportMdYDate(raw, fieldLabel) {
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
    if (dt.getUTCFullYear() !== year ||
        dt.getUTCMonth() !== month - 1 ||
        dt.getUTCDate() !== day) {
        return { ok: false, message: `${fieldLabel} is not a valid calendar date.` };
    }
    return {
        ok: true,
        ymd: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
}
function parseImportShipDateMdY(raw) {
    return parseImportMdYDate(raw, 'Required ship date');
}
function validateImportRecipientName(raw) {
    const value = (0, recipient_contact_1.normalizeRecipientName)(raw);
    if (!value) {
        return { ok: false, message: 'Recipient name is required.' };
    }
    if (!(0, recipient_contact_1.isValidRecipientName)(value)) {
        return { ok: false, message: (0, recipient_contact_1.recipientNameErrorMessage)(false) };
    }
    return { ok: true, value };
}
function validateImportCountryCode(raw) {
    const value = raw.trim();
    if (!value) {
        return { ok: false, message: 'Country code is required.' };
    }
    if (!ASCII_DIGITS_ONLY.test(value)) {
        return {
            ok: false,
            message: 'Country code must be English digits only (example: 963). Do not include +, letters, or symbols.',
        };
    }
    const iso = (0, recipient_contact_1.isoFromCountryHint)(value);
    if (!iso) {
        return {
            ok: false,
            message: `Unknown country code "${value}". Use a numeric dialing code such as 963.`,
        };
    }
    return { ok: true, callingCode: value, iso };
}
function validateImportRecipientPhone(phoneRaw, countryIso) {
    const phone = phoneRaw.trim();
    if (!phone) {
        return { ok: false, message: 'Recipient phone is required.' };
    }
    if (!ASCII_DIGITS_ONLY.test(phone)) {
        return {
            ok: false,
            message: 'Recipient phone must be English digits only (no +, spaces, letters, or symbols).',
        };
    }
    const evalResult = (0, recipient_contact_1.evaluateRecipientPhone)(countryIso, phone);
    const parts = (0, recipient_contact_1.recipientPhoneParts)(evalResult);
    if (!parts) {
        return {
            ok: false,
            message: (0, recipient_contact_1.recipientPhoneErrorMessage)((0, recipient_contact_1.countryDisplayName)(countryIso, 'en'), false),
        };
    }
    return {
        ok: true,
        e164: parts.phoneE164,
        shippingPhoneCountry: parts.phoneCountryIso,
    };
}
function validateImportPaymentMethod(raw) {
    const value = raw.trim();
    if (!value) {
        return { ok: false, message: 'Payment method is required.' };
    }
    const upper = value.toUpperCase();
    if (upper === 'COD')
        return { ok: true, value: client_1.OmsPaymentMethod.COD };
    if (upper === 'PREPAID')
        return { ok: true, value: client_1.OmsPaymentMethod.PREPAID };
    if (upper === 'CREDIT')
        return { ok: true, value: client_1.OmsPaymentMethod.CREDIT };
    return {
        ok: false,
        message: 'Payment method must be exactly one of: COD, Prepaid, or Credit.',
    };
}
function validateImportAsciiPositiveInt(raw, fieldLabel) {
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
function validateImportAsciiNonNegativeInt(raw, fieldLabel) {
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
//# sourceMappingURL=oms-client-import.validation.js.map