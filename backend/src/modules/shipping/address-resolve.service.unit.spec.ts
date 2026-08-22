import { AddressResolveService } from './address-resolve.service';

describe('AddressResolveService.resolveFromAddress', () => {
  const service = new AddressResolveService();

  it('resolves exact neighborhood when indexed via hierarchy crosswalk', () => {
    const result = service.resolveFromAddress({
      governorate: 'حلب',
      cityRegion: 'مدينة حلب',
      townNeighborhood: 'العزيزية',
    });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.source).toBe('neighborhood');
      expect(result.lat).toBeCloseTo(36.208, 2);
      expect(result.lng).toBeCloseTo(37.152, 2);
    }
  });

  it('falls back to city centroid when town is not indexed', () => {
    const result = service.resolveFromAddress({
      governorate: 'حلب',
      cityRegion: 'مدينة حلب',
      townNeighborhood: 'أريحا',
    });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.source).toBe('city');
      expect(result.resolvedLabel).toBe('مدينة حلب');
      expect(result.lat).toBeGreaterThan(35);
      expect(result.lat).toBeLessThan(36.2);
    }
  });

  it('falls back to governorate when city is unknown', () => {
    const result = service.resolveFromAddress({
      governorate: 'حلب',
      cityRegion: 'مدينة غير موجودة',
      townNeighborhood: 'حي غير موجود',
    });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.source).toBe('governorate');
      expect(result.resolvedLabel).toBe('حلب');
    }
  });

  it('resolves city when town is omitted', () => {
    const result = service.resolveFromAddress({
      governorate: 'حلب',
      cityRegion: 'مدينة حلب',
      townNeighborhood: '',
    });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.source).toBe('city');
    }
  });
});
