import { resolveSyriaAddress } from './syria-address';

describe('resolveSyriaAddress', () => {
  it('requires governorate and city', () => {
    const result = resolveSyriaAddress({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.governorate).toBeTruthy();
      expect(result.fields.city).toBeTruthy();
    }
  });

  it('resolves a known Aleppo city/area', () => {
    const result = resolveSyriaAddress({
      governorate: 'حلب',
      city: 'أتارب',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.governorate).toBe('حلب');
      expect(result.value.city).toBe('أتارب');
    }
  });

  it('tolerates Arabic letter variants (ى/ي, ة/ه, أ/ا)', () => {
    const result = resolveSyriaAddress({
      governorate: 'حلب',
      city: 'اتارب', // أ → ا
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.city).toBe('أتارب');
    }
  });

  it('rejects an unknown neighborhood', () => {
    const result = resolveSyriaAddress({
      governorate: 'حلب',
      city: 'أتارب',
      neighborhood: 'NOT-A-REAL-PLACE-XYZ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.neighborhood).toMatch(/Unknown neighborhood/i);
    }
  });

  it('suggests a close governorate spelling instead of a raw validation error', () => {
    const result = resolveSyriaAddress({
      governorate: 'حلبب', // typo for حلب
      city: 'أتارب',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.governorate).toMatch(/Did you mean/i);
      expect(result.fields.governorate).toMatch(/حلب/);
    }
  });

  it('suggests another governorate when the city belongs elsewhere', () => {
    // الحجر الأسود is under ريف دمشق, not دمشق — classic B11 wrong-gov case.
    const result = resolveSyriaAddress({
      governorate: 'دمشق',
      city: 'الحجر الأسود',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.city).toMatch(/Unknown city/i);
      expect(result.fields.city).toMatch(/Did you mean/i);
      expect(result.fields.city).toMatch(/ريف دمشق/);
    }
  });

  it('resolves newly added eastern cities and neighborhoods', () => {
    const cases = [
      { governorate: 'دير الزور', city: 'دير الزور', neighborhood: 'الجورة' },
      { governorate: 'الحسكة', city: 'الحسكة', neighborhood: 'المدينة' },
      { governorate: 'الحسكة', city: 'القامشلي', neighborhood: 'الهلالية' },
      { governorate: 'الرقة', city: 'الرقة', neighborhood: 'حتين' },
    ];

    for (const c of cases) {
      const result = resolveSyriaAddress(c);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.governorate).toBe(c.governorate);
        expect(result.value.city).toBe(c.city);
        expect(result.value.neighborhood).toBe(c.neighborhood);
      }
    }
  });
});
