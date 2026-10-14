import babelAddressIndex from '../../../../data/syria-locations/babel-address-index.json';
import { lookupBabelNeighbourhoodIdFromIndex } from './babel-address.adapter';

describe('lookupBabelNeighbourhoodIdFromIndex', () => {
  it('resolves an exact governorate / area / neighbourhood key', () => {
    expect(
      lookupBabelNeighbourhoodIdFromIndex(babelAddressIndex, {
        governorate: 'حلب',
        cityRegion: 'مدينة حلب',
        townNeighborhood: 'الشيخ نجار',
      }),
    ).toBe(436);
  });

  it('resolves the warehouse row that stores the neighbourhood in the district field', () => {
    expect(
      lookupBabelNeighbourhoodIdFromIndex(babelAddressIndex, {
        governorate: 'حلب',
        cityRegion: 'الشيخ نجار',
        townNeighborhood: 'الشيخ نجار',
      }),
    ).toBe(436);
  });

  it('returns null when several neighbourhoods share the name', () => {
    expect(
      lookupBabelNeighbourhoodIdFromIndex(
        {
          entries: {
            'حلب\u001fأ\u001fمكرر': 1,
            'حلب\u001fب\u001fمكرر': 2,
          },
        },
        { governorate: 'حلب', cityRegion: 'مكرر', townNeighborhood: 'مكرر' },
      ),
    ).toBeNull();
  });
});
