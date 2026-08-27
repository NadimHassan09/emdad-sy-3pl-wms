"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_OUTBOUND_EXPORT_COLUMNS = exports.CLIENT_INBOUND_EXPORT_COLUMNS = exports.CLIENT_OMS_EXPORT_COLUMNS = void 0;
exports.headerLabels = headerLabels;
exports.orderedColumnIds = orderedColumnIds;
exports.CLIENT_OMS_EXPORT_COLUMNS = [
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
    { id: 'currency', labelEn: 'Currency', labelAr: 'العملة' },
    { id: 'payment_method', labelEn: 'Payment method', labelAr: 'طريقة الدفع' },
    { id: 'carrier', labelEn: 'Carrier', labelAr: 'شركة الشحن' },
    { id: 'tracking_number', labelEn: 'Tracking number', labelAr: 'رقم التتبع' },
    { id: 'warehouse_status', labelEn: 'Warehouse status', labelAr: 'حالة المستودع' },
    { id: 'incomplete', labelEn: 'Incomplete', labelAr: 'غير مكتمل' },
    { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
    { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
];
exports.CLIENT_INBOUND_EXPORT_COLUMNS = [
    { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
    { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
    { id: 'external_order_id', labelEn: 'External order ID', labelAr: 'الرقم المرجعي' },
    { id: 'expected_arrival_date', labelEn: 'Expected arrival', labelAr: 'الوصول المتوقع' },
    { id: 'lines', labelEn: 'Lines', labelAr: 'البنود' },
    { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
    { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
    { id: 'confirmed_at', labelEn: 'Confirmed', labelAr: 'تاريخ التأكيد' },
    { id: 'completed_at', labelEn: 'Completed', labelAr: 'تاريخ الإكمال' },
];
exports.CLIENT_OUTBOUND_EXPORT_COLUMNS = [
    { id: 'order_number', labelEn: 'Order #', labelAr: 'رقم الطلب' },
    { id: 'status', labelEn: 'Status', labelAr: 'الحالة' },
    { id: 'external_order_id', labelEn: 'External order ID', labelAr: 'الرقم المرجعي' },
    { id: 'destination', labelEn: 'Destination', labelAr: 'الوجهة' },
    { id: 'recipient_name', labelEn: 'Recipient', labelAr: 'المستلم' },
    { id: 'required_ship_date', labelEn: 'Required ship date', labelAr: 'تاريخ الشحن المطلوب' },
    { id: 'carrier', labelEn: 'Carrier', labelAr: 'شركة الشحن' },
    { id: 'tracking_number', labelEn: 'Tracking number', labelAr: 'رقم التتبع' },
    { id: 'lines', labelEn: 'Lines', labelAr: 'البنود' },
    { id: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
    { id: 'created_at', labelEn: 'Created', labelAr: 'تاريخ الإنشاء' },
    { id: 'confirmed_at', labelEn: 'Confirmed', labelAr: 'تاريخ التأكيد' },
    { id: 'shipped_at', labelEn: 'Shipped', labelAr: 'تاريخ الشحن' },
];
function headerLabels(columns, columnIds, arabic) {
    const byId = new Map(columns.map((c) => [c.id, c]));
    return columnIds
        .map((id) => byId.get(id))
        .filter((c) => !!c)
        .map((c) => (arabic ? c.labelAr : c.labelEn));
}
function orderedColumnIds(columns, columnIds) {
    const allowed = new Set(columns.map((c) => c.id));
    return columnIds.filter((id) => allowed.has(id));
}
//# sourceMappingURL=client-order-export.columns.js.map