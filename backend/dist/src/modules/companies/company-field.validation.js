"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_FIELD_MESSAGES = exports.COMPANY_PHONE_PATTERN = exports.COMPANY_COUNTRY_PATTERN = exports.COMPANY_CITY_PATTERN = exports.COMPANY_ORG_NAME_PATTERN = void 0;
exports.COMPANY_ORG_NAME_PATTERN = /^(?=.*\p{L})[\p{L}\p{M}0-9\s.'’&()/+\-]{2,200}$/u;
exports.COMPANY_CITY_PATTERN = /^(?=.*\p{L})[\p{L}\p{M}\s.'’\-]{2,120}$/u;
exports.COMPANY_COUNTRY_PATTERN = /^(?=.*\p{L})[\p{L}\p{M}\s.\-]{2,64}$/u;
exports.COMPANY_PHONE_PATTERN = /^\+?[0-9](?:[\d\s().\-]{5,38}[0-9])?$/;
exports.COMPANY_FIELD_MESSAGES = {
    name: 'Name must be 2–200 characters and include letters (not numbers only).',
    tradeName: 'Trade name must include letters (not numbers only).',
    contactEmail: 'Contact email must be a valid email address.',
    country: 'Country must be a valid name or ISO code (letters only, 2–64 characters).',
    city: 'City must be a valid name (letters, spaces, hyphens, apostrophes; not numbers).',
    contactPhone: 'Phone must be a valid international number (e.g. +9665xxxxxxx).',
    address: 'Address must be at most 500 characters.',
    notes: 'Notes must be at most 2000 characters.',
};
//# sourceMappingURL=company-field.validation.js.map