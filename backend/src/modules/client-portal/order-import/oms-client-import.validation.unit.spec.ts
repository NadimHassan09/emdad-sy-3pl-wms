import {
  parseImportShipDateMdY,
  stripLeadingZeros,
  validateImportAsciiPositiveInt,
  validateImportCountryCode,
  validateImportOrderNumber,
  validateImportPaymentMethod,
  validateImportRecipientName,
} from './oms-client-import.validation';
import { parseSpreadsheetTable } from './spreadsheet.parse';

describe('oms-client-import.validation', () => {
  it('validates order_number charset', () => {
    expect(validateImportOrderNumber('WA-20260822-001')).toEqual({
      ok: true,
      value: 'WA-20260822-001',
    });
    expect(validateImportOrderNumber('WA-طلب-88435').ok).toBe(false);
    expect(validateImportOrderNumber('WA-88435&^%').ok).toBe(false);
  });

  it('strips leading zeros from digit groups only', () => {
    expect(stripLeadingZeros('9')).toBe('9');
    expect(stripLeadingZeros('09')).toBe('9');
    expect(stripLeadingZeros('009')).toBe('9');
    expect(stripLeadingZeros('0009')).toBe('9');
    expect(stripLeadingZeros('10')).toBe('10');
    expect(stripLeadingZeros('100')).toBe('100');
    expect(stripLeadingZeros('2026')).toBe('2026');
    expect(stripLeadingZeros('0000')).toBe('0');
  });

  it('parses only M/DD/YYYY ship dates', () => {
    expect(parseImportShipDateMdY('9/01/2026')).toEqual({ ok: true, ymd: '2026-09-01' });
    expect(parseImportShipDateMdY('12/31/2026')).toEqual({ ok: true, ymd: '2026-12-31' });
    expect(parseImportShipDateMdY('2026-09-01').ok).toBe(false);
    expect(parseImportShipDateMdY('01-09-2026').ok).toBe(false);
  });

  it('accepts leading zeros on month/day/year after normalization', () => {
    expect(parseImportShipDateMdY('9/29/2026')).toEqual({ ok: true, ymd: '2026-09-29' });
    expect(parseImportShipDateMdY('09/29/2026')).toEqual({ ok: true, ymd: '2026-09-29' });
    expect(parseImportShipDateMdY('009/29/2026')).toEqual({ ok: true, ymd: '2026-09-29' });
    expect(parseImportShipDateMdY('9/01/2026')).toEqual({ ok: true, ymd: '2026-09-01' });
    expect(parseImportShipDateMdY('09/01/2026')).toEqual({ ok: true, ymd: '2026-09-01' });
    expect(parseImportShipDateMdY('009/001/2026')).toEqual({ ok: true, ymd: '2026-09-01' });
    expect(parseImportShipDateMdY('0009/0029/00002026')).toEqual({
      ok: true,
      ymd: '2026-09-29',
    });
  });

  it('keeps multi-digit months and rejects non-MDY order', () => {
    expect(parseImportShipDateMdY('10/29/2026')).toEqual({ ok: true, ymd: '2026-10-29' });
    expect(parseImportShipDateMdY('11/29/2026')).toEqual({ ok: true, ymd: '2026-11-29' });
    expect(parseImportShipDateMdY('12/29/2026')).toEqual({ ok: true, ymd: '2026-12-29' });
    expect(parseImportShipDateMdY('29/10/2026').ok).toBe(false);
    expect(parseImportShipDateMdY('0000/00/0000').ok).toBe(false);
    expect(parseImportShipDateMdY('٠١/٠٩/٢٠٢٦').ok).toBe(false);
  });

  it('parses leading-zero dates through spreadsheet CSV import path', () => {
    const csv = [
      'order_number,required_ship_date',
      '2590,09/29/2026',
    ].join('\n');
    const table = parseSpreadsheetTable(Buffer.from(csv, 'utf8'), 'orders.csv');
    expect(table[1]?.[1]).toBe('09/29/2026');
    expect(parseImportShipDateMdY(table[1]![1]!)).toEqual({
      ok: true,
      ymd: '2026-09-29',
    });
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
