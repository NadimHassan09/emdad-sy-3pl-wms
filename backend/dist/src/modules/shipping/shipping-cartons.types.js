"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseShippingCartons = parseShippingCartons;
function parseShippingCartons(raw) {
    if (!Array.isArray(raw))
        return null;
    const out = [];
    for (const row of raw) {
        if (!row || typeof row !== 'object')
            continue;
        const r = row;
        const linesRaw = r.lines;
        if (!Array.isArray(linesRaw))
            continue;
        const lines = [];
        for (const ln of linesRaw) {
            if (!ln || typeof ln !== 'object')
                continue;
            const l = ln;
            const productId = typeof l.productId === 'string' ? l.productId.trim() : '';
            const quantity = Number(l.quantity);
            if (!productId || !Number.isFinite(quantity) || quantity <= 0)
                continue;
            lines.push({ productId, quantity: Math.floor(quantity) });
        }
        const lengthCm = Number(r.lengthCm);
        const widthCm = Number(r.widthCm);
        const heightCm = Number(r.heightCm);
        if (lines.length === 0 ||
            !Number.isFinite(lengthCm) ||
            !Number.isFinite(widthCm) ||
            !Number.isFinite(heightCm) ||
            lengthCm <= 0 ||
            widthCm <= 0 ||
            heightCm <= 0) {
            continue;
        }
        out.push({
            lines,
            lengthCm,
            widthCm,
            heightCm,
        });
    }
    return out.length > 0 ? out : null;
}
//# sourceMappingURL=shipping-cartons.types.js.map