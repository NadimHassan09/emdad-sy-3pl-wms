"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRowsToCsv = reportRowsToCsv;
exports.reportRowsToXls = reportRowsToXls;
function escapeCsvCell(value) {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function reportRowsToCsv(columns, rows) {
    const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
    const body = rows
        .map((row) => columns.map((c) => escapeCsvCell(String(row[c.id] ?? ''))).join(','))
        .join('\n');
    return `\uFEFF${header}\n${body}`;
}
function reportRowsToXls(columns, rows) {
    const headerRow = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
    const bodyRows = rows
        .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(String(row[c.id] ?? ''))}</td>`).join('')}</tr>`)
        .join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
}
//# sourceMappingURL=reports-export.util.js.map