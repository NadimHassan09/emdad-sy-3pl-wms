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

describe('BabelAddressAdapter.validateNeighbourhoodId', () => {
  it('validates neighbourhood ID exists and matches governorate via index fallback', async () => {
    const prismaMock = {
      babelNeighbourhood: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const adapter = new (require('./babel-address.adapter').BabelAddressAdapter)(prismaMock);

    // ID 436 is in Aleppo in babelAddressIndex
    const valid = await adapter.validateNeighbourhoodId(436, { governorate: 'حلب' });
    expect(valid).toBe(true);

    // ID 436 supplied for Damascus should be rejected
    const mismatch = await adapter.validateNeighbourhoodId(436, { governorate: 'دمشق' });
    expect(mismatch).toBe(false);

    // Non-existent ID should be rejected
    const nonExistent = await adapter.validateNeighbourhoodId(99999999, { governorate: 'حلب' });
    expect(nonExistent).toBe(false);
  });

  it('validates neighbourhood ID via database snapshot', async () => {
    const prismaMock = {
      babelNeighbourhood: {
        findUnique: jest.fn().mockResolvedValue({
          id: 500,
          area: { city: { name: 'دمشق' } },
        }),
      },
    } as any;
    const adapter = new (require('./babel-address.adapter').BabelAddressAdapter)(prismaMock);

    const valid = await adapter.validateNeighbourhoodId(500, { governorate: 'دمشق' });
    expect(valid).toBe(true);

    const mismatch = await adapter.validateNeighbourhoodId(500, { governorate: 'حلب' });
    expect(mismatch).toBe(false);
  });
});

