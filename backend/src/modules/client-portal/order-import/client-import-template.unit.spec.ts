import { getOmsClientImportTemplate, OMS_CLIENT_IMPORT_HEADERS } from './oms-client-import.schema';
import {
  parseImportShipDateMdY,
  validateImportCountryCode,
  validateImportOrderNumber,
  validateImportPaymentMethod,
  validateImportRecipientName,
  validateImportAsciiPositiveInt,
} from './oms-client-import.validation';
import { getInboundClientImportTemplate } from './inbound-client-import.schema';
import { getOutboundClientImportTemplate } from './outbound-client-import.schema';

describe('client import templates', () => {
  it('OMS template has client-known columns only', () => {
    const tpl = getOmsClientImportTemplate();
    const header = tpl.body.replace(/^\uFEFF/, '').split('\n')[0] ?? '';
    expect(header).toContain('order_number');
    expect(header).toContain('country_code');
    expect(header).toContain('governorate');
    expect(header).toContain('sku');
    expect(header).toContain('product_name');
    expect(header).not.toContain('currency');
    expect(header).not.toContain('company_id');
    expect(header).not.toContain('status');
    expect(header).not.toContain('carrier');
    expect(header).not.toContain('awb');
    for (const h of OMS_CLIENT_IMPORT_HEADERS) {
      expect(header).toContain(h);
    }
    const lines = tpl.body.replace(/^\uFEFF/, '').trim().split('\n');
    expect(lines[1]).toContain('WA-20260901-001');
    expect(lines[2]).toContain('WA-20260901-001');
  });

  it('inbound and outbound templates are type-specific', () => {
    const inbound = getInboundClientImportTemplate().body.replace(/^\uFEFF/, '');
    const outbound = getOutboundClientImportTemplate().body.replace(/^\uFEFF/, '');
    expect(inbound).toContain('expected_arrival_date');
    expect(inbound).toContain('quantity');
    expect(inbound).toContain('product_name');
    expect(inbound).toContain('INB-1001');
    expect(inbound).toContain('9/01/2026');
    expect(inbound).not.toContain('governorate');
    expect(inbound).not.toContain('source_type');
    expect(outbound).toContain('destination_address');
    expect(outbound).toContain('requested_quantity');
    expect(outbound).not.toContain('governorate');
    expect(outbound).not.toContain('company_id');
  });
});

describe('oms client import validation', () => {
  it('accepts order numbers with English letters, digits, and hyphen only', () => {
    expect(validateImportOrderNumber('WA-20260822-001').ok).toBe(true);
    expect(validateImportOrderNumber('WA-طلب-1').ok).toBe(false);
    expect(validateImportOrderNumber('WA-1&^%').ok).toBe(false);
  });

  it('requires M/DD/YYYY ship dates with English digits', () => {
    expect(parseImportShipDateMdY('9/01/2026')).toEqual({ ok: true, ymd: '2026-09-01' });
    expect(parseImportShipDateMdY('2026-09-01').ok).toBe(false);
    expect(parseImportShipDateMdY('٠١/٠٩/٢٠٢٦').ok).toBe(false);
  });

  it('requires ASCII digit country codes without +', () => {
    expect(validateImportCountryCode('963').ok).toBe(true);
    expect(validateImportCountryCode('+963').ok).toBe(false);
    expect(validateImportCountryCode('plus963').ok).toBe(false);
  });

  it('requires Arabic/English letter recipient names', () => {
    expect(validateImportRecipientName('Ahmed Ali').ok).toBe(true);
    expect(validateImportRecipientName('أحمد').ok).toBe(true);
    expect(validateImportRecipientName('Ahmed2').ok).toBe(false);
  });

  it('accepts only COD Prepaid Credit payment methods', () => {
    expect(validateImportPaymentMethod('COD').ok).toBe(true);
    expect(validateImportPaymentMethod('Prepaid').ok).toBe(true);
    expect(validateImportPaymentMethod('Credit').ok).toBe(true);
    expect(validateImportPaymentMethod('cash').ok).toBe(false);
  });

  it('requires English-digit quantities', () => {
    expect(validateImportAsciiPositiveInt('10', 'Quantity')).toEqual({ ok: true, value: 10 });
    expect(validateImportAsciiPositiveInt('١٠', 'Quantity').ok).toBe(false);
    expect(validateImportAsciiPositiveInt('1.5', 'Quantity').ok).toBe(false);
  });
});
