"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceOptionalBool = coerceOptionalBool;
function coerceOptionalBool(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (value === true || value === 1)
        return true;
    if (value === false || value === 0)
        return false;
    if (typeof value === 'string') {
        const s = value.toLowerCase();
        if (s === 'true' || s === '1')
            return true;
        if (s === 'false' || s === '0')
            return false;
    }
    return undefined;
}
//# sourceMappingURL=coerce-boolean.js.map