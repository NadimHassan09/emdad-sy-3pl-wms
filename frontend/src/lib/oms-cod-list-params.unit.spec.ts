import { describe, expect, it } from 'vitest';

import { buildCodListParams } from './oms-cod-list-params';

describe('buildCodListParams', () => {
  it('sends a selected client to the server-side COD list', () => {
    expect(buildCodListParams({ companyId: 'client-a' }).companyId).toBe('client-a');
  });

  it('omits companyId for All Clients so the API returns all authorized records', () => {
    expect(buildCodListParams({ companyId: '' }).companyId).toBeUndefined();
    expect(buildCodListParams({}).companyId).toBeUndefined();
  });

  it('combines client with existing filters', () => {
    expect(
      buildCodListParams({
        companyId: 'client-a',
        status: 'paid_out',
        search: 'Buyer',
        createdFrom: '2026-10-01',
      }),
    ).toEqual({
      companyId: 'client-a',
      status: 'paid_out',
      search: 'Buyer',
      createdFrom: '2026-10-01',
      createdTo: undefined,
      amountMin: undefined,
      amountMax: undefined,
    });
  });
});
