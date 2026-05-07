"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyToUndefined = EmptyToUndefined;
exports.QueryBoolOptional = QueryBoolOptional;
exports.PaginationLimit = PaginationLimit;
exports.PaginationOffset = PaginationOffset;
const class_transformer_1 = require("class-transformer");
function EmptyToUndefined() {
    return (0, class_transformer_1.Transform)(({ value }) => value === '' || value === undefined || value === null ? undefined : value);
}
function QueryBoolOptional() {
    return (0, class_transformer_1.Transform)(({ value }) => {
        if (value === '' || value === undefined || value === null)
            return undefined;
        if (value === true || value === 'true' || value === '1' || value === 1)
            return true;
        if (value === false || value === 'false' || value === '0' || value === 0)
            return false;
        return undefined;
    });
}
function coercePageInt(value, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    const raw = Array.isArray(value) ? value[0] : value;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
    return Number.isFinite(n) ? n : fallback;
}
function PaginationLimit(defaultVal = 50, maxVal = 500) {
    return (0, class_transformer_1.Transform)(({ value }) => {
        const n = coercePageInt(value, defaultVal);
        return Math.min(Math.max(n, 1), maxVal);
    });
}
function PaginationOffset(defaultVal = 0) {
    return (0, class_transformer_1.Transform)(({ value }) => {
        const n = coercePageInt(value, defaultVal);
        return n < 0 ? defaultVal : n;
    });
}
//# sourceMappingURL=query-transform.js.map