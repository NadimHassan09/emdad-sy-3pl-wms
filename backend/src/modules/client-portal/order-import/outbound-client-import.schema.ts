import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import type { HeaderAliasMap } from './order-import.grouping';

export const OUTBOUND_CLIENT_IMPORT_HEADERS = [
  'order_number',
  'required_ship_date',
  'destination_address',
  'notes',
  'sku',
  'requested_quantity',
] as const;

export const OUTBOUND_CLIENT_IMPORT_ALIASES: HeaderAliasMap = {
  order_number: ['external_reference', 'order_no', 'order number'],
  required_ship_date: ['ship_date', 'required ship date'],
  destination_address: ['destination', 'address'],
  notes: ['note'],
  sku: ['product_sku', 'product sku'],
  requested_quantity: ['quantity', 'qty'],
};

export const OUTBOUND_ORDER_LEVEL_FIELDS = [
  'required_ship_date',
  'destination_address',
  'notes',
] as const;

export const OUTBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS = [
  'order_number',
  'sku',
  'requested_quantity',
];

export function getOutboundClientImportTemplate(): { filename: string; body: string } {
  const body = rowsToCsv([...OUTBOUND_CLIENT_IMPORT_HEADERS], [
    ['OUT-1001', '2026-09-01', 'Damascus warehouse dock A', '', 'SKU-A', '2'],
    ['OUT-1001', '', '', '', 'SKU-B', '3'],
    ['OUT-1002', '2026-09-02', 'Aleppo store 12', '', 'SKU-A', '1'],
  ]);
  return { filename: 'outbound-orders-import-template.csv', body };
}
