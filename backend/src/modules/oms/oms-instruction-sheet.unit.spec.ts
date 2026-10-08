import { inflateRawSync } from 'node:zlib';

import { compareOmsOrderNumbers, renderInstructionSheetsHtml, safeInstructionFilename } from './oms-instruction-sheet';
import { zipBuffers } from './zip-buffers';

describe('instruction sheet helpers', () => {
  it('sorts order numbers numerically', () => {
    const numbers = ['OMS-2026-100', 'OMS-2026-20', 'OMS-2025-9999', 'OMS-2026-3'];
    expect([...numbers].sort(compareOmsOrderNumbers)).toEqual([
      'OMS-2025-9999',
      'OMS-2026-3',
      'OMS-2026-20',
      'OMS-2026-100',
    ]);
  });

  it('starts each following order on a new page and lists pick slices', () => {
    const html = renderInstructionSheetsHtml([
      {
        orderNumber: 'OMS-2026-00001',
        orderDate: '28 Jun 2026',
        clientName: 'Acme Imports',
        operatorName: 'Nadim Hassan',
        packingLocation: { name: 'منطقة التعبئة الرئيسية', code: 'WH-001/PACK-001' },
        dispatchLocation: { name: 'منطقة الإرسال', code: 'WH-001/SHIP-001' },
        picks: [
          { sku: 'SKU-1', name: 'قميص', quantity: '5', locationName: 'منطقة الرفوف A', locationCode: 'WH-001/A/A-01' },
          { sku: 'SKU-1', name: 'قميص', quantity: '10', locationName: 'منطقة الرفوف B', locationCode: 'WH-001/A/A-02' },
        ],
      },
      {
        orderNumber: 'OMS-2026-00002',
        orderDate: '29 Jun 2026',
        clientName: 'C',
        operatorName: 'D',
        packingLocation: null,
        dispatchLocation: { name: 'DOCK-2', code: '' },
        picks: [],
      },
    ]);
    expect(html).toContain('OMS-2026-00001');
    expect(html).toContain('OMS-2026-00002');
    expect(html).toContain('منطقة الرفوف A');
    expect(html).toContain('(WH-001/A/A-01)');
    expect(html).toContain('(WH-001/A/A-02)');
    expect(html).toContain('غير مطلوب');
    expect(html).toContain('تعليمات التعبئة');
    expect(html).toContain('EMDAD Logistics');
    expect(html).toContain('حلول لوجستية أكثر كفاءة');
    expect(html).toContain('break-before: page');
  });

  it('builds a readable deflate zip', () => {
    const payload = Buffer.from('instruction-pdf');
    const zip = zipBuffers([{ name: `${safeInstructionFilename('OMS/2026 1')}.pdf`, data: payload }]);
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    const name = 'OMS-2026-1.pdf';
    const nameAt = zip.indexOf(name);
    expect(nameAt).toBeGreaterThan(0);
    const compressedSize = zip.readUInt32LE(18);
    const start = 30 + Buffer.byteLength(name) ;
    // local header name is the first occurrence
    const compressed = zip.subarray(nameAt + Buffer.byteLength(name), nameAt + Buffer.byteLength(name) + compressedSize);
    expect(inflateRawSync(compressed).toString()).toBe('instruction-pdf');
  });
});
