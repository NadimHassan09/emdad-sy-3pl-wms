import {
  parseImportShipDateMdY,
  validateImportAsciiPositiveInt,
  validateImportCountryCode,
  validateImportOrderNumber,
  validateImportPaymentMethod,
  validateImportRecipientName,
} from './oms-client-import.validation';

describe('oms-client-import.validation', () => {
  it('validates order_number charset', () => {
    expect(validateImportOrderNumber('WA-20260822-001')).toEqual({
      ok: true,
      value: 'WA-20260822-001',
    });
    expect(validateImportOrderNumber('WA-طلب-88435').ok).toBe(false);
    expect(validateImportOrderNumber('WA-88435&^%').ok).toBe(false);
  });

  it('parses only M/DD/YYYY ship dates', () => {
    expect(parseImportShipDateMdY('9/01/2026')).toEqual({ ok: true, ymd: '2026-09-01' });
    expect(parseImportShipDateMdY('12/31/2026')).toEqual({ ok: true, ymd: '2026-12-31' });
    expect(parseImportShipDateMdY('2026-09-01').ok).toBe(false);
    expect(parseImportShipDateMdY('01-09-2026').ok).toBe(false);
  });

  it('validates country_code as ASCII digits', () => {
    expect(validateImportCountryCode('963').ok).toBe(true);
    expect(validateImportCountryCode('+963').ok).toBe(false);
    expect(validateImportCountryCode('%963').ok).toBe(false);
  });

  it('validates recipient name letters only', () => {
    expect(validateImportRecipientName('Ahmed').ok).toBe(true);
    expect(validateImportRecipientName('أحمد علي').ok).toBe(true);
    expect(validateImportRecipientName('Ahmed 2').ok).toBe(false);
  });

  it('validates payment method whitelist', () => {
    expect(validateImportPaymentMethod('COD').ok).toBe(true);
    expect(validateImportPaymentMethod('Prepaid').ok).toBe(true);
    expect(validateImportPaymentMethod('Credit').ok).toBe(true);
    expect(validateImportPaymentMethod('PREPAID').ok).toBe(true);
    expect(validateImportPaymentMethod('Cash').ok).toBe(false);
  });

  it('validates quantity as ASCII digits', () => {
    expect(validateImportAsciiPositiveInt('12', 'Quantity')).toEqual({ ok: true, value: 12 });
    expect(validateImportAsciiPositiveInt('12a', 'Quantity').ok).toBe(false);
    expect(validateImportAsciiPositiveInt('١٢', 'Quantity').ok).toBe(false);
  });
});
