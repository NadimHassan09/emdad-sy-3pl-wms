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
});
