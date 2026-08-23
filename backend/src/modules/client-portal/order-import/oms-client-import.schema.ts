import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import type { HeaderAliasMap } from './order-import.grouping';

/**
 * Client Portal OMS import columns.
 * `product_name` is documentation-only (ignored by the importer).
 * Currency is fixed to USD — not accepted as a CSV column.
 */
export const OMS_CLIENT_IMPORT_HEADERS = [
  'order_number',
  'required_ship_date',
  'recipient_name',
  'country_code',
  'recipient_phone',
  'governorate',
  'city',
  'neighborhood',
  'street',
  'payment_method',
  'notes',
  'sku',
  'product_name',
  'quantity',
  'unit_price',
] as const;

export const OMS_CLIENT_IMPORT_ALIASES: HeaderAliasMap = {
  order_number: ['external_reference', 'order_no', 'order number', 'external_order_id'],
  required_ship_date: ['ship_date', 'required ship date'],
  recipient_name: ['customer', 'customer_name', 'recipient'],
  country_code: ['phone_country', 'dial_code', 'country code', 'phone_country_code'],
  recipient_phone: ['phone', 'customer_phone', 'national_phone'],
  governorate: ['gov'],
  city: ['area', 'city_area'],
  district: [],
  neighborhood: ['address_line1', 'address line 1', 'town'],
  street: ['address_line2', 'address line 2', 'detailed_address', 'address'],
  payment_method: ['payment'],
  notes: ['note'],
  store_channel: ['channel'],
  sku: ['product_sku', 'product sku'],
  product_name: ['product', 'item_name', 'product name'],
  quantity: ['qty', 'requested_quantity'],
  unit_price: ['price', 'unit price'],
};

export const OMS_ORDER_LEVEL_FIELDS = [
  'required_ship_date',
  'recipient_name',
  'country_code',
  'recipient_phone',
  'governorate',
  'city',
  'district',
  'neighborhood',
  'street',
  'payment_method',
  'notes',
  'store_channel',
] as const;

/** Every import file must include these columns (product_name is optional). */
export const OMS_CLIENT_IMPORT_REQUIRED_COLUMNS = [
  'order_number',
  'required_ship_date',
  'recipient_name',
  'country_code',
  'recipient_phone',
  'governorate',
  'city',
  'neighborhood',
  'payment_method',
  'sku',
  'quantity',
  'unit_price',
];

export function getOmsClientImportTemplate(): { filename: string; body: string } {
  const headers = [...OMS_CLIENT_IMPORT_HEADERS];
  const body = rowsToCsv(headers, [
    [
      'WA-20260901-001',
      '9/01/2026',
      'Ahmed Ali',
      '963',
      '944000001',
      'حلب',
      'أتارب',
      'أرناز',
      'Street 1',
      'COD',
      '',
      'SKU-A',
      'Sample product A',
      '2',
      '10',
    ],
    [
      'WA-20260901-001',
      '9/01/2026',
      'Ahmed Ali',
      '963',
      '944000001',
      'حلب',
      'أتارب',
      'أرناز',
      'Street 1',
      'COD',
      '',
      'SKU-B',
      'Sample product B',
      '3',
      '15',
    ],
    [
      'WA-20260902-002',
      '9/02/2026',
      'Sara Hassan',
      '963',
      '944000002',
      'حلب',
      'أتارب',
      'أرناز',
      '',
      'Prepaid',
      '',
      'SKU-A',
      'Sample product A',
      '1',
      '10',
    ],
  ]);
  return { filename: 'oms-orders-import-template.csv', body };
}

/** Admin CSV used city=governorate and district=city/area. */
export function applyAdminCityCompatibility(values: Record<string, string>): void {
  if (!values.governorate?.trim() && values.city?.trim() && values.district?.trim()) {
    values.governorate = values.city;
    values.city = values.district;
  }
}
