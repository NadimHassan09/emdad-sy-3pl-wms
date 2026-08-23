/**
 * Admin OMS/Inbound/Outbound export column defs (En/Ar labels for the column picker).
 */

export type AdminExportColumnDef = {
  id: string;
  labelEn: string;
  labelAr: string;
};

export const ADMIN_OMS_EXPORT_COLUMNS: AdminExportColumnDef[] = [
  { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
  { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  { id: 'company_id', labelEn: 'Company ID', labelAr: 'معرف الشركة' },
  { id: 'company_name', labelEn: 'Company', labelAr: 'الشركة' },
  { id: 'external_reference', labelEn: 'External reference', labelAr: 'المرجع الخارجي' },
  { id: 'client_reference', labelEn: 'Client reference', labelAr: 'مرجع العميل' },
  { id: 'recipient_name', labelEn: 'Recipient', labelAr: 'المستلم' },
  { id: 'recipient_phone', labelEn: 'Phone', labelAr: 'الهاتف' },
  { id: 'city', labelEn: 'City', labelAr: 'المدينة' },
  { id: 'district', labelEn: 'District', labelAr: 'المنطقة' },
  { id: 'address_line1', labelEn: 'Address', labelAr: 'العنوان' },
  { id: 'store_channel', labelEn: 'Store channel', labelAr: 'قناة المتجر' },
  { id: 'payment_method', labelEn: 'Payment method', labelAr: 'طريقة الدفع' },
  { id: 'cod_status', labelEn: 'COD status', labelAr: 'حالة COD' },
  { id: 'cod_amount', labelEn: 'COD amount', labelAr: 'مبلغ COD' },
  { id: 'currency', labelEn: 'Currency', labelAr: 'العملة' },
  { id: 'subtotal', labelEn: 'Subtotal', labelAr: 'المجموع الفرعي' },
  { id: 'shipping_fee', labelEn: 'Shipping fee', labelAr: 'رسوم الشحن' },
  { id: 'total', labelEn: 'Total', labelAr: 'الإجمالي' },
  { id: 'line_count', labelEn: 'Line count', labelAr: 'عدد البنود' },
  { id: 'total_quantity', labelEn: 'Total quantity', labelAr: 'إجمالي الكمية' },
  { id: 'shipping_method', labelEn: 'Shipping method', labelAr: 'طريقة الشحن' },
  { id: 'shipping_provider_code', labelEn: 'Shipping provider', labelAr: 'مزود الشحن' },
  { id: 'carrier', labelEn: 'Carrier', labelAr: 'شركة الشحن' },
  { id: 'outbound_order_number', labelEn: 'Outbound order #', labelAr: 'رقم الصادر' },
  { id: 'required_ship_date', labelEn: 'Required ship date', labelAr: 'تاريخ الشحن المطلوب' },
  { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
  { id: 'confirmed_at', labelEn: 'Confirmed', labelAr: 'تاريخ التأكيد' },
  { id: 'approved_at', labelEn: 'Approved', labelAr: 'تاريخ الموافقة' },
  { id: 'out_for_delivery_at', labelEn: 'Out for delivery', labelAr: 'خارج للتسليم' },
  { id: 'delivered_at', labelEn: 'Delivered', labelAr: 'تاريخ التسليم' },
];

export const ADMIN_INBOUND_EXPORT_COLUMNS: AdminExportColumnDef[] = [
  { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
  { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  { id: 'company_id', labelEn: 'Company ID', labelAr: 'معرف الشركة' },
  { id: 'company_name', labelEn: 'Company', labelAr: 'الشركة' },
  { id: 'external_reference', labelEn: 'External reference', labelAr: 'المرجع الخارجي' },
  { id: 'client_reference', labelEn: 'Client reference', labelAr: 'مرجع العميل' },
  { id: 'expected_arrival_date', labelEn: 'Expected arrival', labelAr: 'الوصول المتوقع' },
  { id: 'source_type', labelEn: 'Source type', labelAr: 'نوع المصدر' },
  { id: 'store_channel', labelEn: 'Store channel', labelAr: 'قناة المتجر' },
  { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
  { id: 'line_count', labelEn: 'Line count', labelAr: 'عدد البنود' },
  { id: 'total_expected_quantity', labelEn: 'Total expected qty', labelAr: 'إجمالي الكمية المتوقعة' },
  { id: 'execution_mode', labelEn: 'Execution mode', labelAr: 'وضع التنفيذ' },
  { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
  { id: 'confirmed_at', labelEn: 'Confirmed', labelAr: 'تاريخ التأكيد' },
  { id: 'completed_at', labelEn: 'Completed', labelAr: 'تاريخ الإكمال' },
];

export const ADMIN_OUTBOUND_EXPORT_COLUMNS: AdminExportColumnDef[] = [
  { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
  { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  { id: 'company_id', labelEn: 'Company ID', labelAr: 'معرف الشركة' },
  { id: 'company_name', labelEn: 'Company', labelAr: 'الشركة' },
  { id: 'external_reference', labelEn: 'External reference', labelAr: 'المرجع الخارجي' },
  { id: 'client_reference', labelEn: 'Client reference', labelAr: 'مرجع العميل' },
  { id: 'destination_address', labelEn: 'Destination', labelAr: 'الوجهة' },
  { id: 'required_ship_date', labelEn: 'Required ship date', labelAr: 'تاريخ الشحن المطلوب' },
  { id: 'carrier', labelEn: 'Carrier', labelAr: 'شركة الشحن' },
  { id: 'tracking_number', labelEn: 'Tracking number', labelAr: 'رقم التتبع' },
  { id: 'requires_packing', labelEn: 'Requires packing', labelAr: 'يتطلب تغليف' },
  { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
  { id: 'line_count', labelEn: 'Line count', labelAr: 'عدد البنود' },
  { id: 'total_requested_quantity', labelEn: 'Total requested qty', labelAr: 'إجمالي الكمية المطلوبة' },
  { id: 'shipping_method', labelEn: 'Shipping method', labelAr: 'طريقة الشحن' },
  { id: 'execution_mode', labelEn: 'Execution mode', labelAr: 'وضع التنفيذ' },
  { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
  { id: 'confirmed_at', labelEn: 'Confirmed', labelAr: 'تاريخ التأكيد' },
  { id: 'shipped_at', labelEn: 'Shipped', labelAr: 'تاريخ الشحن' },
];

export function adminHeaderLabels(
  columns: AdminExportColumnDef[],
  columnIds: string[],
  arabic: boolean,
): string[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  return columnIds
    .map((id) => byId.get(id))
    .filter((c): c is AdminExportColumnDef => !!c)
    .map((c) => (arabic ? c.labelAr : c.labelEn));
}

export function adminOrderedColumnIds(
  columns: AdminExportColumnDef[],
  columnIds?: string[],
): string[] {
  if (!columnIds?.length) return columns.map((c) => c.id);
  const allowed = new Set(columns.map((c) => c.id));
  return columnIds.filter((id) => allowed.has(id));
}
