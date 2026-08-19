import { getOmsClientImportTemplate, OMS_CLIENT_IMPORT_HEADERS } from './oms-client-import.schema';
import { getInboundClientImportTemplate } from './inbound-client-import.schema';
import { getOutboundClientImportTemplate } from './outbound-client-import.schema';

describe('client import templates', () => {
  it('OMS template has client-known columns only', () => {
    const tpl = getOmsClientImportTemplate();
    const header = tpl.body.replace(/^\uFEFF/, '').split('\n')[0] ?? '';
    expect(header).toContain('order_number');
    expect(header).toContain('governorate');
    expect(header).toContain('sku');
    expect(header).not.toContain('company_id');
    expect(header).not.toContain('status');
    expect(header).not.toContain('carrier');
    expect(header).not.toContain('awb');
    for (const h of OMS_CLIENT_IMPORT_HEADERS) {
      expect(header).toContain(h);
    }
    const lines = tpl.body.replace(/^\uFEFF/, '').trim().split('\n');
    expect(lines[1]).toContain('ORDER-1001');
    expect(lines[2]).toContain('ORDER-1001');
  });

  it('inbound and outbound templates are type-specific', () => {
    const inbound = getInboundClientImportTemplate().body.replace(/^\uFEFF/, '');
    const outbound = getOutboundClientImportTemplate().body.replace(/^\uFEFF/, '');
    expect(inbound).toContain('expected_arrival_date');
    expect(inbound).toContain('expected_quantity');
    expect(inbound).not.toContain('governorate');
    expect(outbound).toContain('destination_address');
    expect(outbound).toContain('requested_quantity');
    expect(outbound).not.toContain('governorate');
    expect(outbound).not.toContain('company_id');
  });
});
