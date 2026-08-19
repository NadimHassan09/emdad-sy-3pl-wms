"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCompare = normalizeCompare;
exports.mapHeaderRow = mapHeaderRow;
exports.rowValues = rowValues;
exports.assertImportTable = assertImportTable;
exports.groupRowsByOrderNumber = groupRowsByOrderNumber;
const common_1 = require("@nestjs/common");
const oms_orders_csv_util_1 = require("../../oms/oms-orders-csv.util");
const order_import_limits_1 = require("./order-import.limits");
function normalizeCompare(value) {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
function mapHeaderRow(headerRow, aliasMap) {
    const aliasToCanonical = new Map();
    for (const [canonical, aliases] of Object.entries(aliasMap)) {
        aliasToCanonical.set((0, oms_orders_csv_util_1.normalizeHeader)(canonical), canonical);
        for (const alias of aliases) {
            aliasToCanonical.set((0, oms_orders_csv_util_1.normalizeHeader)(alias), canonical);
        }
    }
    const indexByField = {};
    const unknown = [];
    headerRow.forEach((raw, idx) => {
        const key = (0, oms_orders_csv_util_1.normalizeHeader)(raw);
        if (!key)
            return;
        const canonical = aliasToCanonical.get(key);
        if (!canonical) {
            unknown.push(raw.trim());
            return;
        }
        if (indexByField[canonical] == null)
            indexByField[canonical] = idx;
    });
    return { indexByField, unknown };
}
function rowValues(cells, indexByField) {
    const values = {};
    for (const [field, idx] of Object.entries(indexByField)) {
        values[field] = (cells[idx] ?? '').trim();
    }
    return values;
}
function assertImportTable(table, aliasMap, requiredFields) {
    if (table.length < 2) {
        throw new common_1.BadRequestException('Import file must include a header row and at least one data row.');
    }
    const { indexByField } = mapHeaderRow(table[0] ?? [], aliasMap);
    for (const field of requiredFields) {
        if (indexByField[field] == null) {
            throw new common_1.BadRequestException(`Missing required column: ${field}. Download the import template for the supported format.`);
        }
    }
    const dataRows = [];
    for (let i = 1; i < table.length; i++) {
        const cells = table[i] ?? [];
        if (!cells.some((c) => c.trim() !== ''))
            continue;
        dataRows.push({ rowNumber: i + 1, values: rowValues(cells, indexByField) });
    }
    if (dataRows.length === 0) {
        throw new common_1.BadRequestException('Import file has no data rows.');
    }
    if (dataRows.length > order_import_limits_1.CLIENT_IMPORT_MAX_ROWS) {
        throw new common_1.BadRequestException(`Import has ${dataRows.length} data rows; maximum is ${order_import_limits_1.CLIENT_IMPORT_MAX_ROWS}.`);
    }
    return { indexByField, dataRows };
}
function groupRowsByOrderNumber(rows, orderNumberField, orderLevelFields) {
    const groups = new Map();
    const order = [];
    for (const row of rows) {
        const orderNumber = row.values[orderNumberField]?.trim() ?? '';
        if (!orderNumber) {
            const orphan = {
                orderNumber: '',
                rowNumbers: [row.rowNumber],
                fields: { ...row.values },
                lines: [row],
                conflict: { field: orderNumberField, error: 'Order number is required.' },
            };
            groups.set(`__missing__:${row.rowNumber}`, orphan);
            order.push(`__missing__:${row.rowNumber}`);
            continue;
        }
        const key = normalizeCompare(orderNumber);
        let group = groups.get(key);
        if (!group) {
            group = {
                orderNumber,
                rowNumbers: [],
                fields: {},
                lines: [],
            };
            groups.set(key, group);
            order.push(key);
        }
        group.rowNumbers.push(row.rowNumber);
        group.lines.push(row);
        if (group.conflict)
            continue;
        for (const field of orderLevelFields) {
            const incoming = (row.values[field] ?? '').trim();
            if (!incoming)
                continue;
            const existing = (group.fields[field] ?? '').trim();
            if (!existing) {
                group.fields[field] = incoming;
                continue;
            }
            if (normalizeCompare(existing) !== normalizeCompare(incoming)) {
                group.conflict = {
                    field,
                    error: `Conflicting ${field} for order ${orderNumber}: "${existing}" vs "${incoming}".`,
                };
            }
        }
    }
    if (groups.size > order_import_limits_1.CLIENT_IMPORT_MAX_ORDERS) {
        throw new common_1.BadRequestException(`Import has ${groups.size} orders; maximum is ${order_import_limits_1.CLIENT_IMPORT_MAX_ORDERS}.`);
    }
    return order.map((k) => groups.get(k));
}
//# sourceMappingURL=order-import.grouping.js.map