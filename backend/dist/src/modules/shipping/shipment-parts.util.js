"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPhysicalShipmentParts = buildPhysicalShipmentParts;
exports.toBabelWeightParts = toBabelWeightParts;
exports.totalWeightKg = totalWeightKg;
exports.cartonWeightKg = cartonWeightKg;
exports.totalCartonsWeightKg = totalCartonsWeightKg;
exports.totalCartonsVolumeCbm = totalCartonsVolumeCbm;
exports.babelPartsFromCartons = babelPartsFromCartons;
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
function cartonWeightKg(carton, weightByProductId) {
    let sum = 0;
    for (const line of carton.lines) {
        const unit = weightByProductId.get(line.productId) ?? 0.1;
        const qty = Math.max(0, Math.floor(Number(line.quantity)) || 0);
        if (qty <= 0)
            continue;
        sum += unit * qty;
    }
    return Math.round(sum * 10000) / 10000;
}
function totalCartonsWeightKg(cartons, weightByProductId) {
    let sum = 0;
    for (const c of cartons)
        sum += cartonWeightKg(c, weightByProductId);
    return Math.round(sum * 10000) / 10000;
}
function totalCartonsVolumeCbm(cartons) {
    let sum = 0;
    for (const c of cartons) {
        sum += (c.lengthCm * c.widthCm * c.heightCm) / 1_000_000;
    }
    return Math.round(sum * 1_000_000) / 1_000_000;
}
function babelPartsFromCartons(cartons, weightByProductId, packageType) {
    if (packageType === 'envelope')
        return [{ weight: 1 }];
    if (cartons.length === 0)
        return [{ weight: 0.1 }];
    return cartons.map((c) => ({
        weight: Math.max(0.1, cartonWeightKg(c, weightByProductId)),
    }));
}
//# sourceMappingURL=shipment-parts.util.js.map