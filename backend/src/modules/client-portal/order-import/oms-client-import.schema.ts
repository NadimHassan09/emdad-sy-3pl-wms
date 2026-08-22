import { rowsToCsv } from '../../oms/oms-orders-csv.util';
import type { HeaderAliasMap } from './order-import.grouping';

export const OMS_CLIENT_IMPORT_HEADERS = [
  'order_number',
  'required_ship_date',
  'recipient_name',
  'recipient_phone',
  'governorate',
  'city',
  'neighborhood',
  'street',
  'payment_method',
  'currency',
  'notes',
  'sku',
  'quantity',
  'unit_price',
] as const;

export const OMS_CLIENT_IMPORT_ALIASES: HeaderAliasMap = {
  order_number: ['external_reference', 'order_no', 'order number', 'external_order_id'],
  required_ship_date: ['ship_date', 'required ship date'],
  recipient_name: ['customer', 'customer_name', 'recipient'],
  recipient_phone: ['phone', 'customer_phone'],
  governorate: ['gov'],
  city: ['area', 'city_area'],
  district: [],
  neighborhood: ['address_line1', 'address line 1', 'town'],
  street: ['address_line2', 'address line 2', 'detailed_address', 'address'],
  payment_method: ['payment'],
  currency: [],
  notes: ['note'],
  store_channel: ['channel'],
  sku: ['product_sku', 'product sku'],
  quantity: ['qty', 'requested_quantity'],
  unit_price: ['price', 'unit price'],
};

export const OMS_ORDER_LEVEL_FIELDS = [
  'required_ship_date',
  'recipient_name',
  'recipient_phone',
  'governorate',
  'city',
  'district',
  'neighborhood',
  'street',
  'payment_method',
  'currency',
  'notes',
  'store_channel',
] as const;

export const OMS_CLIENT_IMPORT_REQUIRED_COLUMNS = ['order_number', 'sku', 'quantity'];

export const OMS_INCOMPLETE_DESTINATION = 'Shipping/Delivery information is incomplete.';

export function getOmsClientImportTemplate(): { filename: string; body: string } {
  const headers = [...OMS_CLIENT_IMPORT_HEADERS];
  const body = rowsToCsv(headers, [
    [
      'ORDER-1001',
      '2026-09-01',
      'Ahmed',
      '+963944000001',
      'حلب',
      'أتارب',
      'أرناز',
      'Street 1',
      'COD',
      'USD',
      '',
      'SKU-A',
      '2',
      '10',
    ],
    ['ORDER-1001', '', '', '', '', '', '', '', '', '', '', 'SKU-B', '3', ''],
    [
      'ORDER-1002',
      '2026-09-02',
      'Sara',
      '+963944000002',
      'حلب',
      'أتارب',
      '',
      '',
      'PREPAID',
      'USD',
      '',
      'SKU-A',
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
