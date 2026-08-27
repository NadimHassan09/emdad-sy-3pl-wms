"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS = exports.INBOUND_ORDER_LEVEL_FIELDS = exports.INBOUND_CLIENT_IMPORT_ALIASES = exports.INBOUND_CLIENT_IMPORT_HEADERS = void 0;
exports.getInboundClientImportTemplate = getInboundClientImportTemplate;
const oms_orders_csv_util_1 = require("../../oms/oms-orders-csv.util");
exports.INBOUND_CLIENT_IMPORT_HEADERS = [
    'order_number',
    'expected_arrival_date',
    'notes',
    'product_name',
    'sku',
    'quantity',
];
exports.INBOUND_CLIENT_IMPORT_ALIASES = {
    order_number: ['external_reference', 'order_no', 'order number', 'client_reference'],
    expected_arrival_date: ['arrival_date', 'expected arrival date'],
    notes: ['note'],
    product_name: ['product', 'item_name', 'product name'],
    sku: ['product_sku', 'product sku'],
    quantity: ['expected_quantity', 'qty', 'requested_quantity'],
};
exports.INBOUND_ORDER_LEVEL_FIELDS = ['expected_arrival_date', 'notes'];
exports.INBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS = [
    'order_number',
    'expected_arrival_date',
    'sku',
    'quantity',
];
function getInboundClientImportTemplate() {
    const body = (0, oms_orders_csv_util_1.rowsToCsv)([...exports.INBOUND_CLIENT_IMPORT_HEADERS], [
        ['INB-1001', '9/01/2026', '', 'Sample product A', 'SKU-A', '10'],
        ['INB-1001', '9/01/2026', '', 'Sample product B', 'SKU-B', '5'],
        ['INB-1002', '9/02/2026', 'PO-88', 'Sample product A', 'SKU-A', '3'],
    ]);
    return { filename: 'inbound-orders-import-template.csv', body };
}
//# sourceMappingURL=inbound-client-import.schema.js.map