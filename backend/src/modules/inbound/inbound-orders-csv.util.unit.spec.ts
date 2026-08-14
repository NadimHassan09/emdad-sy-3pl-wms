import {
  csvEscape,
  mapCsvHeaderRow,
  parseCsv,
  rowsToCsv,
} from './inbound-orders-csv.util';

describe('inbound-orders-csv.util', () => {
  it('escapes commas, quotes, and newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('preserves Arabic/Unicode in CSV output', () => {
    const csv = rowsToCsv(['notes', 'sku'], [['ملاحظة', 'SKU-١']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('ملاحظة');
    expect(csv).toContain('SKU-١');
  });

  it('parses quoted CSV fields with commas and Arabic', () => {
    const rows = parseCsv('a,b\n"١,٢",دمشق\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['١,٢', 'دمشق'],
    ]);
  });

  it('maps import headers case-insensitively', () => {
    const { indexByHeader, unknown } = mapCsvHeaderRow([
      'External_Reference',
      'PRODUCT_SKU',
      'bogus',
    ]);
    expect(indexByHeader.external_reference).toBe(0);
    expect(indexByHeader.product_sku).toBe(1);
    expect(unknown).toEqual(['bogus']);
  });
});
