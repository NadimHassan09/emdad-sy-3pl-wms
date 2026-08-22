import { parseCsv, rowsToCsv } from '../../oms/oms-orders-csv.util';
import {
  assertImportTable,
  groupRowsByOrderNumber,
  mapHeaderRow,
  normalizeCompare,
} from './order-import.grouping';
import { OMS_CLIENT_IMPORT_ALIASES, OMS_ORDER_LEVEL_FIELDS } from './oms-client-import.schema';
import { parseFlexibleDate } from './spreadsheet.parse';

describe('order-import grouping', () => {
  const required = ['order_number', 'sku', 'quantity'];

  function groupsFromCsv(csv: string) {
    const table = parseCsv(csv);
    const { dataRows } = assertImportTable(table, OMS_CLIENT_IMPORT_ALIASES, required);
    return groupRowsByOrderNumber(dataRows, 'order_number', OMS_ORDER_LEVEL_FIELDS);
  }

  it('maps friendly headers including Order Number aliases', () => {
    const { indexByField } = mapHeaderRow(
      ['Order Number', 'Product SKU', 'Quantity', 'Customer'],
      OMS_CLIENT_IMPORT_ALIASES,
    );
    expect(indexByField.order_number).toBe(0);
    expect(indexByField.sku).toBe(1);
    expect(indexByField.quantity).toBe(2);
    expect(indexByField.recipient_name).toBe(3);
  });

  it('groups one order with one product', () => {
    const csv = rowsToCsv(
      ['order_number', 'sku', 'quantity', 'recipient_name'],
      [['ORDER-1', 'SKU-A', '2', 'Ahmed']],
    );
    const groups = groupsFromCsv(csv);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.orderNumber).toBe('ORDER-1');
    expect(groups[0]!.lines).toHaveLength(1);
    expect(groups[0]!.fields.recipient_name).toBe('Ahmed');
  });

  it('groups one order with three products', () => {
    const csv = rowsToCsv(
      ['order_number', 'sku', 'quantity', 'recipient_name'],
      [
        ['ORDER-1001', 'SKU-A', '2', 'Ahmed'],
        ['ORDER-1001', 'SKU-B', '3', ''],
        ['ORDER-1001', 'SKU-C', '1', ''],
      ],
    );
    const groups = groupsFromCsv(csv);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.lines.map((l) => l.values.sku)).toEqual(['SKU-A', 'SKU-B', 'SKU-C']);
    expect(groups[0]!.fields.recipient_name).toBe('Ahmed');
  });

  it('detects ten orders in one file', () => {
    const rows = Array.from({ length: 10 }, (_, i) => [
      `ORDER-${i + 1}`,
      'SKU-A',
      '1',
      `Customer ${i + 1}`,
    ]);
    const csv = rowsToCsv(['order_number', 'sku', 'quantity', 'recipient_name'], rows);
    expect(groupsFromCsv(csv)).toHaveLength(10);
  });

  it('inherits blank order-level fields from the first populated row', () => {
    const csv = rowsToCsv(
      ['order_number', 'sku', 'quantity', 'recipient_name', 'city', 'governorate'],
      [
        ['ORDER-1001', 'SKU-A', '2', 'Ahmed', 'أتارب', 'حلب'],
        ['ORDER-1001', 'SKU-B', '3', '', '', ''],
        ['ORDER-1001', 'SKU-C', '1', '', '', ''],
      ],
    );
    const g = groupsFromCsv(csv)[0]!;
    expect(g.fields.recipient_name).toBe('Ahmed');
    expect(g.fields.city).toBe('أتارب');
    expect(g.fields.governorate).toBe('حلب');
    expect(g.conflict).toBeUndefined();
  });

  it('rejects conflicting order-level fields instead of picking one', () => {
    const csv = rowsToCsv(
      ['order_number', 'sku', 'quantity', 'city'],
      [
        ['ORDER-1001', 'SKU-A', '2', 'Damascus'],
        ['ORDER-1001', 'SKU-B', '3', 'Aleppo'],
      ],
    );
    const g = groupsFromCsv(csv)[0]!;
    expect(g.conflict?.field).toBe('city');
    expect(g.conflict?.error).toMatch(/Conflicting city/);
  });

  it('treats case-insensitive equal values as consistent', () => {
    expect(normalizeCompare('  Damascus ')).toBe(normalizeCompare('damascus'));
    const csv = rowsToCsv(
      ['order_number', 'sku', 'quantity', 'recipient_name'],
      [
        ['ORDER-1001', 'SKU-A', '1', 'Ahmed'],
        ['ORDER-1001', 'SKU-B', '1', 'ahmed'],
      ],
    );
    expect(groupsFromCsv(csv)[0]!.conflict).toBeUndefined();
  });
});

describe('parseFlexibleDate', () => {
  it('parses ISO and DMY dates', () => {
    expect(parseFlexibleDate('2026-09-01')).toBe('2026-09-01');
    expect(parseFlexibleDate('1/9/2026')).toBe('2026-09-01');
  });
});
