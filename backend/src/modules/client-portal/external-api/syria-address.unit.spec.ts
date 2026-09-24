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
