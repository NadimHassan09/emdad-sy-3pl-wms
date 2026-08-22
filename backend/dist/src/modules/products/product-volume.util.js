"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeProductVolumeCbm = computeProductVolumeCbm;
exports.resolveProductVolumeCbmFromDims = resolveProductVolumeCbmFromDims;
const client_1 = require("@prisma/client");
function computeProductVolumeCbm(lengthCm, widthCm, heightCm) {
    const l = toPositiveNumber(lengthCm);
    const w = toPositiveNumber(widthCm);
    const h = toPositiveNumber(heightCm);
    if (l == null || w == null || h == null) {
        return new client_1.Prisma.Decimal(0);
    }
    return new client_1.Prisma.Decimal(l).mul(w).mul(h).div(1_000_000).toDecimalPlaces(6);
}
function toPositiveNumber(value) {
    if (value == null || value === '')
        return null;
    const n = typeof value === 'number' ? value : Number(value.toString());
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return n;
}
function resolveProductVolumeCbmFromDims(input) {
    const length = input.lengthCm !== undefined ? input.lengthCm : input.previous?.lengthCm ?? null;
    const width = input.widthCm !== undefined ? input.widthCm : input.previous?.widthCm ?? null;
    const height = input.heightCm !== undefined ? input.heightCm : input.previous?.heightCm ?? null;
    return computeProductVolumeCbm(length, width, height);
}
//# sourceMappingURL=product-volume.util.js.map