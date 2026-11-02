import { describe, expect, it } from 'vitest';
import {
  listCities,
  listDistricts,
  listNeighborhoods,
  syriaAddressHierarchy,
  toComboboxOptions,
  validateSyrianAddressHierarchy,
} from './syria-address';

describe('Syrian Address Validation & Canonical Hierarchy', () => {
  it('lists canonical Syrian governorates', () => {
    const governorates = listCities();
    expect(governorates).toContain('دمشق');
    expect(governorates).toContain('ريف دمشق');
    expect(governorates).toContain('حلب');
    expect(governorates).toContain('حمص');
    expect(governorates).not.toContain('المريخ');
  });

  it('lists cities belonging to a selected governorate', () => {
    const damascusCities = listDistricts('دمشق');
    expect(damascusCities).toContain('دمشق');
    expect(damascusCities).not.toContain('أتارب'); // Atarib is in Aleppo
  });

  it('lists neighborhoods belonging to a city and governorate', () => {
    const neighborhoods = listNeighborhoods('دمشق', 'دمشق');
    expect(neighborhoods).toContain('حي الروضة - دمشق');
    expect(neighborhoods).not.toContain('حي الجميلية - حلب');
  });

  it('toComboboxOptions creates options without injecting arbitrary values', () => {
    const options = toComboboxOptions(['دمشق', 'حلب']);
    expect(options).toEqual([
      { value: 'دمشق', label: 'دمشق' },
      { value: 'حلب', label: 'حلب' },
    ]);
  });

  it('validateSyrianAddressHierarchy accepts valid canonical address', () => {
    const result = validateSyrianAddressHierarchy({
      city: 'دمشق',
      district: 'دمشق',
      addressLine1: 'حي الروضة - دمشق',
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('validateSyrianAddressHierarchy rejects invalid governorate', () => {
    const result = validateSyrianAddressHierarchy({
      city: 'المريخ',
      district: 'دمشق',
      addressLine1: 'حي الروضة - دمشق',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid governorate/i);
  });

  it('validateSyrianAddressHierarchy rejects mismatched city for valid governorate', () => {
    const result = validateSyrianAddressHierarchy({
      city: 'دمشق',
      district: 'أتارب',
      addressLine1: 'حي الروضة - دمشق',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/does not belong to governorate "دمشق"/i);
  });

  it('validateSyrianAddressHierarchy rejects mismatched neighborhood for valid city', () => {
    const result = validateSyrianAddressHierarchy({
      city: 'دمشق',
      district: 'دمشق',
      addressLine1: 'حي غير موجود',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/does not belong to دمشق, دمشق/i);
  });

  it('validateSyrianAddressHierarchy rejects missing fields', () => {
    expect(validateSyrianAddressHierarchy({}).valid).toBe(false);
    expect(validateSyrianAddressHierarchy({ city: 'دمشق' }).valid).toBe(false);
    expect(validateSyrianAddressHierarchy({ city: 'دمشق', district: 'دمشق' }).valid).toBe(false);
  });
});
