import { Prisma } from '@prisma/client';

import { buildBatchInstructionDocument } from './oms-batch-instruction';
import { renderBatchInstructionHtml } from './oms-batch-instruction-sheet';
import { renderInstructionSheetsHtml } from './oms-instruction-sheet';

const same = (sku: string, name: string, locationName: string, locationCode: string) => ({
  productId: sku,
  sku,
  name,
  locationName,
  locationCode,
});

describe('batch instruction document', () => {
  const doc = buildBatchInstructionDocument({
    batchNumber: 'BATCH-1025',
    batchName: 'Morning',
    createdAtLabel: '20 Sep 2026',
    createdByName: 'Nadim Hassan',
    orders: [
      {
        orderNumber: 'OMS-1',
        customerName: 'Acme',
        itemCount: '3',
        note: '',
        includeOperations: true,
        packingLocation: { name: 'منطقة التعبئة', code: 'WH-001/PACK-001' },
        dispatchLocation: { name: 'منطقة الإرسال', code: 'WH-001/SHIP-001' },
        picks: [
          { ...same('SKU-A', 'Product A', 'رف A', 'WH-001/A/A-01'), quantity: '3' },
        ],
      },
      {
        orderNumber: 'OMS-2',
        customerName: 'Noor',
        itemCount: '8',
        note: 'مشكلة',
        includeOperations: true,
        packingLocation: { name: 'منطقة التعبئة', code: 'WH-001/PACK-001' },
        dispatchLocation: { name: 'منطقة الإرسال', code: 'WH-001/SHIP-001' },
        picks: [
          { ...same('SKU-A', 'Product A', 'رف A', 'WH-001/A/A-01'), quantity: '2' },
          { ...same('SKU-B', 'Product B', 'رف A', 'WH-001/A/A-01'), quantity: '6' },
        ],
      },
      {
        orderNumber: 'OMS-3',
        customerName: 'Retail',
        itemCount: '4',
        note: '',
        includeOperations: true,
        packingLocation: { name: 'منطقة التعبئة', code: 'WH-001/PACK-001' },
        dispatchLocation: { name: 'منطقة الإرسال', code: 'WH-001/SHIP-001' },
        picks: [{ ...same('SKU-A', 'Product A', 'رف A', 'WH-001/A/A-01'), quantity: '4' }],
      },
      {
        orderNumber: 'OMS-5',
        customerName: 'United',
        itemCount: '7',
        note: '',
        includeOperations: true,
        packingLocation: { name: 'تعبئة ثانية', code: 'WH-002/PACK-002' },
        dispatchLocation: { name: 'رصيف آخر', code: 'WH-002/SHIP-002' },
        picks: [
          { ...same('SKU-A', 'Product A', 'رف A', 'WH-001/A/A-01'), quantity: '1' },
          { ...same('SKU-A', 'Product A', 'رف B', 'WH-001/B/B-02'), quantity: '6' },
        ],
      },
      {
        orderNumber: 'OMS-9',
        customerName: 'Draft client',
        itemCount: '1',
        note: '',
        includeOperations: false,
        packingLocation: null,
        dispatchLocation: null,
        picks: [{ ...same('SKU-A', 'Product A', 'رف A', 'WH-001/A/A-01'), quantity: '99' }],
      },
    ],
  });

  it('aggregates one SKU across orders without merging different locations', () => {
    const placeA = doc.locations.find((location) => location.locationCode === 'WH-001/A/A-01');
    const placeB = doc.locations.find((location) => location.locationCode === 'WH-001/B/B-02');
    expect(placeA?.rows.find((row) => row.sku === 'SKU-A')?.quantity).toBe('10');
    expect(placeA?.rows.find((row) => row.sku === 'SKU-A')?.orderCount).toBe(4);
    expect(placeA?.rows.find((row) => row.sku === 'SKU-B')?.quantity).toBe('6');
    expect(placeB?.rows.find((row) => row.sku === 'SKU-A')?.quantity).toBe('6');
    expect(doc.unitTotal).toBe('22');
    expect(doc.uniqueSkuCount).toBe(2);
  });

  it('keeps the order split equal to the consolidated total and lists every order', () => {
    const productA = doc.allocations.find((row) => row.sku === 'SKU-A');
    expect(productA?.total).toBe('16');
    const splitSum = productA?.splits.reduce(
      (sum, split) => sum.plus(split.quantity),
      new Prisma.Decimal(0),
    );
    expect(splitSum?.toFixed()).toBe('16');
    expect(productA?.splits.map((split) => `${split.orderNumber}:${split.quantity}`)).toEqual([
      'OMS-1:3',
      'OMS-2:2',
      'OMS-3:4',
      'OMS-5:7',
    ]);
    expect(doc.checklist.map((row) => row.orderNumber)).toEqual(['OMS-1', 'OMS-2', 'OMS-3', 'OMS-5', 'OMS-9']);
    expect(doc.checklist.find((row) => row.orderNumber === 'OMS-9')?.itemCount).toBe('1');
    expect(doc.checklist.find((row) => row.orderNumber === 'OMS-2')?.note).toBe('مشكلة');
  });

  it('does not merge different packing or dispatch locations', () => {
    expect(doc.packingGroups).toHaveLength(2);
    expect(doc.dispatchGroups.map((group) => group.place.code).sort()).toEqual([
      'WH-001/SHIP-001',
      'WH-002/SHIP-002',
    ]);
    expect(doc.packingGroups.find((group) => group.place?.code === 'WH-002/PACK-002')?.orderNumbers).toEqual([
      'OMS-5',
    ]);
  });

  it('renders one batch sheet with allocation, a single packing instruction, and checklist boxes', () => {
    const html = renderBatchInstructionHtml(doc);
    expect(html).toContain('BATCH-1025');
    expect(html).toContain('Batch Operational Instructions');
    expect(html).toContain('رف A');
    expect(html).toContain('(WH-001/A/A-01)');
    expect(html).toContain('OMS-9');
    expect(html.match(/تعليمات التعبئة/g)?.length).toBe(1);
    expect(html).toContain('class="box"');
    expect(html).not.toContain('break-before: page');
    const single = renderInstructionSheetsHtml([
      {
        orderNumber: 'OMS-2026-00001',
        orderDate: '28 Jun 2026',
        clientName: 'Acme',
        operatorName: 'Nadim',
        packingLocation: { name: 'منطقة التعبئة', code: 'WH-001/PACK-001' },
        dispatchLocation: { name: 'منطقة الإرسال', code: 'WH-001/SHIP-001' },
        picks: [{ sku: 'SKU-1', name: 'منتج', quantity: '1', locationName: 'رف', locationCode: 'A-01' }],
      },
    ]);
    expect(single).toContain('تعليمات التنفيذ');
    expect(single).not.toContain('Batch Operational Instructions');
  });
});
