"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS = exports.OUTBOUND_ORDER_LEVEL_FIELDS = exports.OUTBOUND_CLIENT_IMPORT_ALIASES = exports.OUTBOUND_CLIENT_IMPORT_HEADERS = void 0;
exports.getOutboundClientImportTemplate = getOutboundClientImportTemplate;
const oms_orders_csv_util_1 = require("../../oms/oms-orders-csv.util");
exports.OUTBOUND_CLIENT_IMPORT_HEADERS = [
    'order_number',
    'required_ship_date',
    'destination_address',
    'notes',
    'sku',
    'requested_quantity',
];
exports.OUTBOUND_CLIENT_IMPORT_ALIASES = {
    order_number: ['external_reference', 'order_no', 'order number'],
    required_ship_date: ['ship_date', 'required ship date'],
    destination_address: ['destination', 'address'],
    notes: ['note'],
    sku: ['product_sku', 'product sku'],
    requested_quantity: ['quantity', 'qty'],
};
exports.OUTBOUND_ORDER_LEVEL_FIELDS = [
    'required_ship_date',
    'destination_address',
    'notes',
];
exports.OUTBOUND_CLIENT_IMPORT_REQUIRED_COLUMNS = [
    'order_number',
    'sku',
    'requested_quantity',
];
function getOutboundClientImportTemplate() {
    const body = (0, oms_orders_csv_util_1.rowsToCsv)([...exports.OUTBOUND_CLIENT_IMPORT_HEADERS], [
        ['OUT-1001', '2026-09-01', 'Damascus warehouse dock A', '', 'SKU-A', '2'],
        ['OUT-1001', '', '', '', 'SKU-B', '3'],
        ['OUT-1002', '2026-09-02', 'Aleppo store 12', '', 'SKU-A', '1'],
    ]);
    return { filename: 'outbound-orders-import-template.csv', body };
}
//# sourceMappingURL=outbound-client-import.schema.js.map