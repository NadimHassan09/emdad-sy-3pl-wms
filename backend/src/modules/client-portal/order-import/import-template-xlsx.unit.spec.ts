import ExcelJS from 'exceljs';

import {
  buildInboundImportTemplateXlsx,
  buildOmsImportTemplateXlsx,
  buildOutboundImportTemplateXlsx,
  excelColumnLetter,
} from './import-template-xlsx';
import { parseSpreadsheetTable } from './spreadsheet.parse';
import { OMS_CLIENT_IMPORT_HEADERS } from './oms-client-import.schema';
import {
  validateImportCountryCode,
  validateImportRecipientPhone,
} from './oms-client-import.validation';

describe('excelColumnLetter', () => {
  it('maps 1-based indexes to Excel letters', () => {
    expect(excelColumnLetter(1)).toBe('A');
    expect(excelColumnLetter(26)).toBe('Z');
    expect(excelColumnLetter(27)).toBe('AA');
    expect(excelColumnLetter(4)).toBe('D');
  });
});

describe('OMS import template xlsx', () => {
  it('builds a workbook with Orders, Instructions, Lists, Areas and dropdowns', async () => {
    const { filename, buffer, meta } = await buildOmsImportTemplateXlsx();
    expect(filename).toBe('oms-orders-import-template.xlsx');
    expect(buffer.byteLength).toBeGreaterThan(10_000);
    expect(meta.governorateCount).toBe(14);
    expect(meta.cityCount).toBeGreaterThan(100);
    expect(meta.areaCount).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(workbook.getWorksheet('Orders')).toBeTruthy();
    expect(workbook.getWorksheet('Instructions')).toBeTruthy();
    expect(workbook.getWorksheet('Lists')).toBeTruthy();
    expect(workbook.getWorksheet('Areas')).toBeTruthy();

    const orders = workbook.getWorksheet('Orders')!;
    const headers = (orders.getRow(1).values as unknown[]).slice(1).map(String);
    for (const h of OMS_CLIENT_IMPORT_HEADERS) {
      expect(headers).toContain(h);
    }
    expect(headers).not.toContain('currency');

    // Parsed import table should read Orders (not Instructions)
    const table = parseSpreadsheetTable(buffer, 'oms-orders-import-template.xlsx');
    expect(table[0]?.[0]).toBe('order_number');
    expect(table.some((r) => r[0] === 'WA-20260901-001')).toBe(true);
  }, 60_000);

  it('builds inbound and outbound xlsx templates with Instructions', async () => {
    const inbound = await buildInboundImportTemplateXlsx();
    const outbound = await buildOutboundImportTemplateXlsx();
    expect(inbound.filename).toContain('inbound');
    expect(outbound.filename).toContain('outbound');

    const wbIn = new ExcelJS.Workbook();
    await wbIn.xlsx.load(inbound.buffer as unknown as ArrayBuffer);
    expect(wbIn.getWorksheet('Orders')).toBeTruthy();
    expect(wbIn.getWorksheet('Instructions')).toBeTruthy();

    const wbOut = new ExcelJS.Workbook();
    await wbOut.xlsx.load(outbound.buffer as unknown as ArrayBuffer);
    expect(wbOut.getWorksheet('Orders')).toBeTruthy();
    expect(wbOut.getWorksheet('Instructions')).toBeTruthy();
  }, 30_000);
});

describe('tolerant phone / country import', () => {
  it('accepts +963 country and local 09 / international phone forms', () => {
    const country = validateImportCountryCode('+963');
    expect(country.ok).toBe(true);
    if (!country.ok) return;

    expect(validateImportRecipientPhone('944000001', country.iso).ok).toBe(true);
    expect(validateImportRecipientPhone('0944000001', country.iso).ok).toBe(true);
    expect(validateImportRecipientPhone('+963944000001', country.iso).ok).toBe(true);
    expect(validateImportRecipientPhone('944 000 001', country.iso).ok).toBe(true);
  });
});
