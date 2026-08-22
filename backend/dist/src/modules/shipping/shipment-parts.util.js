"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPhysicalShipmentParts = buildPhysicalShipmentParts;
exports.toBabelWeightParts = toBabelWeightParts;
exports.totalWeightKg = totalWeightKg;
function buildPhysicalShipmentParts(lines) {
    const parts = [];
    for (const line of lines) {
        const qty = Math.max(0, Math.floor(Number(line.quantity)));
        if (!Number.isFinite(qty) || qty <= 0)
            continue;
        const weight = Number(line.weightKg);
        const unitWeight = Number.isFinite(weight) && weight > 0 ? weight : 0.1;
        for (let i = 0; i < qty; i++) {
            parts.push({
                productId: line.productId,
                productName: line.productName,
                weightKg: unitWeight,
                lengthCm: line.lengthCm ?? null,
                widthCm: line.widthCm ?? null,
                heightCm: line.heightCm ?? null,
            });
        }
    }
    return parts;
}
function toBabelWeightParts(parts, packageType) {
    if (packageType === 'envelope') {
        return [{ weight: 1 }];
    }
    if (parts.length === 0) {
        return [{ weight: 0.1 }];
    }
    return parts.map((p) => ({
        weight: Math.max(0.1, Number(p.weightKg) || 0.1),
    }));
}
function totalWeightKg(parts) {
    return parts.reduce((sum, p) => sum + (Number(p.weightKg) || 0), 0);
}
//# sourceMappingURL=shipment-parts.util.js.map