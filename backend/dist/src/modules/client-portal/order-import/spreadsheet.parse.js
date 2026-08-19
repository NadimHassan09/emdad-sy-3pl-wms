"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSpreadsheetTable = parseSpreadsheetTable;
exports.excelSerialToYmd = excelSerialToYmd;
exports.parseFlexibleDate = parseFlexibleDate;
const common_1 = require("@nestjs/common");
const oms_orders_csv_util_1 = require("../../oms/oms-orders-csv.util");
const order_import_limits_1 = require("./order-import.limits");
function isZip(buffer) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}
function cellToString(value) {
    if (value == null)
        return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return String(value).trim();
}
function parseXlsx(buffer) {
    let XLSX;
    try {
        XLSX = require('xlsx');
    }
    catch {
        throw new common_1.BadRequestException('Excel (.xlsx) import is not available on this server. Save the file as CSV and try again.');
    }
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new common_1.BadRequestException('The Excel file does not contain a worksheet.');
    }
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: '',
    });
    return raw
        .map((row) => (Array.isArray(row) ? row.map(cellToString) : []))
        .filter((row) => row.some((c) => c.trim() !== ''));
}
function parseSpreadsheetTable(fileBuffer, originalName) {
    if (fileBuffer.byteLength > order_import_limits_1.CLIENT_IMPORT_MAX_FILE_BYTES) {
        throw new common_1.PayloadTooLargeException('Import file must be 5 MB or smaller.');
    }
    if (!fileBuffer.byteLength) {
        throw new common_1.BadRequestException('Import file is empty.');
    }
    const name = (originalName ?? '').toLowerCase();
    const looksExcel = name.endsWith('.xlsx') ||
        name.endsWith('.xls') ||
        name.endsWith('.xlsm') ||
        isZip(fileBuffer);
    if (looksExcel) {
        try {
            return parseXlsx(fileBuffer);
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException || err instanceof common_1.PayloadTooLargeException) {
                throw err;
            }
            throw new common_1.BadRequestException('Could not read the Excel file. Save it as .xlsx or CSV (UTF-8) and try again.');
        }
    }
    return (0, oms_orders_csv_util_1.parseCsv)(fileBuffer.toString('utf8'));
}
function excelSerialToYmd(serial) {
    if (!Number.isFinite(serial) || serial < 20000 || serial > 80000)
        return null;
    const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
    const d = new Date(utc);
    if (Number.isNaN(d.getTime()))
        return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function parseFlexibleDate(raw) {
    const t = raw.trim();
    if (!t)
        return null;
    const iso = /^(\d{4}-\d{2}-\d{2})/.exec(t);
    if (iso)
        return iso[1];
    const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(t);
    if (dmy) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        return `${dmy[3]}-${month}-${day}`;
    }
    const n = Number(t);
    if (Number.isFinite(n))
        return excelSerialToYmd(n);
    return null;
}
//# sourceMappingURL=spreadsheet.parse.js.map