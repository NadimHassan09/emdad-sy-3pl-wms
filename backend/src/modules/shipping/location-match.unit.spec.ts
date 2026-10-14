import { AddressResolveService } from './address-resolve.service';

describe('AddressResolveService indexed places', () => {
  const service = new AddressResolveService();

  it('resolves التفاحية - مركز القامشلي from the location index', () => {
    const result = service.resolveFromAddress({
      governorate: 'الحسكة',
      cityRegion: 'التفاحية - مركز القامشلي',
    });
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.source).toBe('neighborhood');
    expect(result.townNeighborhood).toContain('التفاحية');
    expect(result.cityRegion).toContain('القامشلي');
    expect(result.lat).not.toBe(0);
  });

  it('resolves جرابلس from the free-text district without using the province centroid', () => {
    const province = service.resolveFromAddress({ governorate: 'حلب' });
    const result = service.resolveFromAddress({
      governorate: 'حلب',
      cityRegion: 'حلب جرابلس عند المعبر الشرقي',
    });
    expect(result.found).toBe(true);
    if (!result.found || !province.found) return;
    expect(result.townNeighborhood).toBe('جرابلس');
    expect(result.lat).not.toBe(province.lat);
  });

  it('does not invent coordinates when nothing in the index matches', () => {
    const result = service.resolveFromAddress({
      governorate: 'الحسكة',
      cityRegion: 'حي لا يوجد في الفهرس ابدا',
    });
    expect(result.found).toBe(false);
  });
});
