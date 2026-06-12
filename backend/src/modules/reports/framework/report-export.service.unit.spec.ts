import { ReportExportService } from './report-export.service';
import { ReportsPolicyConfig } from '../reports-policy.config';

describe('ReportExportService', () => {
  it('builds CSV export with pagination', async () => {
    const service = new ReportExportService(new ReportsPolicyConfig());
    let calls = 0;
    const result = await service.buildExport(
      'inventory',
      { warehouseId: '11111111-1111-1111-1111-111111111111', limit: 500, offset: 0 },
      'csv',
      async (offset, limit) => {
        calls += 1;
        if (calls === 1) {
          return {
            items: [{ sku: 'SKU-1', product: 'Widget' }],
            total: 1,
            limit,
            offset,
            truncated: false,
          };
        }
        return { items: [], total: 1, limit, offset, truncated: false };
      },
    );

    expect(result.format).toBe('csv');
    expect(result.rowCount).toBe(1);
    expect(result.body).toContain('SKU');
    expect(result.filename).toMatch(/inventory-.*\.csv$/);
  });
});
