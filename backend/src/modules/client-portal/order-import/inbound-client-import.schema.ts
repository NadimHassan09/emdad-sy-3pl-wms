import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import type { HeaderAliasMap } from './order-import.grouping';

export const INBOUND_CLIENT_IMPORT_HEADERS = [
  'order_number',
  'expected_arrival_date',
  'notes',
  'source_type',
  'sku',
  'expected_quantity',
  'expected_lot_number',
  'expected_expiry_date',
] as const;

export const INBOUND_CLIENT_IMPORT_ALIASES: HeaderAliasMap = {
  order_number: ['external_reference', 'order_no', 'order number'],
  expected_arrival_date: ['arrival_date', 'expected arrival date'],
  notes: ['note'],
  source_type: ['source'],
  sku: ['product_sku', 'product sku'],
  expected_quantity: ['quantity', 'qty'],
  expected_lot_number: ['lot', 'lot_number'],
  expected_expiry_date: ['expiry', 'expiry_date'],
};

export const INBOUND_ORDER_LEVEL_FIELDS = [
  'expected_arrival_date',
  'notes',
  'source_type',
] as const;

export const INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS = [
  'order_number',
  'sku',
  'expected_quantity',
];

export function getInboundClientImportTemplate(): { filename: string; body: string } {
  const body = rowsToCsv([...INBOUND_CLIENT_IMPORT_HEADERS], [
    ['INB-1001', '2026-09-01', '', 'purchase', 'SKU-A', '10', '', ''],
    ['INB-1001', '', '', '', 'SKU-B', '5', '', ''],
    ['INB-1002', '2026-09-02', 'PO-88', 'purchase', 'SKU-A', '3', '', ''],
  ]);
  return { filename: 'inbound-orders-import-template.csv', body };
}
