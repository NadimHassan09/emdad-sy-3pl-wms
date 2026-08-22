"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECIPIENT_NAME_MAX_LENGTH = exports.DEFAULT_PHONE_COUNTRY = void 0;
exports.normalizeArabicIndicDigits = normalizeArabicIndicDigits;
exports.normalizeRecipientName = normalizeRecipientName;
exports.isValidRecipientName = isValidRecipientName;
exports.filterRecipientNameInput = filterRecipientNameInput;
exports.countryFlagEmoji = countryFlagEmoji;
exports.isPhoneCountryIso = isPhoneCountryIso;
exports.callingCodeForIso = callingCodeForIso;
exports.isoFromCountryHint = isoFromCountryHint;
exports.filterNationalPhoneInput = filterNationalPhoneInput;
exports.evaluateRecipientPhone = evaluateRecipientPhone;
exports.recipientPhoneParts = recipientPhoneParts;
exports.ingestPastedPhone = ingestPastedPhone;
exports.phoneFromStoredValue = phoneFromStoredValue;
exports.recipientNameErrorMessage = recipientNameErrorMessage;
exports.recipientPhoneErrorMessage = recipientPhoneErrorMessage;
exports.recipientPhoneSuccessMessage = recipientPhoneSuccessMessage;
exports.countryDisplayName = countryDisplayName;
exports.listCountryDialOptions = listCountryDialOptions;
exports.normalizeRecipientContact = normalizeRecipientContact;
const max_1 = __importStar(require("libphonenumber-js/max"));
exports.DEFAULT_PHONE_COUNTRY = 'SY';
exports.RECIPIENT_NAME_MAX_LENGTH = 80;
const NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EASTERN_ARABIC_INDIC = /[\u06F0-\u06F9]/g;
const NATIONAL_DIGIT_CHARS = /[0-9\u0660-\u0669\u06F0-\u06F9]/g;
const NAME_ALLOWED_CHAR = /^[\p{L}\p{M} ]$/u;
function normalizeArabicIndicDigits(raw) {
    return raw
        .replace(ARABIC_INDIC, (ch) => String(ch.charCodeAt(0) - 0x0660))
        .replace(EASTERN_ARABIC_INDIC, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}
function normalizeRecipientName(raw) {
    if (raw == null)
        return '';
    return raw.trim().replace(/\s+/g, ' ');
}
function isValidRecipientName(raw) {
    const normalized = normalizeRecipientName(raw);
    if (!normalized)
        return true;
    if (normalized.length > exports.RECIPIENT_NAME_MAX_LENGTH)
        return false;
    return NAME_PATTERN.test(normalized);
}
function filterRecipientNameInput(raw) {
    const kept = [...raw].filter((ch) => NAME_ALLOWED_CHAR.test(ch)).join('');
    return kept.replace(/^ +/, '').replace(/ {2,}/g, ' ');
}
function countryFlagEmoji(iso) {
    const u = iso.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(u))
        return '🏳️';
    return String.fromCodePoint(...[...u].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}
function isPhoneCountryIso(raw) {
    if (!raw)
        return false;
    const u = raw.trim().toUpperCase();
    return u.length === 2 && (0, max_1.isSupportedCountry)(u);
}
function callingCodeForIso(iso) {
    const u = iso.trim().toUpperCase();
    if (!(0, max_1.isSupportedCountry)(u))
        return null;
    try {
        return String((0, max_1.getCountryCallingCode)(u));
    }
    catch {
        return null;
    }
}
function isoFromCountryHint(raw) {
    if (raw == null)
        return null;
    const t = raw.trim();
    if (!t)
        return null;
    const upper = t.toUpperCase();
    if (upper === 'SYR' || upper === 'SYRIA')
        return 'SY';
    if ((0, max_1.isSupportedCountry)(upper))
        return upper;
    const digits = t.replace(/\D/g, '');
    if (!digits)
        return null;
    const matches = (0, max_1.getCountries)().filter((iso) => String((0, max_1.getCountryCallingCode)(iso)) === digits);
    if (matches.length === 1)
        return matches[0];
    return null;
}
function filterNationalPhoneInput(raw) {
    const matches = raw.match(NATIONAL_DIGIT_CHARS);
    if (!matches)
        return '';
    return normalizeArabicIndicDigits(matches.join(''));
}
function asCountryCode(iso) {
    const u = iso.trim().toUpperCase();
    return (0, max_1.isSupportedCountry)(u) ? u : null;
}
function evaluateRecipientPhone(countryIso, nationalNumber) {
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
    const lengthError = (0, max_1.validatePhoneNumberLength)(national, iso);
    const parsed = (0, max_1.default)(national, iso);
    const isPossible = parsed?.isPossible() === true;
    const isValid = parsed?.isValid() === true;
    const e164 = isValid && parsed ? parsed.number : null;
    const nationalSignificant = parsed?.nationalNumber ?? national;
    let state;
    if (isValid)
        state = 'valid';
    else if (lengthError === 'TOO_SHORT')
        state = 'typing';
    else if (isPossible && lengthError == null)
        state = 'possible';
    else
        state = 'invalid';
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
function recipientPhoneParts(evalResult) {
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
function ingestPastedPhone(raw, currentCountryIso) {
    const current = asCountryCode(currentCountryIso) ?? exports.DEFAULT_PHONE_COUNTRY;
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
        const parsed = (0, max_1.default)(international);
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
    const parsedNational = (0, max_1.default)(national, current);
    return {
        countryIso: current,
        nationalNumber: parsedNational?.nationalNumber ?? national,
        switchedCountry: false,
    };
}
function phoneFromStoredValue(storedPhone, countryHint, fallbackIso = exports.DEFAULT_PHONE_COUNTRY) {
    const hintIso = isoFromCountryHint(countryHint);
    const raw = (storedPhone ?? '').trim();
    if (!raw) {
        return { countryIso: hintIso ?? fallbackIso, nationalNumber: '' };
    }
    const ingested = ingestPastedPhone(raw, hintIso ?? fallbackIso);
    const iso = asCountryCode(ingested.countryIso) ?? hintIso ?? fallbackIso;
    return { countryIso: iso, nationalNumber: ingested.nationalNumber };
}
function recipientNameErrorMessage(isArabic) {
    return isArabic
        ? 'الاسم يقبل الحروف العربية أو الإنجليزية والمسافات فقط.'
        : 'Name can only contain Arabic or English letters and spaces.';
}
function recipientPhoneErrorMessage(countryName, isArabic) {
    if (!countryName) {
        return isArabic ? 'يرجى اختيار الدولة وإدخال رقم هاتف صالح.' : 'Please select a country and enter a valid phone number.';
    }
    return isArabic
        ? `يرجى إدخال رقم هاتف صالح لـ ${countryName}.`
        : `Please enter a valid phone number for ${countryName}.`;
}
function recipientPhoneSuccessMessage(isArabic) {
    return isArabic ? 'رقم هاتف صالح' : 'Valid phone number';
}
function countryDisplayName(iso, locale) {
    const u = iso.trim().toUpperCase();
    try {
        const name = new Intl.DisplayNames([locale], { type: 'region' }).of(u);
        if (name)
            return name;
    }
    catch {
    }
    return u;
}
const countryOptionCache = new Map();
function listCountryDialOptions(locale = 'en') {
    const key = locale.slice(0, 2).toLowerCase();
    const cached = countryOptionCache.get(key);
    if (cached)
        return cached;
    const display = new Intl.DisplayNames([key], { type: 'region' });
    const options = (0, max_1.getCountries)()
        .map((iso) => {
        const callingCode = String((0, max_1.getCountryCallingCode)(iso));
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
function normalizeRecipientContact(input) {
    const out = {};
    if (input.recipientName !== undefined && input.recipientName !== null) {
        const normalized = normalizeRecipientName(input.recipientName);
        if (normalized === '') {
            out.recipientName = null;
        }
        else if (!isValidRecipientName(normalized)) {
            return {
                ok: false,
                field: 'recipientName',
                message: recipientNameErrorMessage(false),
            };
        }
        else {
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
        }
        else {
            const hintIso = isoFromCountryHint(countryRaw);
            const ingested = ingestPastedPhone(trimmed, hintIso ?? exports.DEFAULT_PHONE_COUNTRY);
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
    }
    else if (countryRaw !== undefined) {
        if (countryRaw == null || String(countryRaw).trim() === '') {
            out.shippingPhoneCountry = null;
        }
        else {
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
//# sourceMappingURL=recipient-contact.js.map