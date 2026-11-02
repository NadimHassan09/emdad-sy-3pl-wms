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
      expect(sheet?.rowCount).toBe(3); // 1 header + 2 rows

      const row2 = sheet?.getRow(2);
      expect(row2?.getCell(1).value).toBe('ORD-001');
      expect(row2?.getCell(2).value).toBe('John Doe');
      expect(row2?.getCell(3).value).toBe(150);

      const row3 = sheet?.getRow(3);
      // Sanitized formula
      expect(row3?.getCell(2).value).toBe('\'=HYPERLINK("bad")');
    });
  });
});
