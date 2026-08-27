"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMS_CLIENT_IMPORT_REQUIRED_COLUMNS = exports.OMS_ORDER_LEVEL_FIELDS = exports.OMS_CLIENT_IMPORT_ALIASES = exports.OMS_CLIENT_IMPORT_HEADERS = void 0;
exports.getOmsClientImportTemplate = getOmsClientImportTemplate;
exports.applyAdminCityCompatibility = applyAdminCityCompatibility;
const oms_orders_csv_util_1 = require("../../oms/oms-orders-csv.util");
exports.OMS_CLIENT_IMPORT_HEADERS = [
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
];
exports.OMS_CLIENT_IMPORT_ALIASES = {
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
exports.OMS_ORDER_LEVEL_FIELDS = [
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
];
exports.OMS_CLIENT_IMPORT_REQUIRED_COLUMNS = [
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
function getOmsClientImportTemplate() {
    const headers = [...exports.OMS_CLIENT_IMPORT_HEADERS];
    const body = (0, oms_orders_csv_util_1.rowsToCsv)(headers, [
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
function applyAdminCityCompatibility(values) {
    if (!values.governorate?.trim() && values.city?.trim() && values.district?.trim()) {
        values.governorate = values.city;
        values.city = values.district;
    }
}
//# sourceMappingURL=oms-client-import.schema.js.map