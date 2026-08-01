"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLang = normalizeLang;
exports.makeTranslator = makeTranslator;
exports.buildLabels = buildLabels;
exports.formatDocDate = formatDocDate;
exports.formatDocDateTime = formatDocDateTime;
exports.formatQty = formatQty;
function normalizeLang(raw) {
    return (raw ?? '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
const DICT = {
    dir: { en: 'ltr', ar: 'rtl' },
    documentTitleGrn: { en: 'Goods Receipt Note', ar: 'سند استلام بضاعة' },
    documentTitleDn: { en: 'Delivery Note', ar: 'سند تسليم' },
    grnAbbr: { en: 'GRN', ar: 'GRN' },
    dnAbbr: { en: 'DN', ar: 'DN' },
    referenceNo: { en: 'Reference No.', ar: 'الرقم المرجعي' },
    issueDate: { en: 'Issue Date', ar: 'تاريخ الإصدار' },
    page: { en: 'Page', ar: 'صفحة' },
    of: { en: 'of', ar: 'من' },
    confidential: { en: 'Confidential', ar: 'سري' },
    generatedByWms: { en: 'Generated automatically by WMS', ar: 'تم إنشاؤه تلقائياً بواسطة نظام إدارة المستودعات' },
    notProvided: { en: '—', ar: '—' },
    warehouse: { en: 'Warehouse', ar: 'المستودع' },
    client: { en: 'Client', ar: 'العميل' },
    customer: { en: 'Customer', ar: 'العميل' },
    supplier: { en: 'Supplier', ar: 'المورّد' },
    operator: { en: 'Operator', ar: 'المُشغّل' },
    receivingDate: { en: 'Receiving Date', ar: 'تاريخ الاستلام' },
    dispatchDate: { en: 'Dispatch Date', ar: 'تاريخ التسليم' },
    vatNumber: { en: 'VAT No.', ar: 'الرقم الضريبي' },
    deliverTo: { en: 'Deliver to', ar: 'التسليم إلى' },
    receiptFor: { en: 'Receipt for', ar: 'استلام لـ' },
    shipmentInformation: { en: 'Shipment Information', ar: 'معلومات الشحنة' },
    shipmentDetails: { en: 'Shipment Details', ar: 'تفاصيل الشحنة' },
    items: { en: 'Items', ar: 'الأصناف' },
    summary: { en: 'Summary', ar: 'الملخص' },
    notes: { en: 'Notes', ar: 'ملاحظات' },
    signatures: { en: 'Signatures', ar: 'التواقيع' },
    inboundOrderNumber: { en: 'Inbound Order No.', ar: 'رقم طلب الإدخال' },
    outboundOrderNumber: { en: 'Outbound Order No.', ar: 'رقم طلب الإخراج' },
    container: { en: 'Container', ar: 'الحاوية' },
    truckNumber: { en: 'Truck Number', ar: 'رقم الشاحنة' },
    sealNumber: { en: 'Seal Number', ar: 'رقم الختم' },
    poNumber: { en: 'PO Number', ar: 'رقم أمر الشراء' },
    dispatchTime: { en: 'Dispatch Time', ar: 'وقت التسليم' },
    receivingTime: { en: 'Receiving Time', ar: 'وقت الاستلام' },
    trackingNumber: { en: 'Tracking Number', ar: 'رقم التتبّع' },
    destination: { en: 'Destination', ar: 'الوجهة' },
    reference: { en: 'Reference', ar: 'المرجع' },
    carrier: { en: 'Carrier', ar: 'الناقل' },
    vehicleNumber: { en: 'Vehicle Number', ar: 'رقم المركبة' },
    driverName: { en: 'Driver Name', ar: 'اسم السائق' },
    driverPhone: { en: 'Driver Phone', ar: 'هاتف السائق' },
    colNo: { en: '#', ar: '#' },
    colSku: { en: 'SKU', ar: 'الرمز' },
    colProduct: { en: 'Product Name', ar: 'اسم المنتج' },
    colBatch: { en: 'Batch / Lot', ar: 'الدفعة' },
    colExpiry: { en: 'Expiry', ar: 'الصلاحية' },
    colReceivedQty: { en: 'Received Qty', ar: 'الكمية المستلمة' },
    colOrderedQty: { en: 'Ordered Qty', ar: 'الكمية المطلوبة' },
    colPickedQty: { en: 'Picked Qty', ar: 'الكمية المجهّزة' },
    colShippedQty: { en: 'Shipped Qty', ar: 'الكمية المشحونة' },
    colUnit: { en: 'Unit', ar: 'الوحدة' },
    colCondition: { en: 'Condition', ar: 'الحالة' },
    colRemarks: { en: 'Remarks', ar: 'ملاحظات' },
    conditionGood: { en: 'Good', ar: 'سليم' },
    conditionShort: { en: 'Short', ar: 'نقص' },
    conditionDamaged: { en: 'Damaged', ar: 'تالف' },
    totalItems: { en: 'Total Items', ar: 'إجمالي الأصناف' },
    totalSkus: { en: 'Number of SKUs', ar: 'عدد الأصناف' },
    totalQuantity: { en: 'Total Quantity', ar: 'إجمالي الكمية' },
    receivedBy: { en: 'Received By', ar: 'استلمها' },
    preparedBy: { en: 'Prepared By', ar: 'جهّزها' },
    checkedBy: { en: 'Checked By', ar: 'دقّقها' },
    releasedBy: { en: 'Released By', ar: 'أفرج عنها' },
    warehouseOfficer: { en: 'Warehouse Officer', ar: 'مسؤول المستودع' },
    supervisor: { en: 'Supervisor', ar: 'المشرف' },
    clientRepresentative: { en: 'Client Representative', ar: 'ممثل العميل' },
    warehouseSign: { en: 'Warehouse', ar: 'المستودع' },
    driverSign: { en: 'Driver', ar: 'السائق' },
    customerSign: { en: 'Customer', ar: 'العميل' },
    signature: { en: 'Signature', ar: 'التوقيع' },
    nameAndDate: { en: 'Name & Date', ar: 'الاسم والتاريخ' },
};
function makeTranslator(lang) {
    return (key) => {
        const entry = DICT[key];
        return entry ? entry[lang] : String(key);
    };
}
function buildLabels(lang) {
    const out = {};
    Object.keys(DICT).forEach((key) => {
        out[key] = DICT[key][lang];
    });
    return out;
}
const LOCALE = { en: 'en-GB', ar: 'ar-SY' };
function formatDocDate(value, lang) {
    if (!value)
        return '—';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime()))
        return '—';
    return new Intl.DateTimeFormat(LOCALE[lang], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(d);
}
function formatDocDateTime(value, lang) {
    if (!value)
        return '—';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime()))
        return '—';
    return new Intl.DateTimeFormat(LOCALE[lang], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
}
function formatQty(value, lang) {
    const n = Number(value ?? 0);
    if (Number.isNaN(n))
        return '0';
    return new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 4 }).format(n);
}
//# sourceMappingURL=i18n.js.map