import { BadRequestException } from '@nestjs/common';

import { getReportDefinition } from './report-registry.config';
import { normalizeReportQuery, validateReportFilters } from './report-filters.util';

describe('report-filters.util', () => {
  it('requires warehouse for inventory report', () => {
    const def = getReportDefinition('inventory')!;
    expect(() => validateReportFilters(def, { limit: 50, offset: 0 })).toThrow(BadRequestException);
  });

  it('rejects inverted date range', () => {
    const def = getReportDefinition('product-moves')!;
    expect(() =>
      validateReportFilters(def, {
        warehouseId: '11111111-1111-1111-1111-111111111111',
        dateFrom: '2026-06-10',
        dateTo: '2026-06-01',
        limit: 50,
        offset: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('normalizes empty strings to undefined', () => {
    const normalized = normalizeReportQuery({
      warehouseId: '  ',
      sku: '',
      limit: 25,
      offset: 0,
    });
    expect(normalized.warehouseId).toBeUndefined();
    expect(normalized.sku).toBeUndefined();
  });
});
