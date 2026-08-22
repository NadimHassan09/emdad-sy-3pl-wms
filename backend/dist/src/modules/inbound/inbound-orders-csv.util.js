"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INBOUND_IMPORT_CSV_HEADERS = void 0;
exports.csvEscape = csvEscape;
exports.rowsToCsv = rowsToCsv;
exports.parseCsv = parseCsv;
exports.normalizeHeader = normalizeHeader;
exports.mapCsvHeaderRow = mapCsvHeaderRow;
exports.cell = cell;
exports.inboundImportTemplateCsv = inboundImportTemplateCsv;
exports.INBOUND_IMPORT_CSV_HEADERS = [
    'external_reference',
    'company_id',
    'expected_arrival_date',
    'client_reference',
    'notes',
    'source_type',
    'store_channel',
    'product_sku',
    'expected_quantity',
    'expected_lot_number',
    'expected_expiry_date',
];
function csvEscape(value) {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
function rowsToCsv(headers, rows) {
    const lines = [headers.map((h) => csvEscape(h)).join(',')];
    for (const row of rows) {
        lines.push(row.map((v) => csvEscape(v == null ? '' : String(v))).join(','));
    }
    return `\uFEFF${lines.join('\n')}`;
}
function parseCsv(text) {
    const input = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    field += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            continue;
        }
        if (ch === ',') {
            row.push(field);
            field = '';
            continue;
        }
        if (ch === '\n') {
            row.push(field);
            field = '';
            if (row.some((c) => c.trim() !== ''))
                rows.push(row);
            row = [];
            continue;
        }
        if (ch === '\r')
            continue;
        field += ch;
    }
    row.push(field);
    if (row.some((c) => c.trim() !== ''))
        rows.push(row);
    return rows;
}
function normalizeHeader(raw) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/^\uFEFF/, '')
        .replace(/[\s-]+/g, '_');
}
function mapCsvHeaderRow(headerRow) {
    const indexByHeader = {};
    const unknown = [];
    const allowed = new Set(exports.INBOUND_IMPORT_CSV_HEADERS);
    headerRow.forEach((raw, idx) => {
        const key = normalizeHeader(raw);
        if (!key)
            return;
        if (allowed.has(key)) {
            indexByHeader[key] = idx;
        }
        else {
            unknown.push(raw.trim());
        }
    });
    return { indexByHeader, unknown };
}
function cell(cells, indexByHeader, header) {
    const idx = indexByHeader[header];
    if (idx == null || idx < 0 || idx >= cells.length)
        return '';
    return (cells[idx] ?? '').trim();
}
function inboundImportTemplateCsv() {
    const example = [
        'INB-IMPORT-001',
        '',
        '2026-12-31',
        '',
        'Imported via CSV template',
        'purchase',
        'csv_import',
        'EXAMPLE-SKU',
        '10',
        '',
        '',
    ];
    const secondLine = [
        'INB-IMPORT-001',
        '',
        '2026-12-31',
        '',
        '',
        'purchase',
        'csv_import',
        'EXAMPLE-SKU-2',
        '5',
        '',
        '',
    ];
    return rowsToCsv([...exports.INBOUND_IMPORT_CSV_HEADERS], [example, secondLine]);
}
//# sourceMappingURL=inbound-orders-csv.util.js.map