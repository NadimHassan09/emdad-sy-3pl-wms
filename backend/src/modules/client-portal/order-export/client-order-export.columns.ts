/**
 * Client Portal — exportable columns (must match what the client can see in UI).
 */

export type ClientExportColumnDef = {
  id: string;
  labelEn: string;
  labelAr: string;
};

export const CLIENT_OMS_EXPORT_COLUMNS: ClientExportColumnDef[] = [
  { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
  { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  { id: 'external_order_id', labelEn: 'External order ID', labelAr: 'الرقم المرجعي' },
  { id: 'recipient_name', labelEn: 'Recipient', labelAr: 'المستلم' },
  { id: 'recipient_phone', labelEn: 'Phone', labelAr: 'الهاتف' },
  { id: 'city', labelEn: 'City', labelAr: 'المدينة' },
  { id: 'district', labelEn: 'District', labelAr: 'المنطقة' },
  { id: 'address', labelEn: 'Address', labelAr: 'العنوان' },
  { id: 'required_ship_date', labelEn: 'Required ship date', labelAr: 'تاريخ الشحن المطلوب' },
  { id: 'total', labelEn: 'Total', labelAr: 'الإجمالي' },
  { id: 'product_name', labelEn: 'Product name', labelAr: 'اسم المنتج' },
  { id: 'product_weight', labelEn: 'Product weight (kg)', labelAr: 'وزن المنتج (كغ)' },
  { id: 'currency', labelEn: 'Currency', labelAr: 'العملة' },
  { id: 'payment_method', labelEn: 'Payment method', labelAr: 'طريقة الدفع' },
  { id: 'carrier', labelEn: 'Carrier', labelAr: 'شركة الشحن' },
  { id: 'tracking_number', labelEn: 'Tracking number', labelAr: 'رقم التتبع' },
  { id: 'warehouse_status', labelEn: 'Warehouse status', labelAr: 'حالة المستودع' },
  { id: 'incomplete', labelEn: 'Incomplete', labelAr: 'غير مكتمل' },
  { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
  { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
];

export const CLIENT_INBOUND_EXPORT_COLUMNS: ClientExportColumnDef[] = [
  { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
  { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  { id: 'external_order_id', labelEn: 'External order ID', labelAr: 'الرقم المرجعي' },
  { id: 'expected_arrival_date', labelEn: 'Expected arrival', labelAr: 'الوصول المتوقع' },
  { id: 'lines', labelEn: 'Lines', labelAr: 'البنود' },
  { id: 'product_name', labelEn: 'Product name', labelAr: 'اسم المنتج' },
  { id: 'product_weight', labelEn: 'Product weight (kg)', labelAr: 'وزن المنتج (كغ)' },
  { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
  { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
  { id: 'confirmed_at', labelEn: 'Confirmed', labelAr: 'تاريخ التأكيد' },
  { id: 'completed_at', labelEn: 'Completed', labelAr: 'تاريخ الإكمال' },
];

export const CLIENT_OUTBOUND_EXPORT_COLUMNS: ClientExportColumnDef[] = [
  { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
  { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  { id: 'external_order_id', labelEn: 'External order ID', labelAr: 'الرقم المرجعي' },
  { id: 'destination', labelEn: 'Destination', labelAr: 'الوجهة' },
  { id: 'recipient_name', labelEn: 'Recipient', labelAr: 'المستلم' },
  { id: 'required_ship_date', labelEn: 'Required ship date', labelAr: 'تاريخ الشحن المطلوب' },
  { id: 'carrier', labelEn: 'Carrier', labelAr: 'شركة الشحن' },
  { id: 'tracking_number', labelEn: 'Tracking number', labelAr: 'رقم التتبع' },
  { id: 'lines', labelEn: 'Lines', labelAr: 'البنود' },
  { id: 'product_name', labelEn: 'Product name', labelAr: 'اسم المنتج' },
  { id: 'product_weight', labelEn: 'Product weight (kg)', labelAr: 'وزن المنتج (كغ)' },
  { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
  { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
  { id: 'confirmed_at', labelEn: 'Confirmed', labelAr: 'تاريخ التأكيد' },
  { id: 'shipped_at', labelEn: 'Shipped', labelAr: 'تاريخ الشحن' },
];

export function headerLabels(
  columns: ClientExportColumnDef[],
  columnIds: string[],
  arabic: boolean,
): string[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  return columnIds
    .map((id) => byId.get(id))
    .filter((c): c is ClientExportColumnDef => !!c)
    .map((c) => (arabic ? c.labelAr : c.labelEn));
}

export function orderedColumnIds(
  columns: ClientExportColumnDef[],
  columnIds: string[],
): string[] {
  const allowed = new Set(columns.map((c) => c.id));
  return columnIds.filter((id) => allowed.has(id));
}
