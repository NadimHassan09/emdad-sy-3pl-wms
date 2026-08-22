import { describe, expect, it } from 'vitest';

import { countNonEmptyFilters, joinFilterSummary, normalizeFilters } from '../../../shared/design-system-next/lib/filter-state';

describe('countNonEmptyFilters', () => {
  it('counts non-empty strings and true booleans', () => {
    expect(
      countNonEmptyFilters({
        search: 'x',
        status: '',
        overdueOnly: true,
        includeInternal: false,
        skip: null,
      }),
    ).toBe(2);
  });

  it('restricts to given keys', () => {
    expect(countNonEmptyFilters({ a: '1', b: '2' }, ['a'])).toBe(1);
  });
});

describe('normalizeFilters', () => {
  const defaults = { search: '', status: '', overdueOnly: false };

  it('fills missing keys from legacy cache', () => {
    expect(normalizeFilters({ search: 'sku' }, defaults)).toEqual({
      search: 'sku',
      status: '',
      overdueOnly: false,
    });
  });

  it('survives null cache', () => {
    expect(normalizeFilters(null, defaults)).toEqual(defaults);
  });
});

describe('joinFilterSummary', () => {
  it('joins non-empty parts', () => {
    expect(joinFilterSummary(['Status: Active', '  ', null, 'Client: Acme'])).toBe(
      'Status: Active · Client: Acme',
    );
  });
});
