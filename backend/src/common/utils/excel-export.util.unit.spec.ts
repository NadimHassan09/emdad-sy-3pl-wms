import ExcelJS from 'exceljs';
import { buildExcelBuffer, sanitizeExcelText } from './excel-export.util';

describe('excel-export.util', () => {
  describe('sanitizeExcelText', () => {
    it('prepends an apostrophe if text starts with formula triggers', () => {
      expect(sanitizeExcelText('=1+2')).toBe("'=1+2");
      expect(sanitizeExcelText('+SUM(A1:A10)')).toBe("'+SUM(A1:A10)");
      expect(sanitizeExcelText('-10')).toBe("'-10");
      expect(sanitizeExcelText('@danger')).toBe("'@danger");
      expect(sanitizeExcelText('\tindent')).toBe("'\tindent");
    });

    it('leaves safe text unchanged', () => {
      expect(sanitizeExcelText('Normal Text')).toBe('Normal Text');
      expect(sanitizeExcelText('12345')).toBe('12345');
      expect(sanitizeExcelText('')).toBe('');
      expect(sanitizeExcelText(null)).toBe('');
    });
  });

  describe('buildExcelBuffer', () => {
    it('creates a valid Excel workbook buffer with rows and columns', async () => {
      const buffer = await buildExcelBuffer({
        sheetName: 'Orders',
        columns: [
          { header: 'Order #', key: 'orderNumber' },
          { header: 'Recipient', key: 'recipient' },
          { header: 'Total', key: 'total' },
        ],
        rows: [
          { orderNumber: 'ORD-001', recipient: 'John Doe', total: 150 },
          { orderNumber: 'ORD-002', recipient: '=HYPERLINK("bad")', total: 200 },
        ],
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.getWorksheet('Orders');
      expect(sheet).toBeDefined();
      // 2 branding rows (logo + meta) + 1 gap row + 1 header row + 2 data rows = 6
      expect(sheet?.rowCount).toBe(6);

      const row5 = sheet?.getRow(5);
      expect(row5?.getCell(1).value).toBe('ORD-001');
      expect(row5?.getCell(2).value).toBe('John Doe');
      expect(row5?.getCell(3).value).toBe(150);

      const row6 = sheet?.getRow(6);
      // Sanitized formula
      expect(row6?.getCell(2).value).toBe('\'=HYPERLINK("bad")');
    });
  });
});
