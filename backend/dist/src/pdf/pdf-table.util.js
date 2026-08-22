"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENT_TABLE_MIN_ROWS = void 0;
exports.emptyTableRowSlots = emptyTableRowSlots;
exports.DOCUMENT_TABLE_MIN_ROWS = 5;
function emptyTableRowSlots(itemCount, minRows = exports.DOCUMENT_TABLE_MIN_ROWS) {
    const n = Math.max(0, minRows - itemCount);
    return Array.from({ length: n }, (_, i) => i);
}
//# sourceMappingURL=pdf-table.util.js.map