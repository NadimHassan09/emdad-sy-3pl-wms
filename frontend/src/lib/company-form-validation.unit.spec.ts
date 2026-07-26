import { describe, expect, it } from 'vitest';

import {
  COMPANY_CITY_PATTERN,
  validateCompanyForm,
} from './company-form-validation';

describe('company form validation', () => {
  it('rejects numeric-only city', () => {
    expect(COMPANY_CITY_PATTERN.test('2.5555')).toBe(false);
    const errors = validateCompanyForm({
      name: 'Test company',
      contactEmail: 'a@b.com',
      country: 'SA',
      city: '2.5555',
    });
    expect(errors.city).toBeTruthy();
  });

  it('accepts valid city names', () => {
    expect(COMPANY_CITY_PATTERN.test('Gaziantep')).toBe(true);
    expect(COMPANY_CITY_PATTERN.test("St. John's")).toBe(true);
    expect(COMPANY_CITY_PATTERN.test('الرياض')).toBe(true);
  });

  it('rejects missing required fields', () => {
    const errors = validateCompanyForm({
      name: '',
      contactEmail: 'not-an-email',
      country: '',
      city: '',
    });
    expect(errors.name).toBeTruthy();
    expect(errors.contactEmail).toBeTruthy();
    expect(errors.country).toBeTruthy();
    expect(errors.city).toBeTruthy();
  });

  it('accepts a valid create payload', () => {
    const errors = validateCompanyForm({
      name: 'Test company',
      tradeName: 'Test',
      contactEmail: 'yousef@example.com',
      country: 'Sy',
      city: 'Gaziantep',
      contactPhone: '+905551112233',
      address: 'No:23 Nisan mah',
    });
    expect(errors).toEqual({});
  });
});
