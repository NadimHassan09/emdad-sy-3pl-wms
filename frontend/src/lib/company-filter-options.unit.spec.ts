import { describe, expect, it } from 'vitest';

import { companyFilterComboboxOptions } from './company-filter-options';

describe('companyFilterComboboxOptions', () => {
  it('includes All Clients plus authorized companies', () => {
    const options = companyFilterComboboxOptions(
      [
        { id: 'a', name: 'Client A' },
        { id: 'b', name: 'Client B' },
      ],
      'All Clients',
    );
    expect(options[0]).toEqual({ value: '', label: 'All Clients' });
    expect(options.map((o) => o.value)).toEqual(['', 'a', 'b']);
  });
});
