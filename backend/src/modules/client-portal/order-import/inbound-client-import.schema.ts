import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import type { HeaderAliasMap } from './order-import.grouping';

/**
 * Client Portal inbound import columns (matches creation flow).
 * `product_name` is documentation-only (ignored when resolving the product).
 * `order_number` is the customer reference used to group rows — not the WMS order id.
 */
export const INBOUND_CLIENT_IMPORT_HEADERS = [
  'order_number',
  'expected_arrival_date',
  'notes',
  'product_name',
  'sku',
  'quantity',
] as const;

export const INBOUND_CLIENT_IMPORT_ALIASES: HeaderAliasMap = {
  order_number: ['external_reference', 'order_no', 'order number', 'client_reference'],
  expected_arrival_date: ['arrival_date', 'expected arrival date'],
  notes: ['note'],
  product_name: ['product', 'item_name', 'product name'],
  sku: ['product_sku', 'product sku'],
  quantity: ['expected_quantity', 'qty', 'requested_quantity'],
};

export const INBOUND_ORDER_LEVEL_FIELDS = ['expected_arrival_date', 'notes'] as const;

export const INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS = [
  'order_number',
  'expected_arrival_date',
  'sku',
  'quantity',
];

export function getInboundClientImportTemplate(): { filename: string; body: string } {
  const body = rowsToCsv([...INBOUND_CLIENT_IMPORT_HEADERS], [
    ['INB-1001', '9/01/2026', '', 'Sample product A', 'SKU-A', '10'],
    ['INB-1001', '9/01/2026', '', 'Sample product B', 'SKU-B', '5'],
    ['INB-1002', '9/02/2026', 'PO-88', 'Sample product A', 'SKU-A', '3'],
  ]);
  return { filename: 'inbound-orders-import-template.csv', body };
}
