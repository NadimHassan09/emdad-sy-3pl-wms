/**
 * Client-side company form validation — keep rules aligned with
 * `backend/src/modules/companies/company-field.validation.ts`.
 */

export const COMPANY_ORG_NAME_PATTERN =
  /^(?=.*\p{L})[\p{L}\p{M}0-9\s.'’&()/+\-]{2,200}$/u;

export const COMPANY_CITY_PATTERN = /^(?=.*\p{L})[\p{L}\p{M}\s.'’\-]{2,120}$/u;

export const COMPANY_COUNTRY_PATTERN = /^(?=.*\p{L})[\p{L}\p{M}\s.\-]{2,64}$/u;

export const COMPANY_PHONE_PATTERN = /^\+?[0-9](?:[\d\s().\-]{5,38}[0-9])?$/;

export const COMPANY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CompanyFormFields = {
  name: string;
  tradeName?: string | null;
  contactEmail: string;
  country: string;
  city: string;
  contactPhone?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type CompanyFormErrors = Partial<Record<keyof CompanyFormFields, string>>;

export function companyValidationMessages(isArabic: boolean) {
  if (isArabic) {
    return {
      name: 'الاسم مطلوب (حرفان على الأقل) ويجب أن يحتوي على أحرف وليس أرقاماً فقط.',
      tradeName: 'الاسم التجاري يجب أن يحتوي على أحرف وليس أرقاماً فقط.',
      contactEmail: 'أدخل بريداً إلكترونياً صالحاً.',
      country: 'الدولة مطلوبة: اسم دولة أو رمز ISO (حروف فقط).',
      city: 'المدينة مطلوبة ويجب أن تكون اسماً صالحاً (حروف، مسافات، شرطات؛ بدون أرقام فقط).',
      contactPhone: 'أدخل رقم هاتف دولياً صالحاً (مثال: +9665xxxxxxx).',
      address: 'العنوان يجب ألا يتجاوز 500 حرفاً.',
      notes: 'الملاحظات يجب ألا تتجاوز 2000 حرف.',
    } as const;
  }
  return {
    name: 'Name is required (min 2 characters) and must include letters, not numbers only.',
    tradeName: 'Trade name must include letters, not numbers only.',
    contactEmail: 'Enter a valid contact email address.',
    country: 'Country is required: a country name or ISO code (letters only).',
    city: 'City is required and must be a valid name (letters, spaces, hyphens; not numbers).',
    contactPhone: 'Enter a valid international phone number (e.g. +9665xxxxxxx).',
    address: 'Address must be at most 500 characters.',
    notes: 'Notes must be at most 2000 characters.',
  } as const;
}

function trim(v: string | null | undefined): string {
  return (v ?? '').trim();
}

/** Returns field errors; empty object means valid. */
export function validateCompanyForm(
  input: CompanyFormFields,
  opts: { isArabic?: boolean; requireCity?: boolean } = {},
): CompanyFormErrors {
  const isArabic = opts.isArabic ?? false;
  const requireCity = opts.requireCity ?? true;
  const msg = companyValidationMessages(isArabic);
  const errors: CompanyFormErrors = {};

  const name = trim(input.name);
  if (name.length < 2 || name.length > 200 || !COMPANY_ORG_NAME_PATTERN.test(name)) {
    errors.name = msg.name;
  }

  const tradeName = trim(input.tradeName ?? '');
  if (tradeName && (tradeName.length < 2 || !COMPANY_ORG_NAME_PATTERN.test(tradeName))) {
    errors.tradeName = msg.tradeName;
  }

  const email = trim(input.contactEmail).toLowerCase();
  if (!email || email.length > 320 || !COMPANY_EMAIL_PATTERN.test(email)) {
    errors.contactEmail = msg.contactEmail;
  }

  const country = trim(input.country);
  if (country.length < 2 || country.length > 64 || !COMPANY_COUNTRY_PATTERN.test(country)) {
    errors.country = msg.country;
  }

  const city = trim(input.city);
  if (requireCity) {
    if (city.length < 2 || city.length > 120 || !COMPANY_CITY_PATTERN.test(city)) {
      errors.city = msg.city;
    }
  } else if (city && (city.length < 2 || !COMPANY_CITY_PATTERN.test(city))) {
    errors.city = msg.city;
  }

  const phone = trim(input.contactPhone ?? '');
  if (phone && (phone.length > 40 || !COMPANY_PHONE_PATTERN.test(phone))) {
    errors.contactPhone = msg.contactPhone;
  }

  const address = trim(input.address ?? '');
  if (address.length > 500) {
    errors.address = msg.address;
  }

  const notes = trim(input.notes ?? '');
  if (notes.length > 2000) {
    errors.notes = msg.notes;
  }

  return errors;
}

/** Sanitize payload for API: trim, drop blanks on optionals, lowercase email. */
export function sanitizeCompanyPayload<T extends CompanyFormFields>(input: T): T {
  const tradeName = trim(input.tradeName ?? '');
  const phone = trim(input.contactPhone ?? '');
  const address = trim(input.address ?? '');
  const notes = trim(input.notes ?? '');
  return {
    ...input,
    name: trim(input.name),
    tradeName: tradeName || undefined,
    contactEmail: trim(input.contactEmail).toLowerCase(),
    country: trim(input.country),
    city: trim(input.city),
    contactPhone: phone || undefined,
    address: address || undefined,
    notes: notes || undefined,
  };
}
