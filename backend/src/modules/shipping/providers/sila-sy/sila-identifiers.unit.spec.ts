import {
  extractSilaApiLookupKeys,
  extractSilaCarrierAwb,
  extractSilaProviderId,
  isSilaPlatformIdentifier,
} from './sila-identifiers';

describe('Sila identifier mapping', () => {
  it('reads the Tarabut carrier AWB and ignores the Sila token and SL waybill', () => {
    const cargo = {
      id: '36b41ddb-c312-4e45-afda-08299ad52317',
      tracking_token: 'db451c14090b4087908d87c758f3f06e',
      courier_barcode: '100537003427',
      shipments: [
        {
          tracking_number: 'SL-2SM3ZAEZ-6',
          remote_barcode: '100537003427',
          remote_label_code: '100537003427',
        },
      ],
    };

    expect(extractSilaProviderId(cargo)).toBe('36b41ddb-c312-4e45-afda-08299ad52317');
    expect(extractSilaCarrierAwb(cargo)).toBe('100537003427');
    expect(isSilaPlatformIdentifier('SL-2SM3ZAEZ-6', cargo)).toBe(true);
    expect(isSilaPlatformIdentifier('db451c14090b4087908d87c758f3f06e')).toBe(true);
    expect(isSilaPlatformIdentifier('100537003427', cargo)).toBe(false);
  });

  it('uses Fatih portal tracking (courier barcode), not remote_label_code AWB…', () => {
    const cargo = {
      id: '46886c7b-de43-458b-ac80-0eaae23c5c53',
      tracking_token: '03a32da3e3b54ef388b900b3bbf1eb3d',
      courier_barcode: '5004181',
      courier: { tracking_number: '5004181' },
      shipments: [
        {
          tracking_number: 'SL-T3H9VQA6-N',
          remote_barcode: '5004181',
          remote_label_code: 'AWB20261011023902',
        },
      ],
    };

    expect(extractSilaCarrierAwb(cargo)).toBe('5004181');
  });

  it('falls back to remote_label_code when portal barcode is missing', () => {
    const cargo = {
      id: '46886c7b-de43-458b-ac80-0eaae23c5c53',
      tracking_token: '03a32da3e3b54ef388b900b3bbf1eb3d',
      courier_barcode: null,
      shipments: [
        {
          tracking_number: 'SL-T3H9VQA6-N',
          remote_barcode: null,
          remote_label_code: 'AWB20261011023902',
        },
      ],
    };

    expect(extractSilaCarrierAwb(cargo)).toBe('AWB20261011023902');
  });

  it('returns empty when the carrier has not assigned an AWB', () => {
    const cargo = {
      id: '535fee3c-7963-48be-bc0e-199a3d89495a',
      tracking_token: 'a0bfdd1be6264f6c81289bbea8cc4140',
      courier_barcode: null,
      shipments: [{ tracking_number: 'SL-WURZVES7-Q', remote_barcode: null, remote_label_code: null }],
    };

    expect(extractSilaCarrierAwb(cargo)).toBe('');
    expect(extractSilaProviderId(cargo)).toBe('535fee3c-7963-48be-bc0e-199a3d89495a');
  });

  it('prefers Sila cargo id then barcode for API lookup and never the courier AWB', () => {
    const cargo = {
      id: '36b41ddb-c312-4e45-afda-08299ad52317',
      tracking_token: 'db451c14090b4087908d87c758f3f06e',
      barcode: 'db451c14090b4087908d87c758f3f06e',
      courier_barcode: '100537003427',
      shipments: [{ remote_label_code: '100537003427' }],
    };
    expect(extractSilaApiLookupKeys(cargo, '100537003427')).toEqual([
      '36b41ddb-c312-4e45-afda-08299ad52317',
      'db451c14090b4087908d87c758f3f06e',
    ]);
  });
});
