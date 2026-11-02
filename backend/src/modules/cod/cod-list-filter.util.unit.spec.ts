import { buildCodRecordWhere } from './cod-list-filter.util';

describe('buildCodRecordWhere', () => {
  it('filters to one client when companyId is set', () => {
    expect(buildCodRecordWhere({ companyId: 'client-a' })).toEqual({
      companyId: 'client-a',
    });
  });

  it('returns all authorized records when no client is selected', () => {
    expect(buildCodRecordWhere({})).toEqual({});
  });

  it('combines client, status, search, dates, and amount filters', () => {
    const where = buildCodRecordWhere({
      companyId: 'client-a',
      status: 'available',
      search: 'OMS-1',
      createdFrom: '2026-10-01',
      createdTo: '2026-10-31',
      amountMin: 10,
      amountMax: 90,
    });
    expect(where.companyId).toBe('client-a');
    expect(where.status).toBe('available');
    expect(where.originalAmount).toEqual({ gte: 10, lte: 90 });
    expect(where.createdAt).toEqual(
      expect.objectContaining({
        gte: new Date('2026-10-01'),
      }),
    );
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { omsOrder: { orderNumber: { contains: 'OMS-1', mode: 'insensitive' } } },
      ]),
    );
  });
});
