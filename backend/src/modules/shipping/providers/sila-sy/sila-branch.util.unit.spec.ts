import { pickNearestSilaBranch, resolveSilaHubOptions, silaBranchPlaceName } from './sila-branch.util';

describe('pickNearestSilaBranch', () => {
  const homsBranches = [
    { id: 'dablan', name: 'مسارات - الدبلان' },
    { id: 'rastan', name: 'مسارات - الرستن' },
    { id: 'shin', name: 'مسارات - شين' },
    { id: 'marmarita', name: 'مسارات - مرمريتا' },
  ];

  it('reads the place after the courier prefix', () => {
    expect(silaBranchPlaceName('مسارات - الدبلان')).toBe('الدبلان');
  });

  it('picks the Homs city branch for الأرمن instead of a distant town', () => {
    const picked = pickNearestSilaBranch(homsBranches, {
      governorate: 'حمص',
      neighborhood: 'الأرمن',
      lat: 34.71053,
      lng: 36.739745,
    });
    expect(picked?.id).toBe('dablan');
  });
});

describe('resolveSilaHubOptions', () => {
  const homsBranches = [
    { id: 'dablan', name: 'مسارات - الدبلان' },
    { id: 'rastan', name: 'مسارات - الرستن' },
    { id: 'shin', name: 'مسارات - شين' },
  ];

  it('returns the provider hub list and marks the nearest hub', () => {
    const resolved = resolveSilaHubOptions(homsBranches, {
      governorate: 'حمص',
      neighborhood: 'الأرمن',
      lat: 34.71053,
      lng: 36.739745,
    });
    expect(resolved.hubs.map((hub) => hub.id)).toEqual(['dablan', 'rastan', 'shin']);
    expect(resolved.nearestDetermined).toBe(true);
    expect(resolved.nearestId).toBe('dablan');
    expect(resolved.hubs.find((hub) => hub.id === 'dablan')?.nearest).toBe(true);
  });

  it('does not guess a nearest hub when coordinates cannot be resolved', () => {
    const resolved = resolveSilaHubOptions(homsBranches, {
      governorate: '',
      neighborhood: '',
    });
    expect(resolved.nearestDetermined).toBe(false);
    expect(resolved.nearestId).toBeNull();
    expect(resolved.hubs.every((hub) => hub.nearest === false)).toBe(true);
  });

  it('keeps a manual override distinct from the nearest default', () => {
    const resolved = resolveSilaHubOptions(homsBranches, {
      governorate: 'حمص',
      neighborhood: 'الأرمن',
      lat: 34.71053,
      lng: 36.739745,
    });
    expect(resolved.nearestId).toBe('dablan');
    expect(resolved.hubs.some((hub) => hub.id === 'rastan' && hub.nearest === false)).toBe(true);
  });
});
