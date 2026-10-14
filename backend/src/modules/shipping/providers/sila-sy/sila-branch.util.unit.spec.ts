import { pickNearestSilaBranch, silaBranchPlaceName } from './sila-branch.util';

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
