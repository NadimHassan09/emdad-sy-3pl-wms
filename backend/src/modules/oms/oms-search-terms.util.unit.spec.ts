import { splitOrderSearchTerms } from './oms-search-terms.util';

describe('splitOrderSearchTerms', () => {
  it('returns nothing for empty input', () => {
    expect(splitOrderSearchTerms('')).toEqual([]);
    expect(splitOrderSearchTerms(undefined)).toEqual([]);
    expect(splitOrderSearchTerms('  \n ,; ')).toEqual([]);
  });

  it('keeps a single term whole, including spaces inside a name', () => {
    expect(splitOrderSearchTerms('Nadim Hassan')).toEqual(['Nadim Hassan']);
  });

  it('splits scanned codes on lines, commas and semicolons and removes duplicates', () => {
    expect(splitOrderSearchTerms('OMS-1\nOMS-2, oms-1; 260303960704')).toEqual(['OMS-1', 'OMS-2', '260303960704']);
  });

  it('caps the number of terms', () => {
    const many = Array.from({ length: 150 }, (_, i) => `T${i}`).join('\n');
    expect(splitOrderSearchTerms(many)).toHaveLength(100);
  });
});
